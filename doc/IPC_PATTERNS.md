# IPC (Inter-Process Communication) Patterns

This document describes the IPC architecture and patterns used in FokusZeit for secure communication between the main and renderer processes.

## Overview

Electron apps have two types of processes:
- **Main Process** - Node.js environment, handles OS integration, database, system APIs
- **Renderer Process** - Browser environment, handles UI, runs in a sandbox

FokusZeit uses IPC (Inter-Process Communication) to safely bridge these processes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Main Process                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ipcHandlers.js - Orchestrates registration                  │  │
│  │    │                                                          │  │
│  │    ├─→ projectIpc.js          (Project CRUD)                 │  │
│  │    ├─→ taskCrudIpc.js         (Task CRUD)                    │  │
│  │    ├─→ taskSchedulingIpc.js   (Task scheduling/prioritization)│  │
│  │    ├─→ notificationIpc.js     (Notification CRUD/scheduling)  │  │
│  │    ├─→ recurrenceIpc.js       (Recurrence rule management)    │  │
│  │    ├─→ preferencesIpc.js      (User preferences)              │  │
│  │    └─→ aiIpc.js              (AI chat/configuration)         │  │
│  │                                                              │  │
│  │  Each registrar:                                             │  │
│  │  - Registers handlers via ipcMain.handle()                   │  │
│  │  - Handles errors and logs                                   │  │
│  │  - Emits UI refresh events when data changes                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ IPC (via preload.cjs)
┌─────────────────────────────────────────────────────────────────────┐
│                         Renderer Process                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Vue Components                                              │  │
│  │    │                                                          │  │
│  │    └─→ window.electron.method()                              │  │
│  │           │                                                   │  │
│  │           └─→ Vuex Store Actions                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Responsibility |
|------|---------------|
| `/app/electron-main/ipcHandlers.js` | Consolidated IPC handler orchestration |
| `/app/electron-main/ipc/` | Domain-specific IPC registrar modules |
| `/app/preload.cjs` | Context-isolated IPC bridge (security layer) |

## Request Flow (Renderer → Main)

```
1. Vue Component calls: window.electron.someMethod(data)
   ↓
2. Preload script (preload.cjs) validates and forwards via ipcRenderer.invoke()
   ↓
3. Main process handler registered via ipcMain.handle() receives request
   ↓
4. Service layer executes business logic
   ↓
5. Database operations performed
   ↓
6. Result returned via Promise
```

## Event Flow (Main → Renderer for UI Updates)

```
1. Main process completes data-changing operation
   ↓
2. Emits event via mainWindow.webContents.send('entity:changed', data)
   ↓
3. Renderer IPC listener (in component) receives event
   ↓
4. Dispatches to Vuex store action
   ↓
5. Store updates state
   ↓
6. Component reacts to state change
```

## Security: Context Isolation

**Critical**: The preload script is the ONLY bridge between processes. Never bypass it.

```javascript
// ❌ WRONG - Bypasses security
window.require('electron').ipcRenderer.send('channel', data);

// ✅ CORRECT - Goes through preload
window.electron.someMethod(data);
```

The preload script uses `contextBridge` to expose a safe API:

```javascript
// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Only expose specific channels
  getProjects: () => ipcRenderer.invoke('project:getAll'),
  addTask: (data) => ipcRenderer.invoke('task:add', data),
  // ...
});
```

## Domain-Specific Registrars

Each domain has its own IPC registrar module in `/app/electron-main/ipc/`:

| File | Domain | Operations |
|------|--------|------------|
| `aiIpc.js` | AI | Chat messages, API configuration |
| `projectIpc.js` | Projects | CRUD operations |
| `taskCrudIpc.js` | Tasks | CRUD operations |
| `taskSchedulingIpc.js` | Tasks | Scheduling, prioritization, day planning |
| `notificationIpc.js` | Notifications | CRUD and scheduling |
| `recurrenceIpc.js` | Recurrence | Rule management |
| `preferencesIpc.js` | Preferences | User settings |

## IPC Handler Pattern

All main-process operations follow this pattern:

```javascript
// In ipc/[domain]Ipc.js
import ipcMain from 'electron';
import logger from '../logger.js';
import someService from '../services/someService.js';

export function registerSomeHandlers() {
  ipcMain.handle('channel:name', async (_, data) => {
    try {
      const result = await someService.method(data);
      // Trigger UI update for any listeners
      // mainWindow.webContents.send('entity:refresh');
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - methodName');
      return false;
    }
  });
}
```

### Complete Example: Task CRUD

```javascript
// ipc/taskCrudIpc.js
import ipcMain from 'electron';
import logger from '../logger.js';
import taskManager from '../services/task.js';
import Task from '../../shared/models/Task.js';

export function registerTaskCrudHandlers() {
  // Add a task
  ipcMain.handle('task:add', async (_, taskData) => {
    try {
      const task = Task.fromAppLayer(taskData);
      const result = taskManager.add(task);
      return Task.toAppLayer(result);
    } catch (error) {
      logger.logError(error, 'IPC Error - task:add');
      return false;
    }
  });

  // Get tasks by project
  ipcMain.handle('task:getByProject', async (_, projectId) => {
    try {
      const tasks = taskManager.getByProject(projectId);
      return tasks.map(Task.toAppLayer);
    } catch (error) {
      logger.logError(error, 'IPC Error - task:getByProject');
      return [];
    }
  });

  // Update a task
  ipcMain.handle('task:update', async (_, taskData) => {
    try {
      const task = Task.fromAppLayer(taskData);
      const result = taskManager.update(task);
      return Task.toAppLayer(result);
    } catch (error) {
      logger.logError(error, 'IPC Error - task:update');
      return false;
    }
  });

  // Delete a task
  ipcMain.handle('task:delete', async (_, taskId) => {
    try {
      return taskManager.delete(taskId);
    } catch (error) {
      logger.logError(error, 'IPC Error - task:delete');
      return false;
    }
  });
}
```

## Orchestration

The `ipcHandlers.js` file coordinates all registration by delegating to domain-specific registrars:

```javascript
// ipcHandlers.js
import { registerProjectHandlers } from './ipc/projectIpc.js';
import { registerTaskCrudHandlers } from './ipc/taskCrudIpc.js';
import { registerTaskSchedulingHandlers } from './ipc/taskSchedulingIpc.js';
import { registerNotificationHandlers } from './ipc/notificationIpc.js';
import { registerRecurrenceHandlers } from './ipc/recurrenceIpc.js';
import { registerPreferencesHandlers } from './ipc/preferencesIpc.js';
import { registerAiHandlers } from './ipc/aiIpc.js';

export function setupIpcHandlers(mainWindow, aiService) {
  registerProjectHandlers();
  registerTaskCrudHandlers();
  registerTaskSchedulingHandlers(mainWindow);
  registerNotificationHandlers(mainWindow);
  registerRecurrenceHandlers(mainWindow);
  registerPreferencesHandlers();
  registerAiHandlers(mainWindow, aiService);
}
```

## Sending Events from Main to Renderer

**Critical**: Never use `ipcMain.emit()` for renderer communication. It bypasses context isolation.

Always use `webContents.send()` from the main process:

```javascript
// ✅ CORRECT - In main process
mainWindow.webContents.send('notifications:changed', { taskId });

// ❌ WRONG - Bypasses context isolation
ipcMain.emit('notifications:changed', { taskId });
```

## Receiving Events in Renderer

Components listen for events via the preload API:

```javascript
// In Vue component
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  setup() {
    const wrappedListener = ref(null);

    onMounted(() => {
      wrappedListener.value = window.electron.receive(
        'notifications:changed',
        async (data) => {
          // Handle the event
          await store.dispatch('notifications/fetchNotificationsByTask', data.taskId);
        }
      );
    });

    onBeforeUnmount(() => {
      // Clean up listener to prevent memory leaks
      window.electron.removeListener('notifications:changed', wrappedListener.value);
    });
  }
};
```

## Common IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `project:getAll` | Renderer → Main | Get all projects |
| `project:add` | Renderer → Main | Create a project |
| `project:update` | Renderer → Main | Update a project |
| `project:delete` | Renderer → Main | Delete a project |
| `task:add` | Renderer → Main | Create a task |
| `task:update` | Renderer → Main | Update a task |
| `task:delete` | Renderer → Main | Delete a task |
| `task:getByProject` | Renderer → Main | Get tasks for a project |
| `notification:add` | Renderer → Main | Create a notification |
| `notifications:changed` | Main → Renderer | Notification data changed |
| `ai:sendMessage` | Renderer → Main | Send chat message to AI |
| `ai:streamChunk` | Main → Renderer | Streaming AI response chunk |

## Related Documentation

- [AI_INTEGRATION.md](./AI_INTEGRATION.md) - How AI uses IPC to execute operations
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - How IPC integrates with Vuex store
- [../AGENTS.md](../AGENTS.md) - Project overview and architecture
