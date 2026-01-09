# Implementation Plan: TASK-250627-015 - Refactor Monolithic functionHandlers.js

> **Issue Reference**: See `doc/ISSUES.json` - TASK-250627-015
> **Branch**: `refactor/ai-function-handlers`
> **Created**: 2025-01-09

---

## Issue Summary

**Task ID**: TASK-250627-015
**Title**: Refactor monolithic functionHandlers.js module
**Epic**: Architecture
**Status**: In Progress (passes: false)

**Description**: `app/electron-main/functionHandlers.js` is a 1232-line monolith with multiple responsibilities (validation/parsing/filtering/formatting/tool dispatch). This will become harder to safely extend as more AI functions are added.

---

## Current State Analysis

### File: `app/electron-main/functionHandlers.js` (1232 lines)

**Complexity Warnings**:
- `handleQueryTasks` (205 lines) - ESLint complexity exceeded
- `handleQueryNotifications` (136 lines) - ESLint complexity exceeded
- `handleFunctionCall` dispatcher - 42-case switch statement with complexity warning

**Current Test Coverage**: Only 3 tests (all for recurrence handlers) out of 369 total tests

**Public API**: Single export `handleFunctionCall(functionName, args, baseResult)` used by `aiService.js`

### Identified Responsibilities

1. **Project ID Resolution** - `resolveProjectId()` converts project names to IDs
2. **Date/Time Parsing & Formatting** - `formatToYYYYMMDD`, `parseToISODateTime`, etc.
3. **Recurrence Rule Formatting** - `formatRecurrenceRuleForResponse()`
4. **Task Argument Processing** - `processTaskArguments()` with validation/parsing
5. **Task CRUD Handlers** - 6 handlers including complex `handleQueryTasks`
6. **Project CRUD Handlers** - 4 handlers
7. **Notification CRUD Handlers** - 5 handlers including complex `handleQueryNotifications`
8. **Recurrence Handlers** - 3 handlers with dynamic imports
9. **Main Dispatcher** - 42-case switch statement

---

## Recommended Refactoring Approach

### New Directory Structure

```
app/electron-main/
├── functionHandlers.js                 # Simplified to ~20 lines (backward compatibility)
├── ai-function-handlers/               # NEW: Domain-specific handlers
│   ├── index.js                        # Handler registry & dispatcher (replaces 42-case switch)
│   ├── utils/                          # Shared utilities
│   │   ├── argumentParsers.js         # Argument validation & transformation
│   │   ├── responseFormatters.js      # Standardized response builders
│   │   ├── projectResolvers.js       # Project ID/name resolution
│   │   └── dateTimeParsers.js        # Date/time parsing & AI formatting
│   ├── taskHandlers.js                # 6 task handlers
│   ├── projectHandlers.js             # 4 project handlers
│   ├── notificationHandlers.js        # 5 notification handlers
│   ├── recurrenceHandlers.js          # 3 recurrence handlers
│   └── queryHandlers/                 # Complex query handlers
│       ├── taskQueryHandler.js        # Task filtering & query logic
│       └── notificationQueryHandler.js # Notification filtering & query logic
```

**Rationale**: Mirrors existing IPC pattern (`electron-main/ipc/`) already successfully used in the project.

---

## Implementation Steps

### Phase 1: Extract Utilities (Low Risk) - 2-3 days

**Goal**: Create shared utilities without changing handler behavior.

**Steps**:

1. **Create directory structure**:
   ```bash
   mkdir -p app/electron-main/ai-function-handlers/utils
   mkdir -p app/electron-main/ai-function-handlers/queryHandlers
   mkdir -p app/electron-main/__tests__/functionHandlers/utils
   ```

2. **Extract `dateTimeParsers.js`** (~200 lines):
   - Move `parseToISODateTime`, `formatToYYYYMMDD`, `formatDateToYYYYMMDDLocal`
   - Add `formatTaskForAI`, `formatNotificationForAI`
   - Move `formatRecurrenceRuleForResponse`
   - Create `dateTimeParsers.test.js` (15-20 tests)

3. **Extract `projectResolvers.js`** (~50 lines):
   - Move `resolveProjectId` function
   - Add `resolveProjectIds` for batch resolution
   - Create `projectResolvers.test.js` (5-8 tests)

4. **Extract `responseFormatters.js`** (~80 lines):
   - Create standardized response builders:
     - `buildTaskResponse`, `buildProjectResponse`, `buildNotificationResponse`
     - `buildRecurrenceResponse`, `buildErrorResponse`, `buildQueryResponse`
   - Create `responseFormatters.test.js` (8-10 tests)

5. **Extract `argumentParsers.js`** (~60 lines):
   - Move `processTaskArguments` function
   - Add `validateFrequency`, `validateNotificationType`
   - Create `argumentParsers.test.js` (10-15 tests)

6. **Update imports** in `functionHandlers.js` to use new utilities
7. **Verify**: All 369 tests passing

---

### Phase 2: Extract Simple Handlers (Low-Medium Risk) - 2-3 days

**Goal**: Move handlers to domain-specific modules.

**Steps**:

1. **Create `projectHandlers.js`** (~150 lines):
   - Extract 4 handlers: `handleAddProject`, `handleGetProjects`, `handleUpdateProject`, `handleDeleteProject`
   - Create `projectHandlers.test.js` (15-20 tests)

2. **Create `taskHandlers.js`** (~250 lines):
   - Extract 5 handlers: `handleAddTask`, `handleUpdateTask`, `handleDeleteTask`, `handleGetTasks`, `handlePlanDay`
   - Create `taskHandlers.test.js` (20-25 tests)

3. **Create `notificationHandlers.js`** (~200 lines):
   - Extract 5 handlers: `handleAddNotification`, `handleUpdateNotification`, `handleDeleteNotification`, `handleGetNotifications`, `handleGetNotificationsByTask`
   - Create `notificationHandlers.test.js` (20-25 tests)

4. **Update imports** in main `functionHandlers.js`
5. **Verify**: All 369 tests passing

---

### Phase 3: Extract Complex Query Handlers (Medium Risk) - 3-4 days

**Goal**: Break down complex handlers into focused methods.

**Steps**:

1. **Create `queryHandlers/taskQueryHandler.js`** (~250 lines):
   - Extract `handleQueryTasks` (205 lines) into `TaskQueryHandler` class
   - Break into 8 filter methods:
     - `filterByIds`, `filterByNameContains`, `filterByDescriptionContains`
     - `filterByProjectIds`, `filterByStatuses`, `filterByPriorities`
     - `filterByDueDateRange`, `filterByPlannedTimeRange`, `applyLimit`, `formatTasks`
   - Main orchestration: ~30 lines
   - Create `taskQueryHandler.test.js` (30-40 tests covering each filter)

2. **Create `queryHandlers/notificationQueryHandler.js`** (~200 lines):
   - Extract `handleQueryNotifications` (136 lines) into `NotificationQueryHandler` class
   - Break into 5 filter methods:
     - `filterByIds`, `filterByTaskIds`, `filterByTimeRange`, `applyLimit`, `formatNotifications`
   - Create `notificationQueryHandler.test.js` (20-25 tests)

3. **Update imports** in main `functionHandlers.js`
4. **Verify**: All 369 tests passing + ~55 new tests = 424+ passing

---

### Phase 4: Extract Recurrence Handlers (Low Risk) - 1 day

**Steps**:

1. **Create `recurrenceHandlers.js`** (~200 lines):
   - Extract 3 handlers: `handleSetTaskRecurrence`, `handleRemoveTaskRecurrence`, `handleGetTaskRecurrence`
   - Use extracted utilities from `dateTimeParsers.js`
   - Expand existing `functionHandlers.test.js` → `recurrenceHandlers.test.js`
   - Add 10-12 more tests (currently only 3)

2. **Verify**: All tests passing, no ESLint warnings

---

### Phase 5: Refactor Dispatcher (Low Risk) - 1-2 days

**Goal**: Replace 42-case switch with registry pattern.

**Steps**:

1. **Create `ai-function-handlers/index.js`** (~100 lines):
   ```javascript
   const handlerRegistry = {
     addTask: { module: './taskHandlers.js', method: 'handleAddTask' },
     updateTask: { module: './taskHandlers.js', method: 'handleUpdateTask' },
     // ... all 19 function mappings
   };

   export async function handleFunctionCall(functionName, args, baseResult) {
     const registration = handlerRegistry[functionName];
     if (!registration) {
       throw new Error(`Function "${functionName}" is not available`);
     }
     const { module, method } = registration;
     const handlerModule = await import(module);
     return handlerModule[method](args, baseResult);
   }
   ```

2. **Simplify `functionHandlers.js`** to ~20 lines:
   ```javascript
   /**
    * Backward compatibility entry point.
    * @deprecated Import from ai-function-handlers/index.js
    */
   export { handleFunctionCall } from './ai-function-handlers/index.js';
   ```

3. **Create `index.test.js`** (5-8 tests for registry)
4. **Verify**: All 450+ tests passing

---

### Phase 6: Cleanup & Documentation - 1 day

**Steps**:

1. **Run linting**: `npm run lint` (verify 0 complexity warnings)
2. **Run formatting**: `npm run format`
3. **Update AGENTS.md**:
   - Document new `ai-function-handlers/` structure
   - Update "Key files for AI changes" section
   - Add pattern documentation for adding new handlers

4. **Integration testing**:
   - Manually test AI chat with all 19 function calls
   - Verify error handling
   - Check performance

---

## Critical Files

### Files to Create:
1. `app/electron-main/ai-function-handlers/index.js` - Main dispatcher
2. `app/electron-main/ai-function-handlers/queryHandlers/taskQueryHandler.js` - Task queries
3. `app/electron-main/ai-function-handlers/queryHandlers/notificationQueryHandler.js` - Notification queries
4. `app/electron-main/ai-function-handlers/utils/dateTimeParsers.js` - Date/time parsing
5. `app/electron-main/ai-function-handlers/utils/responseFormatters.js` - Response builders
6. `app/electron-main/__tests__/functionHandlers/utils/dateTimeParsers.test.js`
7. `app/electron-main/__tests__/functionHandlers/queryHandlers/taskQueryHandler.test.js`
8. `app/electron-main/__tests__/functionHandlers/taskHandlers.test.js`

### Files to Modify:
1. `app/electron-main/functionHandlers.js` - Simplify to re-export
2. `app/AGENTS.md` - Update architecture documentation

---

## Success Criteria

### Code Quality:
- [ ] ESLint complexity warnings: 0 (currently 3)
- [ ] Average function length: < 50 lines
- [ ] Maximum function length: < 80 lines (currently 205)

### Test Coverage:
- [ ] Total tests: 450+ (currently 369)
- [ ] Handler test coverage: 100% (currently 15%)
- [ ] Utility test coverage: 100% (currently 0%)

### Backward Compatibility:
- [ ] All existing tests pass
- [ ] No breaking changes to `handleFunctionCall` API
- [ ] `aiService.js` requires no changes

---

## Estimated Timeline

- **Phase 1**: 2-3 days (utilities)
- **Phase 2**: 2-3 days (simple handlers)
- **Phase 3**: 3-4 days (complex queries)
- **Phase 4**: 1 day (recurrence)
- **Phase 5**: 1-2 days (dispatcher)
- **Phase 6**: 1 day (cleanup)

**Total**: 10-14 days (2-3 weeks)

---

## Rollback Strategy

- Git commit after each phase: `git commit -m "refactor(ai-handlers): phase N - description"`
- Tag commits: `git tag phase-n-complete`
- If issues arise: `git reset --hard phase-n-complete`
- Always verify: all 369 tests passing before proceeding

---

## Branch Information

**Current Branch**: `refactor/ai-function-handlers`
**Base Branch**: `main`

This branch was created to isolate the refactoring work. Each phase will be committed separately for easy rollback.

---

## Related Documentation

- **Issue Tracker**: `doc/ISSUES.json` - TASK-250627-015
- **Architecture Guide**: `AGENTS.md` - AI Integration section
- **Deep Dive Analysis**: See `functionHandlers.js` comments for current responsibility breakdown
