/**
 * Vuex store module for notification state management.
 * Provides centralized state management for notifications, replacing direct IPC calls
 * and event-based updates in components.
 */

import { Notification, TYPE } from '../../models/Notification.js';
import logger from '../../services/logger.js';

const getTaskId = (notification) => {
  return notification?.taskId || notification?.task_id || null;
};

// State
const state = () => ({
  // Map of notification id -> Notification instance
  notifications: {},
  // Map of taskId -> Notification[] for quick lookup
  notificationsByTask: {},
  loading: false,
  error: null,
});

// Getters
const getters = {
  // Get all notifications as an array
  allNotifications: (state) => {
    return Object.values(state.notifications);
  },

  // Get notification by ID
  notificationById: (state) => (notificationId) => {
    return state.notifications[notificationId] || null;
  },

  // Get notifications for a specific task
  notificationsByTask: (state) => (taskId) => {
    return state.notificationsByTask[taskId] || [];
  },

  // Get notification count for a task (excludes PLANNED_TIME type from UI display)
  notificationCount: (state) => (taskId) => {
    const notifications = state.notificationsByTask[taskId] || [];
    // Exclude PLANNED_TIME type from count (shown in UI)
    const regularNotifications = notifications.filter((n) => n.type !== TYPE.PLANNED_TIME);
    return regularNotifications.length;
  },

  // Check if a task has upcoming notifications
  hasUpcomingNotifications: (state) => (taskId) => {
    const notifications = state.notificationsByTask[taskId] || [];
    const now = new Date();
    return notifications.some((n) => n.time > now);
  },

  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

// Mutations
const mutations = {
  setLoading(state, loading) {
    state.loading = loading;
  },

  setError(state, error) {
    state.error = error;
  },

  // Set all notifications (replaces entire state)
  setNotifications(state, notifications) {
    state.notifications = {};
    state.notificationsByTask = {};

    notifications.forEach((notification) => {
      if (notification && notification.id) {
        state.notifications[notification.id] = notification;

        // Index by task ID
        const taskId = getTaskId(notification);
        if (taskId) {
          if (!state.notificationsByTask[taskId]) {
            state.notificationsByTask[taskId] = [];
          }
          state.notificationsByTask[taskId].push(notification);
        }
      }
    });
  },

  // Add a single notification to state
  addNotification(state, notification) {
    if (notification && notification.id) {
      state.notifications[notification.id] = notification;

      const taskId = getTaskId(notification);
      if (taskId) {
        if (!state.notificationsByTask[taskId]) {
          state.notificationsByTask[taskId] = [];
        }
        // Avoid duplicates
        const exists = state.notificationsByTask[taskId].some((n) => n.id === notification.id);
        if (!exists) {
          state.notificationsByTask[taskId].push(notification);
        }
      }
    }
  },

  // Update a notification in state
  updateNotification(state, notification) {
    if (notification && notification.id) {
      state.notifications[notification.id] = notification;

      const taskId = getTaskId(notification);
      if (taskId) {
        if (!state.notificationsByTask[taskId]) {
          state.notificationsByTask[taskId] = [];
        }
        // Remove old version and add new
        state.notificationsByTask[taskId] = state.notificationsByTask[taskId].filter(
          (n) => n.id !== notification.id
        );
        state.notificationsByTask[taskId].push(notification);
      }
    }
  },

  // Remove a notification from state
  removeNotification(state, notificationId) {
    const notification = state.notifications[notificationId];
    if (notification) {
      const taskId = getTaskId(notification);

      // Remove from main map
      delete state.notifications[notificationId];

      // Remove from task index
      if (taskId && state.notificationsByTask[taskId]) {
        state.notificationsByTask[taskId] = state.notificationsByTask[taskId].filter(
          (n) => n.id !== notificationId
        );
      }
    }
  },

  // Clear all notifications
  clearNotifications(state) {
    state.notifications = {};
    state.notificationsByTask = {};
  },

  // Clear notifications for a specific task (used during refresh)
  clearNotificationsForTask(state, taskId) {
    if (state.notificationsByTask[taskId]) {
      const notifications = state.notificationsByTask[taskId];
      // Remove from main map
      notifications.forEach((notification) => {
        if (notification && notification.id) {
          delete state.notifications[notification.id];
        }
      });
      // Clear task index
      state.notificationsByTask[taskId] = [];
    }
  },
};

// Actions
const actions = {
  // Fetch notifications for a specific task
  async fetchNotificationsByTask({ commit }, taskId) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const notificationsData = await window.electron.getNotificationsByTask(taskId);
      const notifications = notificationsData.map((data) => Notification.fromDatabase(data));

      // Clear stale notifications for this task before adding fresh ones
      commit('clearNotificationsForTask', taskId);

      // Update only the notifications for this task
      notifications.forEach((notification) => {
        commit('addNotification', notification);
      });

      return notifications;
    } catch (error) {
      logger.error(`Error fetching notifications for task ${taskId}:`, error);
      commit('clearNotificationsForTask', taskId);
      commit('setError', 'Failed to load notifications');
      return [];
    } finally {
      commit('setLoading', false);
    }
  },

  // Add a new notification
  async addNotification({ commit }, notificationData) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const success = await window.electron.addNotification(notificationData);

      if (success) {
        // The IPC handler will emit 'notifications:changed' event
        // which will trigger a refresh
        return success;
      } else {
        commit('setError', 'Failed to add notification');
        return false;
      }
    } catch (error) {
      logger.error('Error adding notification:', error);
      commit('setError', 'Failed to add notification');
      return false;
    } finally {
      commit('setLoading', false);
    }
  },

  // Update an existing notification
  async updateNotification({ commit }, notificationData) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const success = await window.electron.updateNotification(notificationData);

      if (success) {
        // The IPC handler will emit 'notifications:changed' event
        // which will trigger a refresh
        return success;
      } else {
        commit('setError', 'Failed to update notification');
        return false;
      }
    } catch (error) {
      logger.error('Error updating notification:', error);
      commit('setError', 'Failed to update notification');
      return false;
    } finally {
      commit('setLoading', false);
    }
  },

  // Delete a notification
  async deleteNotification({ commit }, notificationId) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const success = await window.electron.deleteNotification(notificationId);

      if (success) {
        // The IPC handler will emit 'notifications:changed' event
        // which will trigger a refresh
        return success;
      } else {
        commit('setError', 'Failed to delete notification');
        return false;
      }
    } catch (error) {
      logger.error('Error deleting notification:', error);
      commit('setError', 'Failed to delete notification');
      return false;
    } finally {
      commit('setLoading', false);
    }
  },

  // Refresh notification counts for current tasks (batch operation)
  async refreshNotificationCounts({ dispatch, rootGetters }) {
    try {
      const allTasks = rootGetters['tasks/allTasks'];
      if (!allTasks || allTasks.length === 0) {
        return;
      }

      // Batch fetch notifications for all tasks
      const taskIds = allTasks.map((task) => task.id);
      await Promise.all(taskIds.map((taskId) => dispatch('fetchNotificationsByTask', taskId)));
    } catch (error) {
      logger.error('Error refreshing notification counts:', error);
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
