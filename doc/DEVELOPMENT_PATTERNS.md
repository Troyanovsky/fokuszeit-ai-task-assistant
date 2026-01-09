# Development Patterns

This document describes key patterns used throughout FokusZeit codebase for consistency and maintainability.

## Model Pattern

Models handle data transformation between database (snake_case) and application (camelCase). Every model has `toDatabase()` and `fromDatabase()` methods.

### Purpose
- **Separation of concerns**: Models handle transformation, services handle business logic
- **Consistency**: All data goes through same transformation logic
- **Validation**: Models can validate data before database operations

### Model Structure

All models in `/app/shared/models/` follow this pattern:

```javascript
/**
 * Task Model
 * Handles transformation between database and application formats.
 */
export default class Task {
  /**
   * Create a Task instance from application-layer data (camelCase).
   * @param {Object} data - Application layer data
   * @returns {Task} - Task instance
   */
  static fromAppLayer(data) {
    return new Task(data);
  }

  /**
   * Create a Task instance from database row (snake_case).
   * @param {Object} row - Database row
   * @returns {Task} - Task instance
   */
  static fromDatabase(row) {
    return new Task({
      id: row.id,
      name: row.name,
      description: row.description,
      duration: row.duration,
      dueDate: row.due_date,           // snake_case → camelCase
      plannedTime: row.planned_time,    // snake_case → camelCase
      projectId: row.project_id,        // snake_case → camelCase
      dependencies: row.dependencies,   // JSON parsed by service
      status: row.status,
      labels: row.labels,               // JSON parsed by service
      priority: row.priority,
      createdAt: row.created_at,        // snake_case → camelCase
      updatedAt: row.updated_at         // snake_case → camelCase
    });
  }

  /**
   * Convert to database format (snake_case).
   * @returns {Object} - Database row object
   */
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      duration: this.duration,
      due_date: this.dueDate,           // camelCase → snake_case
      planned_time: this.plannedTime,   // camelCase → snake_case
      project_id: this.projectId,       // camelCase → snake_case
      dependencies: JSON.stringify(this.dependencies), // Array → JSON string
      status: this.status,
      labels: JSON.stringify(this.labels),             // Array → JSON string
      priority: this.priority,
      created_at: this.createdAt,       // camelCase → snake_case
      updated_at: this.updatedAt        // camelCase → snake_case
    };
  }

  /**
   * Convert to application format (camelCase).
   * @returns {Object} - Application layer object
   */
  toAppLayer() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      duration: this.duration,
      dueDate: this.dueDate,
      plannedTime: this.plannedTime,
      projectId: this.projectId,
      dependencies: this.dependencies,
      status: this.status,
      labels: this.labels,
      priority: this.priority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.duration = data.duration;
    this.dueDate = data.dueDate;
    this.plannedTime = data.plannedTime;
    this.projectId = data.projectId;
    this.dependencies = data.dependencies || [];
    this.status = data.status;
    this.labels = data.labels || [];
    this.priority = data.priority;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

### Usage in Services

```javascript
import Task from '../../shared/models/Task.js';

// Reading from database
const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
const task = Task.fromDatabase(row);

// Writing to database
const task = Task.fromAppLayer(taskData);
const dbData = task.toDatabase();
db.prepare('INSERT INTO tasks (...) VALUES (...)').run(dbData);

// Returning to renderer
return task.toAppLayer();
```

## AI Function Addition Pattern

When adding a new AI function handler, follow these steps:

### Step 1: Add Function Schema

Add to `/app/electron-main/services/functionSchemas.js`:

```javascript
{
  type: 'function',
  function: {
    name: 'archiveCompletedTasks',
    description: 'Archive all completed tasks older than specified date',
    parameters: {
      type: 'object',
      properties: {
        beforeDate: {
          type: 'string',
          format: 'date',
          description: 'Archive tasks completed before this date (YYYY-MM-DD)'
        }
      },
      required: ['beforeDate']
    }
  }
}
```

### Step 2: Create Handler Implementation

Add to appropriate domain file in `/app/electron-main/ai-function-handlers/`:

```javascript
// In taskHandlers.js
import taskManager from '../services/task.js';

export async function handleArchiveCompletedTasks(args, baseResult) {
  const result = await taskManager.archiveCompletedTasks(args);
  return { ...baseResult, success: true, ...result };
}
```

### Step 3: Register Handler

Add to `/app/electron-main/ai-function-handlers/index.js`:

```javascript
import * as taskHandlers from './taskHandlers.js';

const handlerRegistry = {
  // ... existing handlers
  archiveCompletedTasks: { handler: taskHandlers.handleArchiveCompletedTasks }
};
```

**That's it!** No changes needed to `aiService.js` - the registry automatically routes calls.

## Notification Store Pattern

Centralized Vuex store for notification state management. Uses hybrid IPC + store approach:

### Store Usage in Components

```javascript
// Batch refresh for all visible tasks
await store.dispatch('notifications/refreshNotificationCounts');

// Fetch notifications for specific task
await store.dispatch('notifications/fetchNotificationsByTask', taskId);

// Get notification count (excludes PLANNED_TIME type from UI display)
const count = store.getters['notifications/notificationCount'](taskId);
```

### IPC Event Flow

Main process emits events → Components listen → Dispatch to store → Store manages local state

```javascript
// In component onMounted
wrappedNotificationsChangedListener.value = window.electron.receive(
  'notifications:changed',
  async (taskId) => {
    if (taskId) {
      await store.dispatch('notifications/fetchNotificationsByTask', taskId);
    } else {
      await store.dispatch('notifications/refreshNotificationCounts');
    }
  }
);

// In component onBeforeUnmount
window.electron.removeListener('notifications:changed', wrappedNotificationsChangedListener.value);
```

### Key Features
- Excludes PLANNED_TIME type from UI notification counts
- Clears stale notifications on fetch errors
- Indexed by taskId for efficient lookups
- Properly cleans up IPC listeners on component unmount

## NotificationListener Pattern

`NotificationListener.vue` is a non-visible component that handles system notification clicks:

```javascript
// NotificationListener.vue
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

export default {
  setup() {
    const router = useRouter();
    const store = useStore();
    const wrappedListener = ref(null);

    onMounted(() => {
      wrappedListener.value = window.electron.receive(
        'notification:received',
        async ({ taskId, projectId }) => {
          // Select the project
          await store.dispatch('projects/setCurrent', projectId);

          // Navigate to Home route
          router.push({ name: 'Home' });

          // Task is now focused and visible
        }
      );
    });

    onBeforeUnmount(() => {
      // Clean up listener to prevent memory leaks
      window.electron.removeListener('notification:received', wrappedListener.value);
    });

    return {}; // No UI
  }
};
```

### Key Pattern Elements
1. **Non-visible component**: Template is empty or minimal
2. **Stores wrapped listener**: Maintains reference for cleanup
3. **Proper cleanup**: Removes listener in `onBeforeUnmount`
4. **Cross-component interaction**: Updates store and router

## Smart Projects Pattern

Smart projects are virtual collections based on computed filters (no separate database table).

### Components
- `TodaySmartProject.vue` - Shows tasks due today
- `OverdueSmartProject.vue` - Shows overdue tasks
- `SmartProjectBase.vue` - Abstract base with shared logic
- `useLocalTodayDate.js` - Composable providing reactive local date

### Auto-Refresh After Midnight

```javascript
import { ref, onMounted, onUnmounted } from 'vue';

export function useLocalTodayDate() {
  const today = ref(getLocalTodayDate());
  let refreshTimer = null;

  const scheduleRefresh = () => {
    const tomorrow = new Date(today.value);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 1, 0); // 1 second after midnight

    const timeUntilMidnight = tomorrow.getTime() - Date.now();
    refreshTimer = setTimeout(() => {
      today.value = getLocalTodayDate();
      scheduleRefresh(); // Reschedule for next day
    }, timeUntilMidnight);
  };

  onMounted(() => scheduleRefresh());
  onUnmounted(() => clearTimeout(refreshTimer));

  return { today };
}
```

**Key benefit**: Smart projects update their "today" date automatically after local midnight, so views stay current even if no task data changes.

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
      mainWindow.webContents.send('entity:refresh');  // Trigger UI update
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - methodName');
      return false;
    }
  });
}
```

### Critical Security Rule

**Never use `ipcMain.emit()` for renderer communication** - it bypasses context isolation.

```javascript
// ❌ WRONG - Bypasses context isolation
ipcMain.emit('notifications:changed', { taskId });

// ✅ CORRECT - Respects context isolation
mainWindow.webContents.send('notifications:changed', { taskId });
```

## Component Listener Cleanup Pattern

When components listen to IPC events, always clean up on unmount:

```javascript
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  setup() {
    const wrappedListener = ref(null);

    onMounted(() => {
      // Store wrapped reference for cleanup
      wrappedListener.value = window.electron.receive(
        'some:event',
        (data) => { /* handle event */ }
      );
    });

    onBeforeUnmount(() => {
      // Clean up to prevent memory leaks
      window.electron.removeListener('some:event', wrappedListener.value);
    });
  }
};
```

**Why wrap the listener?** The wrapper maintains a stable reference that can be removed later.

## Related Documentation

- [AI_INTEGRATION.md](./AI_INTEGRATION.md) - AI function handler architecture
- [IPC_PATTERNS.md](./IPC_PATTERNS.md) - IPC communication patterns
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - Vuex store architecture
- [../AGENTS.md](../AGENTS.md) - Project overview and key reference files
