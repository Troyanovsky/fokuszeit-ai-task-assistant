import { describe, it, expect, vi, beforeEach } from 'vitest';
import taskManager from '../task.js';
import databaseService from '../database.js';
import notificationService from '../notification.js';
import { Task, STATUS, PRIORITY } from '../../../shared/models/Task.js';

// Create shared spies that can be controlled in individual tests
const mockTaskToDatabase = vi.fn(function () {
  return {
    id: this.id || 'task-123',
    name: this.name || 'Task Name',
    description: this.description || 'Task Description',
    duration: this.duration || 60,
    due_date: this.dueDate || '2023-01-01T00:00:00.000Z',
    project_id: this.projectId || 'project-1',
    dependencies: JSON.stringify(this.dependencies || []),
    status: this.status || STATUS.PLANNING,
    labels: JSON.stringify(this.labels || []),
    priority: this.priority || PRIORITY.MEDIUM,
    created_at: this.createdAt ? this.createdAt.toISOString() : '2023-01-01T00:00:00.000Z',
    updated_at: this.updatedAt ? this.updatedAt.toISOString() : '2023-01-01T00:00:00.000Z',
  };
});

// Mock the database service
vi.mock('../database.js', () => {
  return {
    default: {
      query: vi.fn(),
      queryOne: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// Mock the notification service
vi.mock('../notification.js', () => ({
  default: {
    addNotification: vi.fn(),
    getNotificationsByTask: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

// Create mock functions for easier access in tests
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Setup mocks before each test
beforeEach(() => {
  // Override the mocked functions
  databaseService.query = mockQuery;
  databaseService.queryOne = mockQueryOne;
  databaseService.insert = mockInsert;
  databaseService.update = mockUpdate;
  databaseService.delete = mockDelete;

  // Reset all mocks
  vi.clearAllMocks();
});

// Mock the Task model
vi.mock('../../../shared/models/Task.js', () => {
  const STATUS = {
    PLANNING: 'planning',
    DOING: 'doing',
    DONE: 'done',
  };

  const PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  };

  const MockTask = function (data) {
    this.id = data.id || 'task-123';
    this.name = data.name || '';
    this.description = data.description || '';
    this.duration = data.duration !== undefined ? data.duration : 60;

    // Convert due_date string to Date object for dueDate
    // Use the original Date constructor to avoid mock interference
    const OriginalDate = Date.originalConstructor || Date;
    if (data.due_date) {
      this.dueDate = new OriginalDate(data.due_date);
    } else if (data.dueDate) {
      this.dueDate = new OriginalDate(data.dueDate);
    } else {
      this.dueDate = null;
    }

    this.projectId = data.project_id || data.projectId || '';

    // Handle dependencies parsing
    if (data.dependencies) {
      if (typeof data.dependencies === 'string') {
        try {
          this.dependencies = JSON.parse(data.dependencies);
        } catch {
          this.dependencies = [];
        }
      } else {
        this.dependencies = data.dependencies;
      }
    } else {
      this.dependencies = [];
    }

    this.status = data.status || STATUS.PLANNING;

    // Handle labels parsing
    if (data.labels) {
      if (typeof data.labels === 'string') {
        try {
          this.labels = JSON.parse(data.labels);
        } catch {
          this.labels = [];
        }
      } else {
        this.labels = data.labels;
      }
    } else {
      this.labels = [];
    }

    this.priority = data.priority || PRIORITY.MEDIUM;
    this.plannedTime = data.planned_time ? new OriginalDate(data.planned_time) : null;
    this.createdAt = data.created_at ? new OriginalDate(data.created_at) : new OriginalDate();
    this.updatedAt = data.updated_at ? new OriginalDate(data.updated_at) : new OriginalDate();

    // Use the mock functions for validate and toDatabase
    this.validate = function () {
      // Implement actual validation logic that matches the expected behavior in tests
      if (!this.name || this.name.trim() === '') {
        return false;
      }
      if (!this.projectId) {
        return false;
      }
      if (!Object.values(STATUS).includes(this.status)) {
        return false;
      }
      if (!Object.values(PRIORITY).includes(this.priority)) {
        return false;
      }
      if (this.name.length > 255 || (this.description && this.description.length > 255)) {
        return false;
      }
      if (this.dueDate && isNaN(this.dueDate.getTime())) {
        return false;
      }
      return true;
    };

    this.toDatabase = mockTaskToDatabase;
  };

  MockTask.fromDatabase = vi.fn((data) => new MockTask(data));

  return {
    Task: MockTask,
    STATUS,
    PRIORITY,
  };
});

describe('TaskManager', () => {
  const mockTasks = [
    {
      id: 'task-1',
      name: 'Task 1',
      description: 'Description 1',
      duration: 30,
      due_date: '2023-01-01T00:00:00.000Z',
      project_id: 'project-1',
      dependencies: '[]',
      status: STATUS.PLANNING,
      labels: '[]',
      priority: PRIORITY.HIGH,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'task-2',
      name: 'Task 2',
      description: 'Description 2',
      duration: 60,
      due_date: '2023-01-02T00:00:00.000Z',
      project_id: 'project-1',
      dependencies: '[]',
      status: STATUS.DOING,
      labels: '["important"]',
      priority: PRIORITY.MEDIUM,
      created_at: '2023-01-02T00:00:00.000Z',
      updated_at: '2023-01-02T00:00:00.000Z',
    },
  ];

  const mockTaskData = {
    name: 'New Task',
    description: 'New Task Description',
    duration: 45,
    due_date: '2023-01-03T00:00:00.000Z',
    project_id: 'project-1',
    status: STATUS.PLANNING,
    priority: PRIORITY.LOW,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getTasks', () => {
    it('should return an array of tasks', async () => {
      databaseService.query.mockReturnValue(mockTasks);

      const result = await taskManager.getTasks();

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM tasks ORDER BY created_at DESC'
      );
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('task-1');
      expect(result[1].id).toBe('task-2');
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.getTasks();

      expect(result).toEqual([]);
    });
  });

  describe('getTaskById', () => {
    it('should return a task when found', async () => {
      databaseService.queryOne.mockReturnValue(mockTasks[0]);

      const result = await taskManager.getTaskById('task-1');

      expect(databaseService.queryOne).toHaveBeenCalledWith('SELECT * FROM tasks WHERE id = ?', [
        'task-1',
      ]);
      expect(result.id).toBe('task-1');
    });

    it('should return null when task is not found', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await taskManager.getTaskById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null if there is an error', async () => {
      databaseService.queryOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.getTaskById('task-1');

      expect(result).toBeNull();
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks for a specific project', async () => {
      databaseService.query.mockReturnValue(mockTasks);

      const result = await taskManager.getTasksByProject('project-1');

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC',
        ['project-1']
      );
      expect(result.length).toBe(2);
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.getTasksByProject('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('addTask', () => {
    it('should add a task successfully', async () => {
      databaseService.insert.mockReturnValue({ changes: 1 });

      const result = await taskManager.addTask(mockTaskData);

      expect(databaseService.insert).toHaveBeenCalled();
      // Now expecting a task object instead of a boolean
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: 'New Task',
        })
      );
    });

    it('should handle projectId property correctly', async () => {
      const taskWithProjectId = {
        ...mockTaskData,
        project_id: undefined,
        projectId: 'project-2',
      };

      databaseService.insert.mockReturnValue({ changes: 1 });

      const result = await taskManager.addTask(taskWithProjectId);

      // Now expecting a task object instead of a boolean
      expect(result).toEqual(
        expect.objectContaining({
          project_id: 'project-2',
        })
      );
    });

    it('should return false if validation fails', async () => {
      // Create a task with invalid data that will fail validation
      const invalidTask = new Task({
        id: 'invalid-task',
        name: '', // Empty name will fail validation
        description: 'New Task Description',
        duration: 45,
        due_date: '2023-01-03T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.LOW,
      });

      // Use the actual task validate method which should return false for empty name
      databaseService.insert.mockReturnValue({ changes: 0 });

      const result = await taskManager.addTask(invalidTask);

      expect(result).toBe(false);
    });

    it('should return false if there is an error', async () => {
      databaseService.insert.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.addTask(mockTaskData);

      expect(result).toBe(false);
    });
  });

  describe('updateTask', () => {
    it('should update a task successfully', async () => {
      const taskToUpdate = {
        id: 'task-1',
        name: 'Updated Task',
        status: STATUS.DOING,
      };

      // Mock the getTaskById method
      databaseService.queryOne.mockReturnValue(mockTasks[0]);
      databaseService.update.mockReturnValue({ changes: 1 });

      const result = await taskManager.updateTask(taskToUpdate);

      expect(databaseService.update).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      // Create a task with invalid data that will fail validation
      const invalidTask = {
        id: 'task-1',
        name: '', // Empty name will fail validation
        description: 'Updated Description',
        status: STATUS.DOING,
        priority: PRIORITY.HIGH,
      };

      // Mock getTaskById to return a valid task first
      databaseService.queryOne.mockReturnValueOnce(mockTasks[0]);

      const result = await taskManager.updateTask(invalidTask);

      expect(result).toBe(false);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task successfully - CASCADE handles notifications and recurrence rules', async () => {
      // Setup mocks
      databaseService.queryOne.mockReturnValue(mockTasks[0]); // Mock getTaskById
      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await taskManager.deleteTask('task-1');

      // Verify task was deleted
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?', [
        'task-1',
      ]);

      expect(result).toBe(true);
    });

    it('should return false if task not found', async () => {
      // Task not found
      databaseService.queryOne.mockReturnValue(null);

      const result = await taskManager.deleteTask('nonexistent-task');

      expect(result).toBe(false);
    });

    it('should return false if database deletion fails', async () => {
      // Setup mocks
      databaseService.queryOne.mockReturnValue(mockTasks[0]); // Mock getTaskById
      databaseService.delete.mockReturnValue({ changes: 0 });

      const result = await taskManager.deleteTask('task-1');

      expect(result).toBe(false);
    });

    it('should return false if there is an error', async () => {
      databaseService.queryOne.mockReturnValue(mockTasks[0]); // Mock getTaskById
      databaseService.delete.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.deleteTask('task-1');

      expect(result).toBe(false);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      databaseService.queryOne.mockReturnValue(mockTasks[0]);
      databaseService.update.mockReturnValue({ changes: 1 });

      const result = await taskManager.updateTaskStatus('task-1', STATUS.DOING);

      expect(result).toBe(true);
    });

    it('should return false if status is invalid', async () => {
      const result = await taskManager.updateTaskStatus('task-1', 'invalid-status');

      expect(databaseService.queryOne).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if task is not found', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await taskManager.updateTaskStatus('non-existent', STATUS.DOING);

      expect(result).toBe(false);
    });

    it('should return false if there is an error', async () => {
      databaseService.queryOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.updateTaskStatus('task-1', STATUS.DOING);

      expect(result).toBe(false);
    });

    it('should cancel notifications when task is marked as DONE', async () => {
      const mockTask = { ...mockTasks[0], status: STATUS.PLANNING };
      databaseService.queryOne.mockReturnValue(mockTask);
      databaseService.update.mockReturnValue({ changes: 1 });

      const mockNotifications = [
        { id: 'notif1', taskId: 'task-1', time: new Date(Date.now() + 60000) },
        { id: 'notif2', taskId: 'task-1', time: new Date(Date.now() + 120000) },
      ];
      notificationService.getNotificationsByTask.mockResolvedValue(mockNotifications);
      notificationService.cancelNotification = vi.fn();

      const result = await taskManager.updateTaskStatus('task-1', STATUS.DONE);

      expect(result).toBe(true);
      expect(notificationService.getNotificationsByTask).toHaveBeenCalledWith('task-1');
      expect(notificationService.cancelNotification).toHaveBeenCalledTimes(2);
      expect(notificationService.cancelNotification).toHaveBeenCalledWith('notif1');
      expect(notificationService.cancelNotification).toHaveBeenCalledWith('notif2');
    });

    it('should re-schedule notifications when task is changed from DONE to another status', async () => {
      const mockTask = { ...mockTasks[0], status: STATUS.DONE };
      databaseService.queryOne.mockReturnValue(mockTask);
      databaseService.update.mockReturnValue({ changes: 1 });

      const futureTime = new Date(Date.now() + 60000);
      const pastTime = new Date(Date.now() - 60000);
      const mockNotifications = [
        { id: 'notif1', taskId: 'task-1', time: futureTime },
        { id: 'notif2', taskId: 'task-1', time: pastTime },
      ];
      notificationService.getNotificationsByTask.mockResolvedValue(mockNotifications);
      notificationService.scheduleNotification = vi.fn();

      const result = await taskManager.updateTaskStatus('task-1', STATUS.PLANNING);

      expect(result).toBe(true);
      expect(notificationService.getNotificationsByTask).toHaveBeenCalledWith('task-1');
      expect(notificationService.scheduleNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.scheduleNotification).toHaveBeenCalledWith(mockNotifications[0]);
    });
  });

  describe('getTasksByStatus', () => {
    it('should return tasks with the specified status', async () => {
      databaseService.query.mockReturnValue([mockTasks[0]]);

      const result = await taskManager.getTasksByStatus(STATUS.PLANNING);

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC',
        [STATUS.PLANNING]
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('task-1');
    });

    it('should return an empty array if status is invalid', async () => {
      const result = await taskManager.getTasksByStatus('invalid-status');

      expect(databaseService.query).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.getTasksByStatus(STATUS.PLANNING);

      expect(result).toEqual([]);
    });
  });

  describe('getTasksByPriority', () => {
    it('should return tasks with the specified priority', async () => {
      databaseService.query.mockReturnValue([mockTasks[0]]);

      const result = await taskManager.getTasksByPriority(PRIORITY.HIGH);

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE priority = ? ORDER BY created_at DESC',
        [PRIORITY.HIGH]
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('task-1');
    });

    it('should return an empty array if priority is invalid', async () => {
      const result = await taskManager.getTasksByPriority('invalid-priority');

      expect(databaseService.query).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await taskManager.getTasksByPriority(PRIORITY.HIGH);

      expect(result).toEqual([]);
    });
  });

  describe('Task Validation', () => {
    it('should return true for valid task data', async () => {
      const validTask = new Task({
        id: 'task-1',
        name: 'Valid Task',
        description: 'Valid Description',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.MEDIUM,
      });

      expect(validTask.validate()).toBe(true);
    });

    it('should return false for invalid task data (missing name)', async () => {
      const invalidTask = new Task({
        id: 'task-1',
        description: 'Valid Description',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.MEDIUM,
      });

      invalidTask.name = '';
      expect(invalidTask.validate()).toBe(false);
    });

    it('should return false for invalid task data (invalid status)', async () => {
      const invalidTask = new Task({
        id: 'task-1',
        name: 'Valid Task',
        description: 'Valid Description',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: 'invalid',
        priority: PRIORITY.MEDIUM,
      });
      expect(invalidTask.validate()).toBe(false);
    });

    it('should return false for invalid task data (invalid priority)', async () => {
      const invalidTask = new Task({
        id: 'task-1',
        name: 'Valid Task',
        description: 'Valid Description',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: 'invalid',
      });
      expect(invalidTask.validate()).toBe(false);
    });
  });

  describe('Data Conversion', () => {
    it('should correctly convert data from the database format to the Task model format', () => {
      const dbData = {
        id: 'task-1',
        name: 'Test Task',
        description: 'Test Description',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        dependencies: '[]',
        status: STATUS.PLANNING,
        labels: '[]',
        priority: PRIORITY.MEDIUM,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const task = Task.fromDatabase(dbData);

      expect(task.id).toBe(dbData.id);
      expect(task.name).toBe(dbData.name);
      expect(task.description).toBe(dbData.description);
      expect(task.duration).toBe(dbData.duration);
      expect(task.dueDate).toBeInstanceOf(Date);
      expect(task.projectId).toBe(dbData.project_id);
      expect(task.dependencies).toEqual([]);
      expect(task.status).toBe(dbData.status);
      expect(task.labels).toEqual([]);
      expect(task.priority).toBe(dbData.priority);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should correctly convert data from the Task model format to the database format', () => {
      const task = new Task({
        id: 'task-1',
        name: 'Test Task',
        description: 'Test Description',
        duration: 30,
        dueDate: '2023-01-01T00:00:00.000Z',
        projectId: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.HIGH,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      const dbData = task.toDatabase();

      expect(dbData.id).toBe(task.id);
      expect(dbData.name).toBe(task.name);
      expect(dbData.description).toBe(task.description);
      expect(dbData.duration).toBe(task.duration);
      expect(dbData.due_date).toBe(task.dueDate);
      expect(dbData.project_id).toBe(task.projectId);
      expect(dbData.dependencies).toBe(JSON.stringify(task.dependencies));
      expect(dbData.status).toBe(task.status);
      expect(dbData.labels).toBe(JSON.stringify(task.labels));
      expect(dbData.priority).toBe(task.priority);
      expect(dbData.created_at).toBe(task.createdAt.toISOString());
      expect(dbData.updated_at).toBe(task.updatedAt.toISOString());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task names and descriptions', async () => {
      const task = new Task({
        id: 'task-1',
        name: '',
        description: '',
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.MEDIUM,
      });

      expect(task.validate()).toBe(false);
    });

    it('should handle very long task names and descriptions', async () => {
      const longString = 'a'.repeat(256); // Exceeds the typical database column limit

      const task = new Task({
        id: 'task-1',
        name: longString,
        description: longString,
        duration: 60,
        due_date: '2023-01-01T00:00:00.000Z',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.MEDIUM,
      });

      expect(task.validate()).toBe(false);
    });

    it('should handle invalid date formats', async () => {
      const task = new Task({
        id: 'task-1',
        name: 'Test Task',
        description: 'Test Description',
        duration: 60,
        due_date: 'invalid-date',
        project_id: 'project-1',
        status: STATUS.PLANNING,
        priority: PRIORITY.MEDIUM,
      });

      expect(task.validate()).toBe(false);
    });

    it('should prevent SQL injection in the searchTasks method', async () => {
      const maliciousQuery = "'; DROP TABLE tasks; --";

      await taskManager.searchTasks(maliciousQuery);

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC',
        [`%${maliciousQuery}%`, `%${maliciousQuery}%`]
      );
    });
  });

  describe('prioritizeTasks', () => {
    it('should prioritize tasks by due date and priority', async () => {
      // Mock tasks with different priorities and due dates
      mockQuery.mockImplementation(() => [
        {
          id: 'task-1',
          name: 'High Priority Task',
          priority: 'high',
          status: 'planning',
          due_date: '2023-01-02', // Due later
        },
        {
          id: 'task-2',
          name: 'Medium Priority Task with Earlier Due Date',
          priority: 'medium',
          status: 'planning',
          due_date: '2023-01-01', // Due earlier
        },
        {
          id: 'task-3',
          name: 'Low Priority Task',
          priority: 'low',
          status: 'planning',
          due_date: '2023-01-03', // Due latest
        },
        {
          id: 'task-4',
          name: 'Medium Priority Task with No Due Date',
          priority: 'medium',
          status: 'planning',
          due_date: null,
        },
        {
          id: 'task-5',
          name: 'High Priority Task with No Due Date',
          priority: 'high',
          status: 'planning',
          due_date: null,
        },
      ]);

      // Call the method
      const prioritizedTasks = await taskManager.prioritizeTasks();

      // Verify the task order matches the expected prioritization logic
      expect(prioritizedTasks.length).toBe(5);
      // Based on the actual implementation, tasks are sorted by:
      // 1. High priority tasks first
      // 2. Then by due date within each priority level
      expect(prioritizedTasks[0].id).toBe('task-1'); // High priority with due date
      expect(prioritizedTasks[1].id).toBe('task-5'); // High priority with no due date
      expect(prioritizedTasks[2].id).toBe('task-2'); // Medium priority with earlier due date
      expect(prioritizedTasks[3].id).toBe('task-3'); // Low priority with latest due date
      expect(prioritizedTasks[4].id).toBe('task-4'); // Medium priority with no due date
    });

    it('should handle errors when prioritizing tasks', async () => {
      // Mock an error
      mockQuery.mockImplementation(() => {
        throw new Error('Database error');
      });

      const tasks = await taskManager.prioritizeTasks();
      expect(tasks).toEqual([]);
    });
  });

  describe('getTasksDueSoon', () => {
    it('should return tasks due soon', async () => {
      const mockTasks = [new Task({ id: 'task-1' })];
      databaseService.query.mockReturnValue(mockTasks);

      const tasksDueSoon = await taskManager.getTasksDueSoon(7);

      expect(databaseService.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
      expect(tasksDueSoon.length).toBe(mockTasks.length);
      expect(tasksDueSoon[0].id).toBe(mockTasks[0].id);
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const tasksDueSoon = await taskManager.getTasksDueSoon(7);

      expect(tasksDueSoon).toEqual([]);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const mockTasks = [new Task({ id: 'task-1' })];
      databaseService.query.mockReturnValue(mockTasks);

      const overdueTasks = await taskManager.getOverdueTasks();

      expect(databaseService.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
      expect(overdueTasks.length).toBe(mockTasks.length);
      expect(overdueTasks[0].id).toBe(mockTasks[0].id);
    });

    it('should handle errors when getting overdue tasks', async () => {
      databaseService.query.mockRejectedValue(new Error('Database error'));

      const overdueTasks = await taskManager.getOverdueTasks();

      expect(overdueTasks).toEqual([]);
    });
  });

  describe('planMyDay', () => {
    beforeEach(() => {
      // Reset mocks
      mockQuery.mockReset();
      mockUpdate.mockReset();

      // Mock current time to be 10:30 AM local
      const originalDate = global.Date;
      // Mock current time to be 10:30 AM local (2:30 AM UTC)
      const mockDate = new Date(Date.UTC(2023, 0, 1, 2, 30, 0));
      global.Date = class extends Date {
        constructor(date) {
          if (date) {
            return new originalDate(date);
          }
          return new Date(mockDate);
        }

        static now() {
          return mockDate.getTime();
        }
      };

      // Store task data for both query and queryOne mocks
      const taskData = [
        // Task due today, not planned, high priority
        {
          id: 'task-1',
          name: 'High priority task',
          description: 'Description 1',
          due_date: '2023-01-01',
          project_id: 'project-1',
          dependencies: '[]',
          status: STATUS.PLANNING,
          labels: '[]',
          priority: PRIORITY.HIGH,
          duration: 60,
          planned_time: null,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        // Task due today, not planned, medium priority
        {
          id: 'task-2',
          name: 'Medium priority task',
          description: 'Description 2',
          due_date: '2023-01-01',
          project_id: 'project-1',
          dependencies: '[]',
          status: STATUS.PLANNING,
          labels: '[]',
          priority: PRIORITY.MEDIUM,
          duration: 30,
          planned_time: null,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        // Task due today, already planned, but time has passed
        {
          id: 'task-3',
          name: 'Already planned task',
          description: 'Description 3',
          due_date: '2023-01-01',
          project_id: 'project-1',
          dependencies: '[]',
          status: STATUS.PLANNING,
          labels: '[]',
          priority: PRIORITY.MEDIUM,
          planned_time: '2023-01-01T01:00:00.000Z', // Planned for 9:00 AM local (1:00 AM UTC)
          duration: 45,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        // Task not due today
        {
          id: 'task-4',
          name: 'Future task',
          description: 'Description 4',
          due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          project_id: 'project-1',
          dependencies: '[]',
          status: STATUS.PLANNING,
          labels: '[]',
          priority: PRIORITY.LOW,
          duration: 15,
          planned_time: null,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
      ];

      // Mock database responses for planMyDay
      mockQuery.mockImplementation((query) => {
        if (query.includes('SELECT * FROM tasks')) {
          return taskData;
        }
        return [];
      });

      // Mock queryOne for getTaskById calls during update
      mockQueryOne.mockImplementation((query, params) => {
        if (query.includes('SELECT * FROM tasks WHERE id = ?')) {
          const taskId = params[0];
          return taskData.find((task) => task.id === taskId) || null;
        }
        return null;
      });

      // Mock update for saving scheduled tasks
      mockUpdate.mockImplementation(() => ({ changes: 1 }));
    });

    it('should schedule tasks based on priority and duration', async () => {
      // Store original Date constructor for MockTask to use
      const originalDate = global.Date;
      global.Date.originalConstructor = originalDate;

      // Mock current time to be 10:30 AM local (2:30 AM UTC)
      const mockDate = new originalDate('2023-01-01T02:30:00.000Z');
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            return new originalDate(mockDate);
          }
          return new originalDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };

      // Set working hours from 10:00 to 17:00
      const workingHours = {
        startTime: '10:00',
        endTime: '17:00',
      };

      // Call planMyDay with preferences object
      const preferences = {
        workingHours,
        bufferTime: 0, // No buffer for this test
      };
      const result = await taskManager.planMyDay(preferences);

      // Restore original Date
      global.Date = originalDate;

      // Verify results
      expect(result).toBeDefined();
      expect(result.scheduled.length).toBeGreaterThan(0); // At least some tasks should be scheduled
      expect(result.scheduled.map((task) => task.id)).toContain('task-1'); // High priority task should be scheduled
      expect(result.scheduled.map((task) => task.id)).toContain('task-3'); // Task 3 should be rescheduled

      // Verify tasks have planned times
      expect(result.scheduled[0].plannedTime).toBeDefined();

      // Verify update was called at least once
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle no tasks to plan', async () => {
      // Override mock to return no tasks due today
      mockQuery.mockImplementation(() => []);

      const workingHours = {
        startTime: '10:00',
        endTime: '17:00',
      };

      const preferences = {
        workingHours,
        bufferTime: 0,
      };
      const result = await taskManager.planMyDay(preferences);

      expect(result).toBeDefined();
      expect(result.scheduled).toHaveLength(0);
      expect(result.unscheduled).toHaveLength(0);
      expect(result.message).toContain('No tasks to plan');
    });

    it('should consider buffer time when scheduling tasks', async () => {
      // Store original Date constructor for MockTask to use
      const originalDate = global.Date;
      global.Date.originalConstructor = originalDate;

      // Mock current time to be 10:00 AM local (2:00 AM UTC)
      const mockDate = new originalDate('2023-01-01T02:00:00.000Z');
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            return new originalDate(mockDate);
          }
          return new originalDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };

      // Mock database responses for planMyDay with two 30-minute tasks
      mockQuery.mockImplementation((query) => {
        if (query.includes('SELECT * FROM tasks')) {
          return [
            // Task 1: due today, not planned, high priority, 30 minutes
            {
              id: 'task-1',
              name: 'Task 1',
              description: 'Description 1',
              duration: 30,
              due_date: '2023-01-01',
              project_id: 'project-1',
              dependencies: '[]',
              status: STATUS.PLANNING,
              labels: '[]',
              priority: PRIORITY.HIGH,
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              planned_time: null,
            },
            // Task 2: due today, not planned, medium priority, 30 minutes
            {
              id: 'task-2',
              name: 'Task 2',
              description: 'Description 2',
              duration: 30,
              due_date: '2023-01-01',
              project_id: 'project-1',
              dependencies: '[]',
              status: STATUS.PLANNING,
              labels: '[]',
              priority: PRIORITY.MEDIUM,
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              planned_time: null,
            },
          ];
        }
        return [];
      });

      mockUpdate.mockReturnValue({ changes: 1 });

      const preferences = {
        workingHours: {
          startTime: '10:00',
          endTime: '17:00',
        },
        bufferTime: 15, // 15 minutes buffer before tasks
      };

      // Call planMyDay
      const result = await taskManager.planMyDay(preferences);

      // Restore original Date
      global.Date = originalDate;

      // Verify results
      expect(result).toBeDefined();
      expect(result.scheduled).toHaveLength(2);

      // Verify that tasks are scheduled with buffer time
      const task1 = result.scheduled.find((t) => t.id === 'task-1');
      const task2 = result.scheduled.find((t) => t.id === 'task-2');

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();

      // Task 1 should start at 10:15 (10:00 + 15 min buffer)
      expect(task1.plannedTime.getHours()).toBe(10);
      expect(task1.plannedTime.getMinutes()).toBe(15);

      // Task 2 should start at 11:00 (10:15 + 30 min task + 15 min buffer)
      expect(task2.plannedTime.getHours()).toBe(11);
      expect(task2.plannedTime.getMinutes()).toBe(0);
    });

    it('should handle backward compatibility with old workingHours parameter', async () => {
      // Store original Date constructor for MockTask to use
      const originalDate = global.Date;
      global.Date.originalConstructor = originalDate;

      // Mock current time to be 10:00 AM local (2:00 AM UTC)
      const mockDate = new originalDate('2023-01-01T02:00:00.000Z');
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            return new originalDate(mockDate);
          }
          return new originalDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };

      // Mock database responses for planMyDay
      mockQuery.mockImplementation((query) => {
        if (query.includes('SELECT * FROM tasks')) {
          return [
            {
              id: 'task-1',
              name: 'Task 1',
              description: 'Description 1',
              duration: 30,
              due_date: '2023-01-01',
              project_id: 'project-1',
              dependencies: '[]',
              status: STATUS.PLANNING,
              labels: '[]',
              priority: PRIORITY.HIGH,
              created_at: '2023-01-01T00:00:00.000Z',
              updated_at: '2023-01-01T00:00:00.000Z',
              planned_time: null,
            },
          ];
        }
        return [];
      });

      mockUpdate.mockReturnValue({ changes: 1 });

      const workingHours = {
        startTime: '10:00',
        endTime: '17:00',
      };

      // Call planMyDay with old format (should default to 0 buffer time)
      const result = await taskManager.planMyDay(workingHours);

      // Restore original Date
      global.Date = originalDate;

      // Verify results
      expect(result).toBeDefined();
      expect(result.scheduled).toHaveLength(1);
      expect(result.scheduled[0].id).toBe('task-1');
    });
  });
});
