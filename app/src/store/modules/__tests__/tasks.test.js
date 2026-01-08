import { describe, it, expect, vi, beforeEach } from 'vitest';
import tasksModule from '../tasks.js';
import { STATUS, PRIORITY } from '../../../../shared/models/Task.js';

// Mock window object
vi.stubGlobal('window', {
  electron: {
    getTasks: vi.fn(),
    getTasksByProject: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
});

// Mock Task model
vi.mock('../../../../shared/models/Task.js', () => {
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
    Object.assign(this, data);

    this.toDatabase = vi.fn(() => ({
      id: this.id || 'task-123',
      name: this.name || 'Task Name',
      description: this.description || 'Task Description',
      duration: this.duration || 60,
      due_date: this.due_date || '2023-01-01T00:00:00.000Z',
      project_id: this.project_id || this.projectId || 'project-1',
      dependencies: this.dependencies || JSON.stringify([]),
      status: this.status || STATUS.PLANNING,
      labels: this.labels || JSON.stringify([]),
      priority: this.priority || PRIORITY.MEDIUM,
      created_at: this.created_at || '2023-01-01T00:00:00.000Z',
      updated_at: this.updated_at || '2023-01-01T00:00:00.000Z',
    }));
  };

  MockTask.fromDatabase = vi.fn((data) => new MockTask(data));

  return {
    Task: MockTask,
    STATUS,
    PRIORITY,
  };
});

describe('Tasks Store Module', () => {
  // Mock tasks data
  const mockTasks = [
    {
      id: 'task-1',
      name: 'Task 1',
      description: 'Description 1',
      duration: 30,
      due_date: '2023-01-01T00:00:00.000Z',
      project_id: 'project-1',
      projectId: 'project-1',
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
      projectId: 'project-1',
      dependencies: '[]',
      status: STATUS.DOING,
      labels: '["important"]',
      priority: PRIORITY.MEDIUM,
      created_at: '2023-01-02T00:00:00.000Z',
      updated_at: '2023-01-02T00:00:00.000Z',
    },
  ];

  // Helper to create a mock commit function
  const createCommit = () => vi.fn();

  // Helper to create a mock dispatch function
  const createDispatch = () => vi.fn();

  // Helper to create mock state
  const createState = () => ({
    tasks: [],
    filteredTasks: [],
    currentFilter: {
      status: 'all',
      priority: 'all',
      search: '',
    },
    loading: false,
    error: null,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Getters', () => {
    it('allTasks should return all tasks', () => {
      const state = {
        tasks: mockTasks,
      };

      const result = tasksModule.getters.allTasks(state);

      expect(result).toEqual(mockTasks);
    });

    it('filteredTasks should return filtered tasks', () => {
      const state = {
        filteredTasks: [mockTasks[0]],
      };

      const result = tasksModule.getters.filteredTasks(state);

      expect(result).toEqual([mockTasks[0]]);
    });

    it('tasksByProject should return tasks for a specific project', () => {
      const state = {
        tasks: mockTasks,
      };

      const result = tasksModule.getters.tasksByProject(state)('project-1');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('task-1');
      expect(result[1].id).toBe('task-2');
    });

    it('isLoading should return the loading state', () => {
      const state = {
        loading: true,
      };

      const result = tasksModule.getters.isLoading(state);

      expect(result).toBe(true);
    });

    it('error should return the error state', () => {
      const state = {
        error: 'Test error',
      };

      const result = tasksModule.getters.error(state);

      expect(result).toBe('Test error');
    });

    it('currentFilter should return the current filter', () => {
      const state = {
        currentFilter: {
          status: STATUS.DOING,
          priority: PRIORITY.HIGH,
          search: 'test',
        },
      };

      const result = tasksModule.getters.currentFilter(state);

      expect(result).toEqual({
        status: STATUS.DOING,
        priority: PRIORITY.HIGH,
        search: 'test',
      });
    });
  });

  describe('Actions', () => {
    describe('fetchTasks', () => {
      it('should fetch tasks successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getRecentTasks = vi.fn().mockResolvedValue(mockTasks);

        await tasksModule.actions.fetchTasks({ commit, dispatch });

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.getRecentTasks).toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setTasks', expect.any(Array));
        expect(dispatch).toHaveBeenCalledWith('applyFilters');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should fetch all tasks when fetchAll is true', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getTasks.mockResolvedValue(mockTasks);

        await tasksModule.actions.fetchTasks({ commit, dispatch }, { fetchAll: true });

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.getTasks).toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setTasks', expect.any(Array));
        expect(dispatch).toHaveBeenCalledWith('applyFilters');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when fetching tasks', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getTasks.mockRejectedValue(new Error('API error'));

        await tasksModule.actions.fetchTasks({ commit, dispatch });

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to load tasks');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('fetchTasksByProject', () => {
      it('should fetch tasks for a specific project successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getRecentTasksByProject = vi.fn().mockResolvedValue(mockTasks);

        await tasksModule.actions.fetchTasksByProject({ commit, dispatch }, { projectId: 'project-1' });

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.getRecentTasksByProject).toHaveBeenCalledWith('project-1');
        expect(commit).toHaveBeenCalledWith('setTasks', expect.any(Array));
        expect(dispatch).toHaveBeenCalledWith('applyFilters');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should fetch all tasks for a specific project when fetchAll is true', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getTasksByProject.mockResolvedValue(mockTasks);

        await tasksModule.actions.fetchTasksByProject(
          { commit, dispatch },
          { projectId: 'project-1', fetchAll: true }
        );

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.getTasksByProject).toHaveBeenCalledWith('project-1');
        expect(commit).toHaveBeenCalledWith('setTasks', expect.any(Array));
        expect(dispatch).toHaveBeenCalledWith('applyFilters');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when fetching tasks by project', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.getTasksByProject.mockRejectedValue(new Error('API error'));

        await tasksModule.actions.fetchTasksByProject({ commit, dispatch }, { projectId: 'project-1' });

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to load tasks');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('fetchAllTasksByProject', () => {
      it('should dispatch fetchTasksByProject with fetchAll payload', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();

        await tasksModule.actions.fetchAllTasksByProject({ commit, dispatch }, 'project-1');

        expect(dispatch).toHaveBeenCalledWith('fetchTasksByProject', {
          projectId: 'project-1',
          fetchAll: true,
        });
      });
    });

    describe('filterTasks', () => {
      it('should update filter and apply filters', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        const filter = {
          status: STATUS.DOING,
          priority: PRIORITY.HIGH,
          search: 'test',
        };

        await tasksModule.actions.filterTasks({ commit, dispatch }, filter);

        expect(commit).toHaveBeenCalledWith('setCurrentFilter', filter);
        expect(dispatch).toHaveBeenCalledWith('applyFilters');
      });
    });

    describe('applyFilters', () => {
      it('should filter tasks by status', () => {
        const commit = createCommit();
        const state = {
          tasks: mockTasks,
          currentFilter: {
            status: STATUS.PLANNING,
            priority: 'all',
            search: '',
          },
        };

        tasksModule.actions.applyFilters({ commit, state });

        expect(commit).toHaveBeenCalledWith('setFilteredTasks', [mockTasks[0]]);
      });

      it('should filter tasks by priority', () => {
        const commit = createCommit();
        const state = {
          tasks: mockTasks,
          currentFilter: {
            status: 'all',
            priority: PRIORITY.HIGH,
            search: '',
          },
        };

        tasksModule.actions.applyFilters({ commit, state });

        expect(commit).toHaveBeenCalledWith('setFilteredTasks', [mockTasks[0]]);
      });

      it('should filter tasks by search term', () => {
        const commit = createCommit();
        const state = {
          tasks: mockTasks,
          currentFilter: {
            status: 'all',
            priority: 'all',
            search: 'Task 1',
          },
        };

        tasksModule.actions.applyFilters({ commit, state });

        expect(commit).toHaveBeenCalledWith('setFilteredTasks', [mockTasks[0]]);
      });

      it('should combine multiple filters', () => {
        const commit = createCommit();
        const state = {
          tasks: mockTasks,
          currentFilter: {
            status: STATUS.PLANNING,
            priority: PRIORITY.HIGH,
            search: 'Task',
          },
        };

        tasksModule.actions.applyFilters({ commit, state });

        expect(commit).toHaveBeenCalledWith('setFilteredTasks', [mockTasks[0]]);
      });
    });

    describe('addTask', () => {
      it('should add a task successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addTask.mockResolvedValue(true);

        const taskData = {
          name: 'New Task',
          description: 'New Task Description',
          projectId: 'project-1',
        };

        await tasksModule.actions.addTask({ commit, dispatch }, taskData);

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.addTask).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith('fetchTasksByProject', { projectId: 'project-1' });
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when adding a task', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addTask.mockResolvedValue(false);

        const taskData = {
          name: 'New Task',
          description: 'New Task Description',
          projectId: 'project-1',
        };

        await tasksModule.actions.addTask({ commit, dispatch }, taskData);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to add task');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle exceptions when adding a task', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addTask.mockRejectedValue(new Error('API error'));

        const taskData = {
          name: 'New Task',
          description: 'New Task Description',
          projectId: 'project-1',
        };

        await tasksModule.actions.addTask({ commit, dispatch }, taskData);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to add task');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('updateTask', () => {
      it('should update a task successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateTask.mockResolvedValue(true);

        const task = {
          id: 'task-1',
          name: 'Updated Task',
          description: 'Updated Description',
          projectId: 'project-1',
          toDatabase: () => ({
            id: 'task-1',
            name: 'Updated Task',
            description: 'Updated Description',
            project_id: 'project-1',
          }),
        };

        await tasksModule.actions.updateTask({ commit, dispatch }, task);

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.updateTask).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith('fetchTasksByProject', { projectId: 'project-1' });
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when updating a task', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateTask.mockResolvedValue(false);

        const task = {
          id: 'task-1',
          name: 'Updated Task',
          description: 'Updated Description',
          projectId: 'project-1',
          toDatabase: () => ({
            id: 'task-1',
            name: 'Updated Task',
            description: 'Updated Description',
            project_id: 'project-1',
          }),
        };

        await tasksModule.actions.updateTask({ commit, dispatch }, task);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to update task');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('deleteTask', () => {
      it('should delete a task successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.deleteTask.mockResolvedValue(true);

        await tasksModule.actions.deleteTask(
          { commit, dispatch },
          { taskId: 'task-1', projectId: 'project-1' }
        );

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.deleteTask).toHaveBeenCalledWith('task-1');
        expect(dispatch).toHaveBeenCalledWith('fetchTasksByProject', { projectId: 'project-1' });
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when deleting a task', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.deleteTask.mockResolvedValue(false);

        await tasksModule.actions.deleteTask(
          { commit, dispatch },
          { taskId: 'task-1', projectId: 'project-1' }
        );

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to delete task');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('updateTaskStatus', () => {
      it('should update task status successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateTaskStatus.mockResolvedValue(true);

        await tasksModule.actions.updateTaskStatus(
          { commit, dispatch },
          { taskId: 'task-1', status: STATUS.DONE, projectId: 'project-1' }
        );

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.updateTaskStatus).toHaveBeenCalledWith('task-1', STATUS.DONE);
        expect(dispatch).toHaveBeenCalledWith('fetchTasksByProject', { projectId: 'project-1' });
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when updating task status', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateTaskStatus.mockResolvedValue(false);

        await tasksModule.actions.updateTaskStatus(
          { commit, dispatch },
          { taskId: 'task-1', status: STATUS.DONE, projectId: 'project-1' }
        );

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to update task status');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });
  });

  describe('Mutations', () => {
    it('setTasks should update tasks state', () => {
      const state = createState();

      tasksModule.mutations.setTasks(state, mockTasks);

      expect(state.tasks).toEqual(mockTasks);
    });

    it('setFilteredTasks should update filteredTasks state', () => {
      const state = createState();

      tasksModule.mutations.setFilteredTasks(state, [mockTasks[0]]);

      expect(state.filteredTasks).toEqual([mockTasks[0]]);
    });

    it('setCurrentFilter should update currentFilter state', () => {
      const state = createState();
      const filter = {
        status: STATUS.DOING,
        priority: PRIORITY.HIGH,
        search: 'test',
      };

      tasksModule.mutations.setCurrentFilter(state, filter);

      expect(state.currentFilter).toEqual(filter);
    });

    it('setLoading should update loading state', () => {
      const state = createState();

      tasksModule.mutations.setLoading(state, true);

      expect(state.loading).toBe(true);
    });

    it('setError should update error state', () => {
      const state = createState();

      tasksModule.mutations.setError(state, 'Test error');

      expect(state.error).toBe('Test error');
    });
  });
});
