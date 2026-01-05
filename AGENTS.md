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

**Always run `npm run test` and `npm run electron:dev` at the end of your work to verify changes.**

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
- `/app/src/services/functionSchemas.js` - OpenAI function definitions

### Data Layer Architecture

**Models** (`src/models/`): Handle data transformation between database (snake_case) and application (camelCase). Every model has `toDatabase()` and `fromDatabase()` methods.

**Services** (`src/services/`): Singleton business logic classes. Services use models for validation and transformation.

**Database**: SQLite with `better-sqlite3`. Schema in `database/schema.js` with migrations in `database/migrations/`.

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

**Known inefficiency**: Stores refetch entire lists after CRUD operations. Consider optimistic updates or targeted fetches for performance.

### Smart Projects Pattern

Virtual collections based on computed filters (no separate database table):
- `TodaySmartProject.vue` - Shows tasks due today
- `OverdueSmartProject.vue` - Shows overdue tasks
- `SmartProjectBase.vue` - Abstract base with shared logic

## Database Schema

```sql
projects (id, name, description, created_at, updated_at)
tasks (id, name, description, duration, due_date, planned_time,
       project_id, dependencies, status, labels, priority,
       created_at, updated_at)
notifications (id, task_id, time, type, message, created_at)
recurrence_rules (id, task_id, frequency, interval, end_date, count, created_at)
```

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

### AI Function Addition Pattern
1. Add schema to `functionSchemas.js`
2. Implement handler in `functionHandlers.js`
3. AI service routes call to handler automatically

## Known Issues to Address

From `/doc/review.md`:
1. **Transaction integrity**: Project deletion lacks atomic transactions (use `better-sqlite3` transactions)
2. **Redundant deletion**: Manual deletion loops exist despite `ON DELETE CASCADE` constraints
3. **getRecentTasks logic**: Based on due_date, not completion date (consider adding `completedAt` timestamp)
4. **Circular dependency risk**: Between `project.js` and `task.js` services
5. **IPC coupling**: Many individual functions vs. generic invoke pattern in preload
6. **Event listener cleanup**: Manual management is error-prone (consider `useIpcListener` composable)
7. **Mixed logic in UI**: Presentation/business logic mixed in components (move to models/composables)

## Logging

Use `electron-log` for all logging (never `console.log`):
- Main process: `import logger from './electron-main/logger.js'`
- Renderer: `import logger from './services/logger.js'`
- Methods: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.logError(error, context)`

## Key Reference Files

- `/app/electron.js` - Main process entry
- `/app/preload.cjs` - IPC security bridge
- `/app/electron-main/aiService.js` - AI orchestration
- `/app/database/schema.js` - Database schema
- `/app/src/store/index.js` - Root store
- `/app/AGENTS.md` - Detailed AI assistant guide
