/**
 * Tests for the notifications Vuex store module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TYPE } from '../../../models/Notification.js';
import notificationsModule from '../notifications.js';

vi.mock('../../../models/Notification.js', () => {
  const TYPE = {
    REMINDER: 'reminder',
    DUE_DATE: 'due_date',
    STATUS_CHANGE: 'status_change',
    PLANNED_TIME: 'PLANNED_TIME',
  };

  const Notification = function (data) {
    Object.assign(this, data);
    this.id = data.id;
    this.taskId = data.taskId || data.task_id;
    this.type = data.type;
    this.time = data.time ? new Date(data.time) : new Date();
  };

  Notification.fromDatabase = vi.fn((data) => new Notification(data));

  return { Notification, TYPE };
});

vi.mock('../../../services/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      logError: vi.fn(),
    },
  };
});

vi.stubGlobal('window', {
  electron: {
    getNotificationsByTask: vi.fn(),
    addNotification: vi.fn(),
    updateNotification: vi.fn(),
    deleteNotification: vi.fn(),
  },
});

const createState = () => ({
  notifications: {},
  notificationsByTask: {},
  loading: false,
  error: null,
});

const createCommit = (state) =>
  vi.fn((type, payload) => {
    notificationsModule.mutations[type](state, payload);
  });

describe('Notifications Store Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Getters', () => {
    it('notificationCount excludes planned time notifications', () => {
      const state = {
        notificationsByTask: {
          'task-1': [
            { id: 'n-1', type: 'reminder' },
            { id: 'n-2', type: TYPE.PLANNED_TIME },
          ],
        },
      };

      const result = notificationsModule.getters.notificationCount(state)('task-1');

      expect(result).toBe(1);
    });

    it('allNotifications returns all notifications', () => {
      const state = {
        notifications: {
          'n-1': { id: 'n-1' },
          'n-2': { id: 'n-2' },
        },
      };

      const result = notificationsModule.getters.allNotifications(state);

      expect(result).toHaveLength(2);
    });

    it('notificationById returns null when missing', () => {
      const state = { notifications: {} };

      const result = notificationsModule.getters.notificationById(state)('missing');

      expect(result).toBeNull();
    });

    it('hasUpcomingNotifications detects future notifications', () => {
      const now = new Date();
      const state = {
        notificationsByTask: {
          'task-1': [
            { id: 'n-1', time: new Date(now.getTime() - 60000) },
            { id: 'n-2', time: new Date(now.getTime() + 60000) },
          ],
        },
      };

      const result = notificationsModule.getters.hasUpcomingNotifications(state)('task-1');

      expect(result).toBe(true);
    });
  });

  describe('Mutations', () => {
    it('clearNotificationsForTask removes task notifications from state', () => {
      const state = createState();
      state.notifications = {
        'n-1': { id: 'n-1', taskId: 'task-1' },
        'n-2': { id: 'n-2', taskId: 'task-2' },
      };
      state.notificationsByTask = {
        'task-1': [{ id: 'n-1', taskId: 'task-1' }],
        'task-2': [{ id: 'n-2', taskId: 'task-2' }],
      };

      notificationsModule.mutations.clearNotificationsForTask(state, 'task-1');

      expect(state.notifications['n-1']).toBeUndefined();
      expect(state.notifications['n-2']).toBeDefined();
      expect(state.notificationsByTask['task-1']).toEqual([]);
    });
  });

  describe('Actions', () => {
    it('fetchNotificationsByTask refreshes task notifications', async () => {
      const state = createState();
      const commit = createCommit(state);
      const taskId = 'task-1';
      const notificationsData = [
        { id: 'n-1', task_id: taskId, type: 'reminder', time: '2024-01-01T00:00:00.000Z' },
        { id: 'n-2', task_id: taskId, type: 'due_date', time: '2024-01-02T00:00:00.000Z' },
      ];
      window.electron.getNotificationsByTask.mockResolvedValue(notificationsData);

      await notificationsModule.actions.fetchNotificationsByTask({ commit }, taskId);

      expect(window.electron.getNotificationsByTask).toHaveBeenCalledWith(taskId);
      expect(state.notificationsByTask[taskId]).toHaveLength(2);
      expect(state.notifications['n-1']).toBeDefined();
      expect(state.notifications['n-2']).toBeDefined();
    });

    it('fetchNotificationsByTask clears stale notifications on error', async () => {
      const state = createState();
      const commit = createCommit(state);
      const taskId = 'task-1';
      state.notifications = {
        'n-1': { id: 'n-1', taskId },
      };
      state.notificationsByTask = {
        [taskId]: [{ id: 'n-1', taskId }],
      };

      window.electron.getNotificationsByTask.mockRejectedValue(new Error('API error'));

      await notificationsModule.actions.fetchNotificationsByTask({ commit }, taskId);

      expect(state.notifications['n-1']).toBeUndefined();
      expect(state.notificationsByTask[taskId]).toEqual([]);
      expect(state.error).toBe('Failed to load notifications');
    });

    it('refreshNotificationCounts dispatches per-task refreshes', async () => {
      const dispatch = vi.fn();
      const rootGetters = {
        'tasks/allTasks': [{ id: 'task-1' }, { id: 'task-2' }],
      };

      await notificationsModule.actions.refreshNotificationCounts({ dispatch, rootGetters });

      expect(dispatch).toHaveBeenCalledWith('fetchNotificationsByTask', 'task-1');
      expect(dispatch).toHaveBeenCalledWith('fetchNotificationsByTask', 'task-2');
    });
  });
});
