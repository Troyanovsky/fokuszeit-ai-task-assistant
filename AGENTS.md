# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

FokusZeit is an AI-powered task management desktop application built with Electron + Vue 3. Users interact with an AI assistant via natural language to create, modify, query, and organize tasks and projects. The AI uses OpenAI-compatible function calling to translate natural language into structured database operations.

## Development Commands

```bash
cd app  # All commands run from the app/ directory

# Development
npm run dev              # Start Vite dev server (port 5173)
npm run electron:dev     # Start Electron with hot reload

# Production
npm run build            # Build frontend assets
npm run electron:build   # Package Electron app

# Testing
npm run test             # Run all tests (Vitest)
npm run test:watch       # Watch mode

# Code Quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
```

**Always run `npm run test` (agent can run) and `npm run electron:dev` (long-running UI process, ask user to run manually) at the end of your work to verify changes.**

## Architecture Overview

### Multi-Process Electron Structure

```
Main Process (electron-main/)    Renderer Process (src/)
├── AI service orchestration     ├── Vue 3 UI components
├── Database operations          ├── Vuex state management
├── IPC request handlers         └── Business logic services
├── System notifications
└── Native integration

Preload Script (preload.cjs)
└── Context-isolated IPC bridge (security layer)
```

Process boundaries: main process modules may import only from `app/electron-main/*` and `app/shared/*`; renderer modules may import only from `app/src/*` and `app/shared/*`. Shared modules must not depend on process-specific APIs.

### AI Integration Flow

1. User sends message via chat interface
2. `aiService.js` builds context-aware prompt with system role, projects, datetime, chat history, and function schemas
3. LLM returns structured function calls with arguments
4. `functionHandlers.js` dispatches to service methods
5. Results sent back to LLM for natural language response
6. UI updates triggered via IPC events

**Key files for AI changes:**
- `/app/electron-main/aiService.js` - AI orchestration and LLM calls
- `/app/electron-main/functionHandlers.js` - Function call implementations
- `/app/electron-main/ipcHandlers.js` - Consolidated IPC request handlers
- `/app/electron-main/services/functionSchemas.js` - OpenAI function definitions

### Data Layer Architecture

**Models** (`shared/models/`): Handle data transformation between database (snake_case) and application (camelCase). Every model has `toDatabase()` and `fromDatabase()` methods.

- `Project.js` - Project entity
- `Task.js` - Task entity with dependencies and labels
- `Notification.js` - Notification entity with type constants
- `RecurrenceRule.js` - Recurrence rule entity

**Services** (`electron-main/services/`): Singleton business logic classes. Services use models for validation and transformation.

- `project.js` - Project CRUD operations
- `task.js` - Task CRUD and scheduling operations
- `notification.js` - Notification CRUD operations
- `recurrence.js` - Recurrence rule CRUD and task generation
- `preferences.js` - User preferences management
- `dataIntegrity.js` - Data integrity checks and cleanup
- `database.js` - Database connection and query wrapper
- `functionSchemas.js` - OpenAI function definitions for AI

**Database**: SQLite with `better-sqlite3`. Schema in `app/database/schema.js` with migrations in `app/database/migrations/`.

**Utilities** (`shared/utils/`): Shared helper modules:
- `dateTime.js` - Date/time utilities for local calendar dates and UTC timestamps
- `sqliteErrorHandler.js` - SQLite error parsing and structured error responses
- `loggingConfig.js` - Logging configuration
- `loggingSanitizers.js` - Log message sanitization for security
- `logExample.js` - Logging example file

**Shared Logger** (`shared/logger.js`): Process-agnostic logger adapter that routes to appropriate logger (main/renderer).

**Data Integrity** (`electron-main/services/dataIntegrity.js`): Service for checking and maintaining data consistency:
- Finds orphaned tasks, notifications, and recurrence rules
- Validates recurrence rule data
- Provides cleanup utilities for expired/orphaned data

**Critical pattern**: Always use parameterized queries to prevent SQL injection.

### IPC Communication Pattern

**Request flow**: Renderer → `window.electron.method()` → preload → `ipcRenderer.invoke()` → `ipcMain.handle()` → Service → Database

**Event flow** (for UI updates): Main process → `mainWindow.webContents.send()` → Renderer IPC listener → Vuex action → Component reactive update

**Security**: Context isolation + whitelisted channels only. Never bypass preload.

### State Management (Vuex)

Modular store structure with actions triggering IPC calls:
- `store/modules/projects.js` - Project state
- `store/modules/tasks.js` - Task state and filtering
- `store/modules/ai.js` - Chat history
- `store/modules/preferences.js` - User settings
- `store/modules/recurrence.js` - Recurrence state
- `store/modules/notifications.js` - Notification state management (centralized hybrid IPC + store pattern)

**Known inefficiency**: Stores refetch entire lists after CRUD operations. Consider optimistic updates or targeted fetches for performance.

### Smart Projects Pattern

Virtual collections based on computed filters (no separate database table):
- `TodaySmartProject.vue` - Shows tasks due today
- `OverdueSmartProject.vue` - Shows overdue tasks
- `SmartProjectBase.vue` - Abstract base with shared logic

**Note**: Smart projects automatically refresh their local “today” date shortly after local midnight so the
Today/Overdue views update even if no task data changes occur.

### NotificationListener Pattern

`NotificationListener.vue` is a non-visible component that handles system notification clicks:
- Listens for `notification:received` events from main process
- Properly cleans up listeners on unmount (stores wrapped listener reference)
- Focuses tasks by selecting their project and navigating to Home route
- Demonstrates proper IPC event handling pattern

## Database Schema

```sql
projects (id, name, description, created_at, updated_at)
tasks (id, name, description, duration, due_date, planned_time,
       project_id, dependencies, status, labels, priority,
       created_at, updated_at)
notifications (id, task_id, time, type, message, created_at)
recurrence_rules (id, task_id, frequency, interval, end_date, count, created_at)
```

**Date/Time Formats**:
- Date-only fields (`due_date`, `end_date`): `YYYY-MM-DD` (local calendar dates, no timezone semantics)
- Timestamp fields (`created_at`, `updated_at`, `time`, `planned_time`): ISO 8601 in UTC
- See `doc/DATE_TIME_FORMATS.md` for detailed specification and validation strategy

- Foreign keys with CASCADE deletes
- JSON storage for arrays (dependencies, labels)
- Status values: 'planning', 'doing', 'done'

## Code Conventions

**Commit messages**: `<type>(<scope>): <message>`
  - Examples: `feat(tasks): add priority filtering`, `fix(ai): resolve API key issue`

**File naming**:
- Components: PascalCase (`TaskList.vue`)
- Services: camelCase (`taskManager.js`)
- Utilities: camelCase (`dateUtils.js`)

**ESLint limits**: 120 char line length, 80 lines per function (400 for Vue components)

**ESLint enforces ESM**: All `.js` files must use `import` statements; `require()` is restricted. Test files are covered by linting.

## Important Patterns

### Model Pattern
Models transform between database and application formats. Always use `fromDatabase()` when reading from DB and `toDatabase()` before writing.

### IPC Handler Pattern
All main-process operations follow this pattern:
```javascript
ipcMain.handle('channel:name', async (_, data) => {
  try {
    const result = await service.method(data);
    mainWindow.webContents.send('entity:refresh');  // Trigger UI update
    return result;
  } catch (error) {
    logger.logError(error, 'IPC Error - methodName');
    return false;
  }
});
```

**Critical**: Never use `ipcMain.emit()` for renderer communication. It bypasses context isolation. Always use `webContents.send()` from the main process to send events to the renderer.

### AI Function Addition Pattern
1. Add schema to `functionSchemas.js`
2. Implement handler in `functionHandlers.js`
3. AI service routes call to handler automatically

### Notification Store Pattern

Centralized Vuex store for notification state management replaces direct IPC state management in components. Uses hybrid IPC + store approach:

**Store usage in components:**
```javascript
// Batch refresh for all visible tasks
await store.dispatch('notifications/refreshNotificationCounts');

// Fetch notifications for specific task
await store.dispatch('notifications/fetchNotificationsByTask', taskId);

// Get notification count (excludes PLANNED_TIME type from UI display)
const count = store.getters['notifications/notificationCount'](taskId);
```

**IPC event flow (main → renderer):**
- Main process emits: `notifications:changed` (with taskId) or `notifications:refresh`
- Components listen via `window.electron.receive()` then dispatch to store
- Store manages local state; IPC only triggers updates

**Example:**
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

**Key features:**
- Excludes PLANNED_TIME type from UI notification counts
- Clears stale notifications on fetch errors
- Indexed by taskId for efficient lookups
- Properly cleans up IPC listeners on component unmount

## Logging

Use `electron-log` for all logging (never `console.log`):
- Main process: `import logger from './electron-main/logger.js'`
- Main process services: `import logger from '../logger.js'` (direct import, no conditional logic)
- Shared modules: `import logger from '../logger.js'` (uses shared logger adapter)
- Renderer: `import logger from './services/logger.js'`
- Methods: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.logError(error, context)`

**Important**: ESLint enforces ESM imports - `require()` is not allowed in `.js` files.

## Key Reference Files

- `/app/electron.js` - Main process entry
- `/app/preload.cjs` - IPC security bridge
- `/app/electron-main/aiService.js` - AI orchestration
- `/app/electron-main/functionHandlers.js` - AI function call implementations
- `/app/electron-main/ipcHandlers.js` - Consolidated IPC request handlers
- `/app/database/schema.js` - Database schema
- `/app/shared/models/Task.js` - Task model with validation
- `/app/shared/utils/dateTime.js` - Date/time utilities
- `/app/electron-main/services/dataIntegrity.js` - Data integrity checks
- `/app/doc/DATE_TIME_FORMATS.md` - Date/time format specification
