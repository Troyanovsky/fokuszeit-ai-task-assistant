# Code Review Findings

This document outlines the findings from a comprehensive review of the AI Task Assistant application, covering data models, business logic, UI, and IPC communication.

## 1. Data Layer and Business Logic

This section covers issues related to data models, service-layer logic, and database interactions.

### 1.1. Lack of Transactional Integrity

-   **Problem:** In `project.js`, the `deleteProject` function first deletes all tasks associated with the project and then deletes the project itself. These are separate database operations.
-   **Risk:** If deleting the project fails after the tasks have been deleted, the database will be in an inconsistent state (tasks deleted, but the project remains).
-   **Recommendation:** Use database transactions to ensure that the deletion of a project and its associated tasks is an atomic operation. If any part of the operation fails, the entire transaction should be rolled back. The `better-sqlite3` library supports transactions.

### 1.2. Redundant Deletion Logic

-   **Problem:** The `ON DELETE CASCADE` foreign key constraint in the database schema for `notifications` and `tasks` is a good way to ensure data integrity. However, the application code in `task.js` and `project.js` also manually deletes associated items.
-   **Risk:** This is redundant and could lead to performance issues, especially with a large number of tasks or notifications. The application is doing work that the database can do more efficiently.
-   **Recommendation:** Rely on the `ON DELETE CASCADE` constraint for deleting associated tasks and notifications. The application code can be simplified by removing the manual deletion loops. This will make the code cleaner and more efficient.

### 1.3. Inconsistent Data Handling in Task Model

-   **Problem:** The `Task` model's `dependencies` field is parsed from JSON but not consistently handled. The `update` method in the `Task` model directly assigns the `dependencies` property without validation or ensuring it's an array.
-   **Risk:** This could lead to invalid data being stored in the database if the input is not a valid array.
-   **Recommendation:** In the `Task.js` model, enhance the `update` method to use the `parseDependencies` method, similar to how it's used in the constructor. Add validation to ensure that the dependencies are valid task IDs.

### 1.4. Ambiguous `getRecentTasks` Logic

-   **Problem:** The `getRecentTasks` and `getRecentTasksByProject` methods in `task.js` fetch tasks that are not `DONE` or were `DONE` within the last two days. The logic for "done within the past 2 days" is based on the `due_date`, not the completion date.
-   **Risk:** This logic is confusing. A task could have been completed a week ago, but if its due date was yesterday, it will be included. This is likely not the intended behavior.
-   **Recommendation:** Add a `completedAt` timestamp to the `Task` model, which is set when the task's status changes to `DONE`. The `getRecentTasks` logic should then be based on this `completedAt` field.

### 1.5. Inconsistent Naming Conventions

-   **Problem:** There's an inconsistent use of `project_id` (database format) and `projectId` (JavaScript object format) throughout the services and models. While there is some code to handle this, it's a source of potential bugs.
-   **Risk:** This can lead to errors if the wrong property name is used in a query or an object.
-   **Recommendation:** Standardize on one format within the application (e.g., `projectId`) and only convert to the database format (`project_id`) at the database service layer. The `fromDatabase` and `toDatabase` methods in the models are the right place to handle this transformation.

### 1.6. Circular Dependency Risk

-   **Problem:** There's a potential for a circular dependency between `project.js` and `task.js`. `project.js` imports `task.js` inside `validateProjectDeletion` and `deleteProject` to handle tasks associated with a project. `task.js` doesn't currently import `project.js`, but if it needed to (e.g., to validate a `projectId`), this could become a problem.
-   **Risk:** Circular dependencies can lead to runtime errors and make the code harder to maintain.
-   **Recommendation:** Abstract the shared logic into a third module or use dependency injection to break the cycle. For example, the `deleteProject` function could accept a `taskManager` instance as an argument.

## 2. UI, State Management, and IPC

This section covers issues related to the Vue.js components, Vuex state management, and Electron's Inter-Process Communication.

### 2.1. Inefficient Data Fetching in Vuex

-   **Problem:** The Vuex stores for both projects and tasks (`projects.js`, `tasks.js`) refetch the entire list of items after any CRUD operation (`add`, `update`, `delete`).
-   **Risk:** This is inefficient, especially as the number of projects and tasks grows. It can lead to a sluggish UI and unnecessary network requests.
-   **Recommendation:** Update the Vuex store to handle state changes optimistically or to only fetch the updated/new item and update the state locally. For example, after adding a project, the backend could return the new project object, which can be added to the `state.projects` array directly.

### 2.2. Tightly Coupled IPC Communication

-   **Problem:** The `preload.cjs` script exposes a large number of specific functions on the `window.electron` object. While this is more secure than exposing `ipcRenderer` directly, it creates a tight coupling between the renderer and main processes. The `api` object exposed via `contextBridge` is underutilized.
-   **Risk:** This makes the code harder to maintain and refactor. Any change to an IPC handler name requires changes in `preload.cjs` and all the renderer process files that use it.
-   **Recommendation:** Consolidate the IPC communication to use a more generic `invoke` or `send` method, similar to the `api` object that is already defined. This would involve passing the channel name as an argument rather than having a separate function for each channel.

### 2.3. Duplicated Logic in Components

-   **Problem:** The `ProjectTaskList.vue` component has its own filtering logic that duplicates the filtering logic in the `tasks.js` Vuex store.
-   **Risk:** This can lead to inconsistencies if the filtering logic is updated in one place but not the other.
-   **Recommendation:** Remove the local filtering logic from `ProjectTaskList.vue` and rely on the `filteredTasks` getter from the `tasks.js` Vuex store. The `TaskFilter.vue` component should dispatch an action to the store to update the filter criteria.

### 2.4. Manual and Leaky Event Listeners

-   **Problem:** Event listeners for `tasks:refresh`, `notifications:refresh`, etc., are manually added and removed in the `onMounted` and `onBeforeUnmount` lifecycle hooks in the Vue components. The listeners are also not consistently removed.
-   **Risk:** This is error-prone and can lead to memory leaks if listeners are not removed correctly.
-   **Recommendation:** Create a reusable composable (e.g., `useIpcListener`) that handles the setup and teardown of IPC listeners. This would encapsulate the logic for adding and removing listeners and make the components cleaner.

### 2.5. Mixed Logic in UI Components

-   **Problem:** The `TaskItem.vue` component has a lot of presentation logic mixed with business logic (e.g., formatting dates, calculating overdue status). The `isMissedPlannedTime` prop is passed down from `ProjectTaskList.vue`, which also contains this logic.
-   **Risk:** This makes the `TaskItem.vue` component less reusable and harder to test. The duplication of logic in `ProjectTaskList.vue` is also a concern.
-   **Recommendation:** Move the presentation logic to helper functions or a composable. The business logic (e.g., calculating overdue status) should be part of the `Task` model itself. For example, the `Task` model could have an `isOverdue()` method.

## 3. Notifications

This section covers issues specific to the notification system.

### 3.1. Redundant Notification Click Handling

-   **Problem:** The `NotificationListener.vue` component is responsible for handling `notification:received` events. It has logic to focus on a task when a notification is clicked. However, the `sendNotification` function in `notification.js` also has a click handler for the system notification.
-   **Risk:** This creates two different ways to handle notification clicks, which could lead to inconsistent behavior.
-   **Recommendation:** Consolidate the notification click handling. The `sendNotification` function should emit a single event (e.g., `notification:clicked`) with the `taskId`, and the `NotificationListener.vue` component should be the single source of truth for handling that event.

### 3.2. Inefficient Notification Scheduling

-   **Problem:** In `notification.js`, the `sendNotification` function checks if a task is `DONE` before sending a notification. However, this check happens at the time of sending, not at the time of scheduling. A notification could be scheduled for a task that is later completed.
-   **Risk:** This is a good check, but it could be more efficient. The system might schedule notifications that will never be sent.
-   **Recommendation:** When a task is marked as `DONE`, all its scheduled notifications should be canceled. The `updateTaskStatus` function in `task.js` already has a `_handleNotificationStatusChange` private method that does this, which is great. However, it's worth noting that this is a critical piece of logic to maintain.

## 4. General Recommendations

### 4.1. Error Handling

-   **Problem:** The services (`project.js`, `task.js`) catch errors and log them, but they often return a default value (e.g., an empty array or `false`).
-   **Risk:** The UI layer may not be aware that an operation failed, and the user might see stale or incorrect data.
-   **Recommendation:** Propagate errors up to the Vuex stores, where they can be handled appropriately (e.g., by setting an error state and showing a notification to the user). The Vuex actions should have `try...catch` blocks that commit an error mutation.