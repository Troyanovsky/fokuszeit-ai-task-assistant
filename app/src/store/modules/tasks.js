/**
 * Vuex tasks module for task state management.
 */

import { Task } from '../../../shared/models/Task';
import logger from '../../services/logger';
import { isDebugLoggingEnabled } from '../../../shared/utils/loggingConfig.js';
import { redactTask, summarizeTasks } from '../../../shared/utils/loggingSanitizers.js';

// Initial state
const state = {
  tasks: [],
  filteredTasks: [],
  currentFilter: {
    status: 'all',
    priority: 'all',
    search: '',
  },
  loading: false,
  error: null,
  currentProjectTasks: [],
};

// Getters
const getters = {
  allTasks: (state) => state.tasks,
  filteredTasks: (state) => state.filteredTasks,
  tasksByProject: (state) => (projectId) => {
    return state.tasks.filter((task) => task.projectId === projectId);
  },
  taskById: (state) => (taskId) => {
    return state.tasks.find((task) => task.id === taskId);
  },
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  currentFilter: (state) => state.currentFilter,
  currentProjectTasks: (state) => state.currentProjectTasks,
};

// Actions
const actions = {
  async fetchTasks({ commit, dispatch }, { fetchAll = false } = {}) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      const tasksData = window.electron
        ? fetchAll
          ? await window.electron.getTasks()
          : await window.electron.getRecentTasks()
        : [];
      const tasks = tasksData.map((data) => Task.fromDatabase(data));

      commit('setTasks', tasks);
      dispatch('applyFilters');
    } catch (error) {
      logger.error('Error fetching tasks:', error);
      commit('setError', 'Failed to load tasks');
    } finally {
      commit('setLoading', false);
    }
  },

  async fetchAllTasks({ dispatch }) {
    return dispatch('fetchTasks', { fetchAll: true });
  },

  async fetchTasksByProject({ commit, dispatch }, { projectId, fetchAll = false } = {}) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const debugEnabled = isDebugLoggingEnabled();
      // In Electron, we would use IPC to communicate with the main process
      const tasksData = window.electron
        ? fetchAll
          ? await window.electron.getTasksByProject(projectId)
          : await window.electron.getRecentTasksByProject(projectId)
        : [];
      logger.info('Fetched tasks for project', { projectId, count: tasksData.length });
      if (debugEnabled) {
        logger.debug('Fetched task summary', { projectId, summary: summarizeTasks(tasksData) });
      }
      const tasks = tasksData.map((data) => Task.fromDatabase(data));

      commit('setTasks', tasks);
      commit('setCurrentProjectTasks', tasks);
      dispatch('applyFilters');
    } catch (error) {
      logger.error(`Error fetching tasks for project ${projectId}:`, error);
      commit('setError', 'Failed to load tasks');
    } finally {
      commit('setLoading', false);
    }
  },

  async fetchAllTasksByProject({ dispatch }, projectId) {
    return dispatch('fetchTasksByProject', { projectId, fetchAll: true });
  },

  filterTasks({ commit, dispatch }, filter) {
    commit('setCurrentFilter', filter);
    dispatch('applyFilters');
  },

  applyFilters({ commit, state }) {
    let filtered = [...state.tasks];
    const filter = state.currentFilter;

    // Filter by status
    if (filter.status !== 'all') {
      filtered = filtered.filter((task) => task.status === filter.status);
    }

    // Filter by priority
    if (filter.priority !== 'all') {
      filtered = filtered.filter((task) => task.priority === filter.priority);
    }

    // Filter by search term
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.name.toLowerCase().includes(searchTerm) ||
          (task.description && task.description.toLowerCase().includes(searchTerm))
      );
    }

    commit('setFilteredTasks', filtered);
  },

  // eslint-disable-next-line complexity
  async addTask({ commit, dispatch }, taskData) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const debugEnabled = isDebugLoggingEnabled();
      logger.info('Adding task', { projectId: taskData?.projectId ?? taskData?.project_id });
      if (debugEnabled) {
        logger.debug('Add task payload', { task: redactTask(taskData) });
      }

      // Create a Task instance
      const task = new Task(taskData);

      // Convert to database format and ensure project_id is set
      const dbData = task.toDatabase();

      // Ensure project_id is set correctly
      if (!dbData.project_id && taskData.projectId) {
        dbData.project_id = taskData.projectId;
      }

      // Ensure planned_time is set correctly and stored in UTC
      if (taskData.plannedTime) {
        // If it's already a Date object, convert to ISO string (UTC)
        if (taskData.plannedTime instanceof Date) {
          dbData.planned_time = taskData.plannedTime.toISOString();
        }
        // If it's a string but not ISO format, parse and convert to ISO
        else if (typeof taskData.plannedTime === 'string' && !taskData.plannedTime.includes('T')) {
          const plannedTime = new Date(taskData.plannedTime);
          if (!isNaN(plannedTime)) {
            dbData.planned_time = plannedTime.toISOString();
          }
        }
        // Otherwise use as is (should already be ISO string)
        else {
          dbData.planned_time =
            typeof taskData.plannedTime === 'string'
              ? taskData.plannedTime
              : taskData.plannedTime.toISOString();
        }

        if (debugEnabled) {
          logger.debug(`Planned time for task set (UTC)`);
        }
      }

      if (debugEnabled) {
        logger.debug('Task data to be saved', { task: redactTask(dbData) });
      }

      // In Electron, we would use IPC to communicate with the main process
      const success = window.electron ? await window.electron.addTask(dbData) : false;

      if (success) {
        logger.info('Task added successfully', { projectId: dbData.project_id });
        // Refresh the tasks list
        if (dbData.project_id) {
          dispatch('fetchTasksByProject', { projectId: dbData.project_id });
        } else {
          dispatch('fetchTasks');
        }

        // Return the task data with ID for the callback
        return dbData;
      } else {
        commit('setError', 'Failed to add task');
        return null;
      }
    } catch (error) {
      logger.error('Error adding task:', error);
      commit('setError', 'Failed to add task');
      return null;
    } finally {
      commit('setLoading', false);
    }
  },

  // eslint-disable-next-line complexity
  async updateTask({ commit, dispatch }, task) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const debugEnabled = isDebugLoggingEnabled();
      logger.info('Updating task', { taskId: task?.id });
      if (debugEnabled) {
        logger.debug('Update task payload', { task: redactTask(task) });
      }

      // Ensure we're working with a Task instance
      const taskInstance = task instanceof Task ? task : new Task(task);

      // Convert to database format
      const dbData = taskInstance.toDatabase();

      // Ensure project_id is set correctly
      if (!dbData.project_id && task.projectId) {
        dbData.project_id = task.projectId;
      }

      // Ensure planned_time is in UTC ISO format
      if (task.plannedTime) {
        // If it's a Date object
        if (task.plannedTime instanceof Date) {
          dbData.planned_time = task.plannedTime.toISOString();
        }
        // If it's a string but not in ISO format
        else if (typeof task.plannedTime === 'string' && !task.plannedTime.includes('T')) {
          const plannedTime = new Date(task.plannedTime);
          if (!isNaN(plannedTime)) {
            dbData.planned_time = plannedTime.toISOString();
          }
        }
        // Otherwise use as is (should already be ISO string)
        else {
          dbData.planned_time =
            typeof task.plannedTime === 'string'
              ? task.plannedTime
              : task.plannedTime.toISOString();
        }

        if (debugEnabled) {
          logger.debug('Updated planned time for task (UTC)');
        }
      }

      if (debugEnabled) {
        logger.debug('Task data to be updated', { task: redactTask(dbData) });
      }

      // In Electron, we would use IPC to communicate with the main process
      const success = window.electron ? await window.electron.updateTask(dbData) : false;

      if (success) {
        logger.info('Task updated successfully, refreshing tasks for project:', dbData.project_id);
        // Refresh the tasks list
        if (dbData.project_id) {
          dispatch('fetchTasksByProject', { projectId: dbData.project_id });
        } else {
          dispatch('fetchTasks');
        }
      } else {
        commit('setError', 'Failed to update task');
      }
    } catch (error) {
      logger.error('Error updating task:', error);
      commit('setError', 'Failed to update task');
    } finally {
      commit('setLoading', false);
    }
  },

  async deleteTask({ commit, dispatch }, { taskId, projectId }) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      // This will also delete all associated notifications for the task
      const success = window.electron ? await window.electron.deleteTask(taskId) : false;

      if (success) {
        // Refresh the tasks list
        if (projectId) {
          dispatch('fetchTasksByProject', { projectId });
        } else {
          dispatch('fetchTasks');
        }
      } else {
        commit('setError', 'Failed to delete task');
      }
    } catch (error) {
      logger.error('Error deleting task:', error);
      commit('setError', 'Failed to delete task');
    } finally {
      commit('setLoading', false);
    }
  },

  async updateTaskStatus({ commit, dispatch }, { taskId, status, projectId }) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      const success = window.electron
        ? await window.electron.updateTaskStatus(taskId, status)
        : false;

      if (success) {
        // Refresh the tasks list
        if (projectId) {
          dispatch('fetchTasksByProject', { projectId });
        } else {
          dispatch('fetchTasks');
        }
      } else {
        commit('setError', 'Failed to update task status');
      }
    } catch (error) {
      logger.error('Error updating task status:', error);
      commit('setError', 'Failed to update task status');
    } finally {
      commit('setLoading', false);
    }
  },

  async getTaskById({ commit, getters }, taskId) {
    // First check if the task is already in the state
    let task = getters.taskById(taskId);

    if (task) {
      return task;
    }

    // If not, fetch all tasks and then find the task
    try {
      commit('setLoading', true);
      const tasks = await window.electron.getTasks();
      commit('setTasks', tasks);

      // Find the task in the updated state
      task = tasks.find((t) => t.id === taskId);
      return task || null;
    } catch (error) {
      commit('setError', error.message);
      return null;
    } finally {
      commit('setLoading', false);
    }
  },

  // Watcher for real-time updates
  watchTasks({ dispatch, state }) {
    // In a real implementation, this would set up a listener
    // for database changes or server-sent events

    // For now, just set up a polling mechanism for demo purposes
    const pollInterval = 30000; // 30 seconds

    setInterval(() => {
      // Only refresh if there are tasks to avoid unnecessary polling
      if (state.tasks.length > 0) {
        dispatch('fetchTasks');
      }
    }, pollInterval);
  },
};

// Mutations
const mutations = {
  setTasks(state, tasks) {
    state.tasks = tasks;
    state.filteredTasks = tasks;
  },
  setFilteredTasks(state, tasks) {
    state.filteredTasks = tasks;
  },
  setCurrentFilter(state, filter) {
    state.currentFilter = { ...state.currentFilter, ...filter };
  },
  setLoading(state, loading) {
    state.loading = loading;
  },
  setError(state, error) {
    state.error = error;
  },
  setCurrentProjectTasks(state, tasks) {
    state.currentProjectTasks = tasks;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
