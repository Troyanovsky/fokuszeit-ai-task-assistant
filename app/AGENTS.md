# FokusZeit AI Task Assistant

## Project Overview

FokusZeit is a desktop application built with Electron + Vue 3 that integrates AI functionality for task management. The application helps users manage projects and tasks, supporting intelligent task planning, recurring task management, and notification reminder features.

### Core Technology Stack

- **Frontend Framework**: Vue 3 + Vue Router + Vuex
- **Desktop Application**: Electron 36
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
- **AI Integration**: OpenAI-compatible API
- **Testing Framework**: Vitest + Vue Test Utils
- **Code Standards**: ESLint + Prettier

### Application Architecture

```
├── electron-main/          # Electron main process code
│   ├── aiService.js        # AI service integration
│   ├── functionHandlers.js # AI function call handlers
│   ├── ipcHandlers.js      # IPC communication handlers
│   └── logger.js           # Logging service
├── src/                    # Renderer process code
│   ├── components/         # Vue components
│   │   ├── ai/            # AI chat components
│   │   ├── projects/      # Project management components
│   │   ├── recurrence/    # Recurring task components
│   │   ├── smart/         # Smart project components
│   │   ├── system/        # System components
│   │   └── tasks/         # Task management components
│   ├── models/            # Data models
│   ├── router/            # Router configuration
│   ├── services/          # Business service layer
│   ├── store/             # Vuex state management
│   ├── utils/             # Utility functions
│   └── views/             # Page views
└── database/              # Database related
    ├── schema.js          # Database schema
    └── migrations/        # Database migrations
```

## Building and Running

### Development Environment

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start Electron in development mode
npm run electron:dev
```

### Production Build

```bash
# Build frontend assets
npm run build

# Build Electron application
npm run electron:build
```

### Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Code Standards

```bash
# Code linting and auto-fix
npm run lint

# Code formatting
npm run format
```

## Database Schema

The application uses SQLite database with the following main tables:

### Projects Table
- `id`: Primary key
- `name`: Project name
- `description`: Project description
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

### Tasks Table
- `id`: Primary key
- `name`: Task name
- `description`: Task description
- `duration`: Task duration in minutes
- `due_date`: Due date
- `planned_time`: Planned time
- `project_id`: Associated project ID
- `dependencies`: Task dependencies (JSON array)
- `status`: Task status (planning/doing/done)
- `labels`: Labels (JSON array)
- `priority`: Priority level (low/medium/high)
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

### Notifications Table
- `id`: Primary key
- `task_id`: Associated task ID
- `time`: Notification time
- `type`: Notification type (REMINDER/PLANNED_TIME)
- `message`: Notification message
- `created_at`: Creation timestamp

### Recurrence Rules Table
- `id`: Primary key
- `task_id`: Associated task ID
- `frequency`: Recurrence frequency
- `interval`: Recurrence interval
- `end_date`: End date
- `count`: Number of occurrences
- `created_at`: Creation timestamp

## Core Features

### 1. Project Management
- Create, edit, delete projects
- Project task grouping
- Project progress tracking

### 2. Task Management
- Task creation and editing
- Task status management (planning/doing/done)
- Task priority settings
- Task dependencies
- Task labeling system

### 3. Smart Projects
- Today's Tasks: Shows tasks for the current day
- Overdue Tasks: Shows overdue tasks
- AI-assisted task planning and optimization

### 4. Recurring Tasks
- Support for multiple recurrence patterns
- Automatic generation of recurring task instances
- Recurrence rule management

### 5. AI Integration
- Intelligent assistant based on OpenAI GPT-4o-mini
- Task planning and optimization suggestions
- Natural language interaction interface
- Function call support (task creation, queries, etc.)

### 6. Notification System
- Task reminder notifications
- Planned time notifications
- System-level notification integration

## Development Conventions

### Code Style
- Use ESLint + Prettier for code standard management
- Vue components use multi-word naming (PascalCase)
- JavaScript uses ES6+ syntax
- Code line length limit: 120 characters
- Function line limit: 80 lines (Vue components: 400 lines)

### File Naming Conventions
- Component files: PascalCase (e.g., `ProjectList.vue`)
- Service files: camelCase (e.g., `projectService.js`)
- Utility files: camelCase (e.g., `dateUtils.js`)
- Constant files: UPPER_SNAKE_CASE (e.g., `API_CONSTANTS.js`)

### Git Commit Convention
Commit message format: `<imperative verb>(<scope>): <message>`

Examples:
- `feat(tasks): add task priority feature`
- `fix(ai): resolve API key validation issue`
- `docs(readme): update installation instructions`

### Testing Conventions
- Unit test files in the same directory as source files with `.test.js` suffix
- Test files placed in `__tests__` directories
- Use Vitest as test runner
- Test coverage requirement: 80%+ for core functionality

### State Management
- Use Vuex for global state management
- Divide store by functional modules (projects,tasks,ai,preferences,recurrence)
- Use actions for async operations
- Use mutations for state changes
- Use getters for computed derived state

### Component Development Standards
- Use Vue 3 Composition API
- Component props must specify types and defaults
- Use emits to explicitly define component events
- Avoid direct prop modification in components
- Use computed properties for complex template logic

## AI Functionality Integration

### AI Service Configuration
- API keys stored in electron-store
- Support for custom API endpoints and models
- Default uses OpenAI GPT-4o-mini model

### Function Call Support
AI assistant supports the following function calls:
- Create tasks
- Query tasks
- Update task status
- Create projects
- Query project information

### Chat History Management
- Chat history persistent storage
- Context-aware conversations
- Automatic cleanup of expired history

## Deployment and Distribution

### Build Requirements
- Node.js 18+
- npm 9+
- Supported platforms: Windows, macOS, Linux

### Packaging Configuration
- Use electron-builder for application packaging
- Automatic installer generation
- Support for auto-update functionality

## Security Considerations

- API keys encrypted local storage
- Context isolation and preload script security
- Input validation and sanitization
- SQL injection protection (using parameterized queries)

## Performance Optimization

- Virtual scrolling for large task lists
- Component lazy loading
- Database query optimization
- Image and resource compression

## Troubleshooting

### Common Issues
1. **Development server startup failure**: Check if port 5173 is occupied
2. **AI functionality unavailable**: Verify API key configuration and network connection
3. **Database errors**: Check database file permissions and disk space
4. **Notifications not working**: Confirm system notification permission settings

### Logging System
- Use electron-log for logging
- Log levels: info, warn, error
- Log file location: logs folder in user data directory