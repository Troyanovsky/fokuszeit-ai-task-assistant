/**
 * Vuex store module for managing recurrence rules
 * Provides centralized state management to avoid memory leaks from multiple event listeners
 */

import logger from '../../services/logger.js';

// State
const state = () => ({
  // Map of taskId -> recurrenceRule
  recurrenceRules: {},
  isLoading: false,
  error: null,
});

// Getters
const getters = {
  // Get recurrence rule by task ID
  getRecurrenceRuleByTaskId: (state) => (taskId) => {
    return state.recurrenceRules[taskId] || null;
  },

  // Check if a task has a recurrence rule
  hasRecurrenceRule: (state) => (taskId) => {
    return !!state.recurrenceRules[taskId];
  },

  // Get all recurrence rules
  allRecurrenceRules: (state) => {
    return Object.values(state.recurrenceRules);
  },

  isLoading: (state) => state.isLoading,
  error: (state) => state.error,
};

// Mutations
const mutations = {
  setLoading(state, loading) {
    state.isLoading = loading;
  },

  setError(state, error) {
    state.error = error;
  },

  // Set a recurrence rule for a specific task
  setRecurrenceRule(state, { taskId, rule }) {
    if (rule) {
      state.recurrenceRules[taskId] = rule;
    } else {
      delete state.recurrenceRules[taskId];
    }
  },

  // Set multiple recurrence rules at once
  setRecurrenceRules(state, rules) {
    state.recurrenceRules = {};
    rules.forEach((rule) => {
      if (rule && rule.taskId) {
        state.recurrenceRules[rule.taskId] = rule;
      }
    });
  },

  // Remove a recurrence rule for a specific task
  removeRecurrenceRule(state, taskId) {
    delete state.recurrenceRules[taskId];
  },

  // Clear all recurrence rules
  clearRecurrenceRules(state) {
    state.recurrenceRules = {};
  },
};

// Actions
const actions = {
  // Fetch recurrence rule for a specific task
  async fetchRecurrenceRuleByTaskId({ commit }, taskId) {
    try {
      commit('setError', null);
      const rule = await window.electron.getRecurrenceRuleByTask(taskId);
      commit('setRecurrenceRule', { taskId, rule });
      return rule;
    } catch (error) {
      logger.error(`Error fetching recurrence rule for task ${taskId}:`, error);
      commit('setError', `Failed to fetch recurrence rule for task ${taskId}`);
      return null;
    }
  },

  // Fetch recurrence rules for multiple tasks
  async fetchRecurrenceRulesForTasks({ commit }, taskIds) {
    try {
      commit('setLoading', true);
      commit('setError', null);

      const promises = taskIds.map(async (taskId) => {
        try {
          const rule = await window.electron.getRecurrenceRuleByTask(taskId);
          return { taskId, rule };
        } catch (error) {
          logger.error(`Error fetching recurrence rule for task ${taskId}:`, error);
          return { taskId, rule: null };
        }
      });

      const results = await Promise.all(promises);

      // Update state with all results
      results.forEach(({ taskId, rule }) => {
        commit('setRecurrenceRule', { taskId, rule });
      });
    } catch (error) {
      logger.error('Error fetching recurrence rules for tasks:', error);
      commit('setError', 'Failed to fetch recurrence rules');
    } finally {
      commit('setLoading', false);
    }
  },

  // Handle recurrence change event (called from global listener)
  handleRecurrenceChange({ dispatch }, taskId) {
    if (taskId) {
      // Refresh the recurrence rule for this specific task
      dispatch('fetchRecurrenceRuleByTaskId', taskId);
    }
  },

  // Add a new recurrence rule
  async addRecurrenceRule({ commit }, ruleData) {
    try {
      const result = await window.electron.addRecurrenceRule(ruleData);
      if (result) {
        // The IPC handler will emit the recurrence:changed event
        // which will be handled by the global listener
        return result;
      }
      return false;
    } catch (error) {
      logger.error('Error adding recurrence rule:', error);
      commit('setError', 'Failed to add recurrence rule');
      return false;
    }
  },

  // Update a recurrence rule
  async updateRecurrenceRule({ commit }, { ruleId, updateData }) {
    try {
      const result = await window.electron.updateRecurrenceRule(ruleId, updateData);
      if (result) {
        // The IPC handler will emit the recurrence:changed event
        // which will be handled by the global listener
        return result;
      }
      return false;
    } catch (error) {
      logger.error('Error updating recurrence rule:', error);
      commit('setError', 'Failed to update recurrence rule');
      return false;
    }
  },

  // Delete a recurrence rule
  async deleteRecurrenceRule({ commit }, ruleId) {
    try {
      const result = await window.electron.deleteRecurrenceRule(ruleId);
      if (result) {
        // The IPC handler will emit the recurrence:changed event
        // which will be handled by the global listener
        return result;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting recurrence rule:', error);
      commit('setError', 'Failed to delete recurrence rule');
      return false;
    }
  },

  // Delete recurrence rule by task ID
  async deleteRecurrenceRuleByTaskId({ commit }, taskId) {
    try {
      const result = await window.electron.deleteRecurrenceRuleByTask(taskId);
      if (result) {
        // The IPC handler will emit the recurrence:changed event
        // which will be handled by the global listener
        return result;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting recurrence rule by task ID:', error);
      commit('setError', 'Failed to delete recurrence rule');
      return false;
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
