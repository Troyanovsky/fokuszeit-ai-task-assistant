/**
 * Function schemas for AI function calling
 */
export const functionSchemas = [
  {
    type: 'function',
    function: {
      name: 'addTask',
      description: 'Add a new task to the system',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name/title of the task',
          },
          description: {
            type: 'string',
            description: 'A detailed description of the task',
          },
          duration: {
            type: 'number',
            description: 'Estimated duration in minutes',
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description:
              'Due date for the task. Provide in the following date-only format `YYYY-MM-DD`.',
          },
          plannedTime: {
            type: 'string',
            format: 'date-time',
            description:
              "Planned time to work on the task. Provide in user's local time zone in a readable format like 'YYYY-MM-DD HH:MM'.",
          },
          projectId: {
            type: 'string',
            description: 'ID of the project this task belongs to',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level of the task',
          },
          status: {
            type: 'string',
            enum: ['planning', 'doing', 'done'],
            description: 'Current status of the task',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels/tags for the task',
          },
        },
        required: ['name', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateTask',
      description: 'Update an existing task',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the task to update',
          },
          name: {
            type: 'string',
            description: 'The name/title of the task',
          },
          description: {
            type: 'string',
            description: 'A detailed description of the task',
          },
          duration: {
            type: 'number',
            description: 'Estimated duration in minutes',
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description:
              'Due date for the task. Provide in the following date-only format `YYYY-MM-DD`.',
          },
          plannedTime: {
            type: 'string',
            format: 'date-time',
            description:
              "Planned time to work on the task. Provide in the following format: 'YYYY-MM-DD HH:MM'.",
          },
          projectId: {
            type: 'string',
            description: 'ID of the project this task belongs to',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level of the task',
          },
          status: {
            type: 'string',
            enum: ['planning', 'doing', 'done'],
            description: 'Current status of the task',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels/tags for the task',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTask',
      description: 'Delete a task',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the task to delete',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'queryTasks',
      description: 'Retrieve a list of tasks based on various filter criteria and limit',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'A list of specific task IDs to retrieve',
          },
          nameContains: {
            type: 'string',
            description: 'Filter tasks where the name contains this substring (case-insensitive)',
          },
          descriptionContains: {
            type: 'string',
            description:
              'Filter tasks where the description contains this substring (case-insensitive)',
          },
          projectIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter tasks belonging to one or more specified project IDs',
          },
          statuses: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['planning', 'doing', 'done'],
            },
            description: 'Filter tasks by one or more statuses',
          },
          priorities: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            description: 'Filter tasks by one or more priority levels',
          },
          dueDateStart: {
            type: 'string',
            format: 'date',
            description: 'Filter tasks with a due date on or after this date',
          },
          dueDateEnd: {
            type: 'string',
            format: 'date',
            description: 'Filter tasks with a due date on or before this date',
          },
          plannedTimeStart: {
            type: 'string',
            format: 'date-time',
            description: 'Filter tasks with a planned time on or after this date/time',
          },
          plannedTimeEnd: {
            type: 'string',
            format: 'date-time',
            description: 'Filter tasks with a planned time on or before this date/time.',
          },
          limit: {
            type: 'number',
            default: 20,
            description: 'Maximum number of tasks to return',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProjects',
      description: 'Get all projects',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addProject',
      description: 'Add a new project',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the project',
          },
          description: {
            type: 'string',
            description: 'A description of the project',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateProject',
      description: 'Update an existing project',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the project to update',
          },
          name: {
            type: 'string',
            description: 'The name of the project',
          },
          description: {
            type: 'string',
            description: 'A description of the project',
          },
        },
        required: ['id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteProject',
      description: 'Delete a project',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the project to delete',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addNotification',
      description: 'Add a new notification for a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task this notification is for',
          },
          time: {
            type: 'string',
            format: 'date-time',
            description:
              "Time when the notification should trigger. Provide in a standard format like 'YYYY-MM-DD', '5/31/2023 15:30', or 'May 31, 2023 15:30'. The system will convert to proper format.",
          },
          type: {
            type: 'string',
            enum: ['reminder', 'due_date', 'status_change', 'PLANNED_TIME'],
            description: 'Type of notification',
          },
          message: {
            type: 'string',
            description:
              'Custom message for the notification (optional, a default will be used if not provided)',
          },
        },
        required: ['taskId', 'time', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateNotification',
      description: 'Update an existing notification',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the notification to update',
          },
          taskId: {
            type: 'string',
            description: 'ID of the task this notification is for',
          },
          time: {
            type: 'string',
            format: 'date-time',
            description:
              "Time when the notification should trigger. Provide in a standard format like '5/31/2023 15:30', or 'May 31, 2023 15:30'. The system will convert to proper format.",
          },
          type: {
            type: 'string',
            enum: ['reminder', 'due_date', 'status_change', 'PLANNED_TIME'],
            description: 'Type of notification',
          },
          message: {
            type: 'string',
            description: 'Custom message for the notification',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteNotification',
      description: 'Delete a notification',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the notification to delete',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'queryNotifications',
      description: 'Retrieve a list of notifications based on various filter criteria and limit',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'A list of specific notification IDs to retrieve',
          },
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter notifications associated with one or more specified task IDs',
          },
          timeStart: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notifications scheduled to trigger on or after this time',
          },
          timeEnd: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notifications scheduled to trigger on or before this time',
          },
          limit: {
            type: 'number',
            default: 20,
            description: 'Maximum number of notifications to return',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setTaskRecurrence',
      description:
        'Add or update a recurrence rule for a task. This makes the task repeat on a schedule.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to set recurrence for',
          },
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
            description:
              'How often the task repeats. daily = every day(s), weekly = every week(s), monthly = every month(s), yearly = every year(s)',
          },
          interval: {
            type: 'number',
            description:
              'The interval multiplier for the frequency. For example: interval=2 with frequency=weekly means "every 2 weeks". Default is 1.',
            default: 1,
          },
          endDate: {
            type: 'string',
            format: 'date',
            description:
              'Optional end date (YYYY-MM-DD format). The recurrence will stop creating new tasks after this date. If not provided, recurrence continues indefinitely or until count is reached.',
          },
          count: {
            type: 'number',
            description:
              'Optional maximum number of occurrences. The recurrence will stop after creating this many tasks. If not provided, recurrence continues indefinitely or until endDate is reached.',
          },
        },
        required: ['taskId', 'frequency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeTaskRecurrence',
      description: 'Remove recurrence from a task. The task will no longer repeat.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to remove recurrence from',
          },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTaskRecurrence',
      description:
        'Get the recurrence rule details for a task. Returns information about how the task repeats.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to get recurrence details for',
          },
        },
        required: ['taskId'],
      },
    },
  },
];

export default functionSchemas;
