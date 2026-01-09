# State Management Architecture

This document describes the state management architecture in FokusZeit, including the Vuex store structure, IPC integration patterns, and special patterns like smart projects.

## Overview

FokusZeit uses **Vuex** for centralized state management in the renderer process. The store is organized into modular domains, with actions triggering IPC calls to the main process for data operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Renderer Process                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Vue Components                                              │  │
│  │    │                                                          │  │
│  │    ├─→ Computed getters (read state)                         │  │
│  │    ├─→ Dispatch actions (modify state)                       │  │
│  │    └─→ Watch state changes                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↕                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Vuex Store (/app/src/store/)                                │  │
│  │    │                                                          │  │
│  │    ├─→ modules/projects.js     - Project state               │  │
│  │    ├─→ modules/tasks.js        - Task state                  │  │
│  │    ├─→ modules/ai.js           - Chat history                │  │
│  │    ├─→ modules/preferences.js  - User settings               │  │
│  │    ├─→ modules/recurrence.js   - Recurrence state            │  │
│  │    └─→ modules/notifications.js - Notification state         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↕                                       │
│                         IPC (via preload.cjs)                       │
│                              ↕                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Main Process Services                                       │  │
│  │  - Execute business logic                                    │  │
│  │  - Perform database operations                               │  │
│  │  - Emit events for state updates                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Responsibility |
|------|---------------|
| `/app/src/store/index.js` | Store initialization and configuration |
| `/app/src/store/modules/` | Domain-specific store modules |
| `/app/electron-main/ipc/` | IPC handlers that respond to store actions |

## Store Modules

The Vuex store is organized into domain-specific modules:

### projects.js
- **State**: `projects` array, `currentProject`
- **Actions**: `fetchAll`, `add`, `update`, `delete`, `setCurrent`
- **Getters**: `byId`, `current`, `all`
- **Mutations**: Standard CRUD mutations

### tasks.js
- **State**: `tasks` array (indexed by project ID), `currentTask`
- **Actions**: `fetchByProject`, `add`, `update`, `delete`, `setCurrent`
- **Getters**: `byProject`, `byId`, `current`
- **Mutations**: Standard CRUD mutations
- **Known inefficiency**: Refetches entire list after CRUD operations (could be optimized with targeted updates)

### ai.js
- **State**: `messages` array, `isTyping`, `error`
- **Actions**: `sendMessage`, `clearHistory`
- **Getters**: `conversation`, `lastMessage`
- **Mutations**: Add message, set typing state, set error

### preferences.js
- **State**: User preferences (theme, notification settings, etc.)
- **Actions**: `fetch`, `update`
- **Getters**: Individual preference getters
- **Mutations**: Update preferences

### recurrence.js
- **State**: Recurrence rules indexed by task ID
- **Actions**: `fetchForTask`, `setRule`, `removeRule`
- **Getters**: `byTaskId`
- **Mutations**: Set, remove, clear rules

### notifications.js
- **State**: `notificationCounts` map (taskId → count), `notifications` map
- **Actions**: Specialized for batch refresh and task-specific fetching
- **Getters**: `notificationCount`, `byTaskId`
- **Special behavior**: Excludes PLANNED_TIME type from UI counts

## Hybrid IPC + Store Pattern

The **Notification Store Pattern** demonstrates a hybrid approach where the Vuex store manages local state, but IPC events trigger updates:

```
Main Process              Renderer Process
     │                         │
     │  data changed           │
     ├─────────────────────────┤
     │  notifications:changed  │
     │  (with taskId)          │
     │                         │
     │                  ┌──────┴──────┐
     │                  │ Component   │
     │                  │ listens     │
     │                  └──────┬──────┘
     │                         │
     │                  dispatches to store
     │                         │
     │                  ┌──────┴──────┐
     │                  │ Store       │
     │                  │ updates     │
     │                  │ local state │
     │                  └─────────────┘
```

### Example: Notification Store Pattern

```javascript
// In component onMounted
wrappedNotificationsChangedListener.value = window.electron.receive(
  'notifications:changed',
  async (taskId) => {
    if (taskId) {
      // Refresh specific task's notifications
      await store.dispatch('notifications/fetchNotificationsByTask', taskId);
    } else {
      // Refresh all notification counts
      await store.dispatch('notifications/refreshNotificationCounts');
    }
  }
);

// In component onBeforeUnmount
window.electron.removeListener('notifications:changed', wrappedNotificationsChangedListener.value);

// In template - use getter for reactive count
const count = computed(() =>
  store.getters['notifications/notificationCount'](taskId)
);
```

### Benefits of Hybrid Pattern
- **Performance**: Store caches data locally, reduces IPC calls
- **Reactivity**: Components react to state changes via Vue's reactivity system
- **Flexibility**: IPC triggers updates but doesn't manage state
- **Separation of concerns**: IPC handles communication, store handles state

## Smart Projects Pattern

**Smart Projects** are virtual collections based on computed filters (no separate database table). They automatically refresh their local "today" date after midnight.

### Components
- `TodaySmartProject.vue` - Shows tasks due today
- `OverdueSmartProject.vue` - Shows overdue tasks
- `SmartProjectBase.vue` - Abstract base with shared logic
- `useLocalTodayDate.js` - Composable providing reactive local date

### Auto-Refresh Mechanism

Smart projects use `useLocalTodayDate()` composable:

```javascript
// useLocalTodayDate.js
import { ref, onMounted, onUnmounted } from 'vue';

export function useLocalTodayDate() {
  const today = ref(getLocalTodayDate());
  let refreshTimer = null;

  const scheduleRefresh = () => {
    // Schedule refresh for shortly after midnight
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

### Example: Smart Project Base Component

```javascript
// SmartProjectBase.vue
import { useLocalTodayDate } from './useLocalTodayDate.js';

export default {
  setup() {
    const { today } = useLocalTodayDate();

    const tasks = computed(() => {
      // Filter tasks based on today's date
      return allTasks.value.filter(task => {
        const taskDueDate = parseLocalDate(task.dueDate);
        return isTaskDueOn(taskDueDate, today.value);
      });
    });

    return { tasks, today };
  }
};
```

## Standard Store Usage Pattern

### Reading State (Getters)

```javascript
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
  setup() {
    const store = useStore();

    const projects = computed(() => store.getters['projects/all']);
    const currentProject = computed(() => store.getters['projects/current']);

    const tasks = computed(() => store.getters['tasks/byProject'](projectId));
    const taskCount = computed(() => tasks.value.length);

    return { projects, currentProject, tasks, taskCount };
  }
};
```

### Modifying State (Actions)

```javascript
import { useStore } from 'vuex';

export default {
  setup() {
    const store = useStore();

    const addTask = async (taskData) => {
      await store.dispatch('tasks/add', taskData);
      // Store action triggers IPC call, which updates database
      // Main process emits event, store refetches, UI updates
    };

    const updateTask = async (task) => {
      await store.dispatch('tasks/update', task);
    };

    return { addTask, updateTask };
  }
};
```

## IPC Event Handling in Components

Components typically listen to IPC events in `onMounted` and clean up in `onBeforeUnmount`:

```javascript
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  setup() {
    const wrappedListener = ref(null);

    onMounted(() => {
      wrappedListener.value = window.electron.receive(
        'tasks:changed',
        async (projectId) => {
          await store.dispatch('tasks/fetchByProject', projectId);
        }
      );
    });

    onBeforeUnmount(() => {
      if (wrappedListener.value) {
        window.electron.removeListener('tasks:changed', wrappedListener.value);
      }
    });
  }
};
```

## Known Inefficiencies

### Store Refetch Pattern
Currently, stores refetch entire lists after CRUD operations. This is simple but inefficient:

```javascript
// Current approach (simple but inefficient)
async add({ commit }, taskData) {
  const result = await window.electron.addTask(taskData);
  commit('ADD_TASK', result);
  await this.dispatch('tasks/fetchByProject', taskData.projectId); // Refetches all
}
```

**Potential optimization**: Use optimistic updates or targeted fetches for better performance.

## Related Documentation

- [IPC_PATTERNS.md](./IPC_PATTERNS.md) - How the store communicates with main process via IPC
- [DEVELOPMENT_PATTERNS.md](./DEVELOPMENT_PATTERNS.md) - Notification store and smart project patterns
- [../AGENTS.md](../AGENTS.md) - Project overview and key reference files
