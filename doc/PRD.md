# AI Task Assistant

An intelligent application to manage to-do items and calendars by offloading task creation, editing, and planning to AI.

## MVP

### Task Management
- **Basic CRUD operations**
  - Task attributes: name, description, duration, due date, project, dependencies, status (planning/doing/done), labels (if any), priority (low/mid/high), notifications, recurrence
  - Project-based task grouping: A task must belong to a project.
- **AI-accessible task management API**

### AI Capabilities
- **Agentic AI via LLM function-calling**
  - Add, view, edit, remove tasks and projects
  - Daily/ad-hoc prioritization (urgency-based queue)
- **Notifications**

### UI Components
- Left panel: Projects
- Middle: Task List
- Right panel: AI chatbox

### Usage Flow
- User inputs natural langauge task description in chatbox
- User input is formatted into prompt and sent to LLM
- LLM returns actions for modifying the projects and tasks (data) and UI updates to reflect changes.

## V1 Features

- Calendar-based UI for tasks/days
- Voice input for AI
- Enhanced AI features
  - Task breakdown
  - Time estimation
- Other notifications: email
- Keyboard shortcut buttons
- Default list: Input/Backlog
- Planned date for tasks
- Daily progress bar
- Dragging tasks

## Future
- Settings
  - Time zone
  - Time format
  - Start of week
  - Daily workload
  - Daily working time
  - Hide/show completed tasks
  - Light/Dark mode switches
  - Scheduling gap (if any)
  - i18n
  - Alert settings
- Rituals
  - Daily planning time (if any)
  - Daily review time (if any)
  - Weekly planning time (if any)
  - Weekly review time (if any, or combined with planning)
- Focus mode with time tracking
- Integrations