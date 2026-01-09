# AI Integration Architecture

This document describes how AI integration works in FokusZeit, including the function calling architecture and handler registry pattern.

## Overview

FokusZeit uses OpenAI-compatible function calling to translate natural language into structured database operations. Users chat with an AI assistant via the chat interface, and the AI translates requests into function calls that the application executes.

## AI Integration Flow

```
1. User sends message via chat interface
   ↓
2. aiService.js builds context-aware prompt:
   - System role
   - Projects list
   - Current datetime
   - Chat history
   - Function schemas
   ↓
3. LLM returns structured function calls with arguments
   ↓
4. functionHandlers.js → ai-function-handlers/index.js (registry dispatcher)
   ↓
5. Domain-specific handlers execute operations
   ↓
6. Results sent back to LLM for natural language response
   ↓
7. UI updates triggered via IPC events
```

## Key Files

| File | Responsibility |
|------|---------------|
| `/app/electron-main/aiService.js` | AI orchestration and LLM calls |
| `/app/electron-main/functionHandlers.js` | Backward compatibility entry point (re-exports from ai-function-handlers) |
| `/app/electron-main/ai-function-handlers/index.js` | Main dispatcher with registry pattern |
| `/app/electron-main/ai-function-handlers/` | Domain-specific handler modules |
| `/app/electron-main/services/functionSchemas.js` | OpenAI function definitions |

## Handler Registry Pattern

The AI function handlers use a **registry pattern** instead of a large switch statement. This makes it easy to add new functions.

### Registry Structure (`ai-function-handlers/index.js`)

```javascript
const handlerRegistry = {
  // Task handlers
  addTask: { handler: taskHandlers.handleAddTask },
  updateTask: { handler: taskHandlers.handleUpdateTask },
  deleteTask: { handler: taskHandlers.handleDeleteTask },
  getTasks: { handler: taskHandlers.handleGetTasks },
  queryTasks: { handler: handleQueryTasks },
  planDay: { handler: taskHandlers.handlePlanDay },

  // Project handlers
  addProject: { handler: projectHandlers.handleAddProject },
  getProjects: { handler: projectHandlers.handleGetProjects },
  updateProject: { handler: projectHandlers.handleUpdateProject },
  deleteProject: { handler: projectHandlers.handleDeleteProject },

  // Notification handlers
  addNotification: { handler: notificationHandlers.handleAddNotification },
  updateNotification: { handler: notificationHandlers.handleUpdateNotification },
  deleteNotification: { handler: notificationHandlers.handleDeleteNotification },
  getNotifications: { handler: notificationHandlers.handleGetNotifications },
  getNotificationsByTask: { handler: notificationHandlers.handleGetNotificationsByTask },
  queryNotifications: { handler: handleQueryNotifications },

  // Recurrence handlers
  setTaskRecurrence: { handler: recurrenceHandlers.handleSetTaskRecurrence },
  removeTaskRecurrence: { handler: recurrenceHandlers.handleRemoveTaskRecurrence },
  getTaskRecurrence: { handler: recurrenceHandlers.handleGetTaskRecurrence }
};

export async function handleFunctionCall(functionName, args, baseResult) {
  const registration = handlerRegistry[functionName];
  if (!registration) {
    throw new Error(`Function "${functionName}" is not available`);
  }
  return registration.handler(args, baseResult);
}
```

## Domain-Specific Handler Modules

AI function handlers are organized by responsibility in `/app/electron-main/ai-function-handlers/`:

### Utility Modules (`utils/`)
- **dateTimeParsers.js** - Parse and validate date/time arguments from AI
- **projectResolvers.js** - Resolve project names/IDs from arguments
- **responseFormatters.js** - Format success/error responses for AI
- **argumentParsers.js** - Parse and validate common argument patterns

### Domain Handlers
| File | Purpose | Handler Count |
|------|---------|---------------|
| `taskHandlers.js` | Task CRUD and scheduling operations | 5 |
| `projectHandlers.js` | Project CRUD operations | 4 |
| `notificationHandlers.js` | Notification CRUD operations | 5 |
| `recurrenceHandlers.js` | Recurrence rule operations | 3 |

### Query Handlers (`queryHandlers/`)
| File | Purpose | Features |
|------|---------|----------|
| `taskQueryHandler.js` | Complex task filtering | 8 modular filter methods |
| `notificationQueryHandler.js` | Complex notification filtering | 3 modular filter methods |

## Adding a New AI Function

When adding a new AI function handler, follow these steps:

### 1. Add Function Schema

Add the function definition to `/app/electron-main/services/functionSchemas.js`:

```javascript
{
  type: 'function',
  function: {
    name: 'yourNewFunction',
    description: 'Clear description of what the function does',
    parameters: {
      type: 'object',
      properties: {
        // Define parameters following OpenAI schema format
        paramName: {
          type: 'string',
          description: 'Parameter description'
        }
      },
      required: ['paramName']
    }
  }
}
```

### 2. Create Handler Implementation

Add the handler function in the appropriate domain file:

```javascript
// In ai-function-handlers/taskHandlers.js (or appropriate domain file)
export async function handleYourNewFunction(args, baseResult) {
  const result = await taskManager.yourNewFunction(args);
  return { ...baseResult, success: true, ...result };
}
```

### 3. Register Handler

Import and register in `/app/electron-main/ai-function-handlers/index.js`:

```javascript
import * as taskHandlers from './taskHandlers.js';

const handlerRegistry = {
  // ... existing handlers
  yourNewFunction: { handler: taskHandlers.handleYourNewFunction }
};
```

**That's it!** The AI service automatically routes calls to your handler. No changes needed to `aiService.js`.

## Example: Adding a Task Archive Function

```javascript
// 1. In services/functionSchemas.js
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

// 2. In ai-function-handlers/taskHandlers.js
export async function handleArchiveCompletedTasks(args, baseResult) {
  const result = await taskManager.archiveCompletedTasks(args);
  return { ...baseResult, success: true, ...result };
}

// 3. In ai-function-handlers/index.js
import * as taskHandlers from './taskHandlers.js';

const handlerRegistry = {
  // ... existing handlers
  archiveCompletedTasks: { handler: taskHandlers.handleArchiveCompletedTasks }
};
```

## Handler Function Signature

All handler functions follow this signature:

```javascript
/**
 * Handle an AI function call.
 *
 * @param {Object} args - Parsed arguments from the AI function call
 * @param {Object} baseResult - Base result object with metadata
 * @returns {Promise<Object>} - Result object with success status and data
 */
export async function handleFunctionName(args, baseResult) {
  // Execute operation
  const result = await someService.someMethod(args);

  // Return combined result
  return {
    ...baseResult,
    success: true,
    ...result
  };
}
```

## Error Handling

Handlers should throw errors for failures. The AI service will catch them and:

1. Log the error with context
2. Return an error response to the LLM
3. Allow the LLM to inform the user or retry

```javascript
export async function handleUpdateTask(args, baseResult) {
  const task = await taskManager.getById(args.id);
  if (!task) {
    throw new Error(`Task with ID ${args.id} not found`);
  }

  const updated = await taskManager.update(args);
  return { ...baseResult, success: true, task: updated };
}
```

## Related Documentation

- [DEVELOPMENT_PATTERNS.md](./DEVELOPMENT_PATTERNS.md) - Detailed AI function addition pattern
- [IPC_PATTERNS.md](./IPC_PATTERNS.md) - How AI results trigger UI updates via IPC
- [../AGENTS.md](../AGENTS.md) - Project overview and key reference files
