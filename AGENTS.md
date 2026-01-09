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

**Process boundaries**: Main process modules may import only from `app/electron-main/*` and `app/shared/*`; renderer modules may import only from `app/src/*` and `app/shared/*`. Shared modules must not depend on process-specific APIs.

## Database Schema

```sql
projects (id, name, description, created_at, updated_at)
tasks (id, name, description, duration, due_date, planned_time,
       project_id, dependencies, status, labels, priority,
       created_at, updated_at)
notifications (id, task_id, time, type, message, created_at)
recurrence_rules (id, task_id, frequency, interval, end_date, count, created_at)
```

**Date/Time Formats**: See `doc/DATE_TIME_FORMATS.md` for detailed specification.

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

**Documentation convention**: AGENTS.md contains essential high-level knowledge for quick onboarding. Detailed reference docs go in `doc/` for deep-dive topics (patterns, architecture, specifications). Add a new `doc/*.md` when a section in AGENTS.md grows beyond ~30 lines or requires detailed examples.

## Detailed Reference Documentation

Essential patterns and architecture details have been extracted to separate docs, read them for more details info related to your task at hand:

| Document | Description |
|----------|-------------|
| [doc/AI_INTEGRATION.md](doc/AI_INTEGRATION.md) | AI service orchestration, function calling, handler registry |
| [doc/IPC_PATTERNS.md](doc/IPC_PATTERNS.md) | Request/event flow, security patterns, domain-specific registrars |
| [doc/STATE_MANAGEMENT.md](doc/STATE_MANAGEMENT.md) | Vuex structure, hybrid IPC+store pattern, smart projects |
| [doc/DEVELOPMENT_PATTERNS.md](doc/DEVELOPMENT_PATTERNS.md) | Model pattern, AI function addition, notification/listener patterns |
| [doc/DATE_TIME_FORMATS.md](doc/DATE_TIME_FORMATS.md) | Date/time format specification and validation strategy |
| [doc/Folder_Structure.md](doc/Folder_Structure.md) | Visual tree representation of project structure |
| [doc/logging.md](doc/logging.md) | Logging system documentation |

## Key Reference Files

### Main Process
- `/app/electron.js` - Main process entry
- `/app/electron-main/aiService.js` - AI orchestration
- `/app/electron-main/functionHandlers.js` - AI function call implementations
- `/app/electron-main/ipcHandlers.js` - Consolidated IPC handler orchestration
- `/app/electron-main/ipc/` - Domain-specific IPC registrar modules

### Data Layer
- `/app/database/schema.js` - Database schema
- `/app/shared/models/Task.js` - Task model with validation
- `/app/shared/utils/dateTime.js` - Date/time utilities
- `/app/electron-main/services/dataIntegrity.js` - Data integrity checks

### Renderer
- `/app/src/components/smart/useLocalTodayDate.js` - Reactive local date composable
- `/app/src/components/tasks/composables/` - Task-related business logic composables
- `/app/src/components/smart/composables/` - Smart project business logic composables
- `/app/preload.cjs` - IPC security bridge

## Critical Patterns

### Model Pattern
Models transform between database and application formats. Always use `fromDatabase()` when reading from DB and `toDatabase()` before writing. See [doc/DEVELOPMENT_PATTERNS.md](doc/DEVELOPMENT_PATTERNS.md).

### AI Function Addition
When adding AI functions, you must: (1) Add schema to `services/functionSchemas.js`, (2) Create handler in appropriate `ai-function-handlers/` file, (3) Register in `ai-function-handlers/index.js`. See [doc/AI_INTEGRATION.md](doc/AI_INTEGRATION.md).

### IPC Security
**Critical**: Never use `ipcMain.emit()` for renderer communication. It bypasses context isolation. Always use `webContents.send()` from the main process. See [doc/IPC_PATTERNS.md](doc/IPC_PATTERNS.md).

### SQL Injection Prevention
**Critical pattern**: Always use parameterized queries to prevent SQL injection.

### Presentation Logic vs Business Logic
**Pattern**: Separate presentation logic from business logic for better testability and reusability.

- **Business logic** belongs in:
  - Models (`app/shared/models/`) - validation, data transformation
  - Composables (`app/src/components/*/composables/`) - reusable business logic
  - Utilities (`app/shared/utils/`) - pure functions

- **Presentation logic** belongs in:
  - Vue components (`app/src/components/`) - UI state, event handlers, template refs

**Key composables for business logic**:
- `app/src/components/tasks/composables/useTaskValidation.js` - Date/time validation
- `app/src/components/tasks/composables/useTaskFormatting.js` - Date/time formatting
- `app/src/components/tasks/composables/useTaskFormTransform.js` - Form data transformation
- `app/src/components/tasks/composables/useTaskFilters.js` - Task filtering
- `app/src/components/smart/composables/useSmartProjectFilters.js` - Smart project filters
- `app/src/components/smart/useTaskSorting.js` - Task sorting comparison functions

**When to extract business logic**:
- Validation or formatting logic used in multiple components
- Complex business rules that can be tested independently
- Data transformation between different representations
- Filtering or sorting algorithms

## Logging

Use `electron-log` for all logging (never `console.log`):
- Main process: `import logger from './electron-main/logger.js'`
- Shared modules: `import logger from '../logger.js'`
- Renderer: `import logger from './services/logger.js'`
- Methods: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.logError(error, context)`

See [doc/logging.md](doc/logging.md) for details.
