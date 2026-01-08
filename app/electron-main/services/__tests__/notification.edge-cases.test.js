/**
 * Edge case tests for notification scheduling
 * Tests for clock changes, sleep/wake cycles, app restarts, and idempotent sending
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Notification, TYPE } from '../../../shared/models/Notification';
import notificationService from '../notification';

// Mock the database service
vi.mock('../database', () => {
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

// Mock Electron's IPC
vi.mock('electron', () => {
  const mockNotification = {
    show: vi.fn(),
    on: vi.fn(),
  };

  const mockWebContents = { send: vi.fn() };
  const mockWindow = { webContents: mockWebContents, isDestroyed: () => false };

  return {
    ipcMain: {
      emit: vi.fn(),
    },
    Notification: vi.fn(() => mockNotification),
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([mockWindow]),
    },
  };
});

// Import mocks after they are defined
import databaseService from '../database';
import { Notification as ElectronNotification } from 'electron';

// Add isSupported to the Electron Notification mock
ElectronNotification.isSupported = vi.fn().mockReturnValue(true);

describe('Notification Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the scheduled notifications map
    notificationService.scheduledNotifications = new Map();

    // Mock Date.now and setTimeout
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout');
    vi.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Clock Change Handling', () => {
    it('should reschedule notifications when clock moves forward', async () => {
      // Arrange: Create notification for 1 minute in future
      const notification = new Notification({
        id: 'test-1',
        taskId: 'task-1',
        time: new Date(Date.now() + 60000),
        type: TYPE.REMINDER,
      });

      databaseService.query.mockReturnValue([notification]);
      databaseService.update.mockReturnValue({ changes: 1 });

      const rescheduleSpy = vi.spyOn(notificationService, 'rescheduleAllPending');

      // Act: Simulate clock moving forward by 30 minutes
      vi.advanceTimersByTime(1800000);

      // Assert: Should have rescheduled
      await notificationService.rescheduleAllPending();
      expect(rescheduleSpy).toHaveBeenCalled();
    });

    it('should reschedule notifications when clock moves backward', async () => {
      // Arrange: Create notification
      const notification = new Notification({
        id: 'test-2',
        taskId: 'task-2',
        time: new Date(Date.now() + 60000),
        type: TYPE.REMINDER,
      });

      databaseService.query.mockReturnValue([notification]);

      // Act & Assert: Reschedule should handle backwards time gracefully
      const result = await notificationService.rescheduleAllPending();
      expect(result.success).toBe(true);
    });
  });

  describe('Idempotent Sending', () => {
    it('should not send notification if already marked as sent', async () => {
      // Arrange: Create already-sent notification
      const notification = new Notification({
        id: 'test-3',
        taskId: 'task-3',
        time: new Date(),
        type: TYPE.REMINDER,
        sentAt: new Date(), // Already sent
      });

      const sendSpy = vi.spyOn(notificationService, 'markAsSent');
      const mockTask = { name: 'Test Task', status: 'planning' };
      databaseService.queryOne.mockReturnValue(mockTask);

      // Act
      notificationService.sendNotification(notification);

      // Assert: Should not mark as sent again
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should mark notification as sent after delivery', async () => {
      // Arrange: Create unsent notification
      const notification = new Notification({
        id: 'test-4',
        taskId: 'task-4',
        time: new Date(),
        type: TYPE.REMINDER,
        sentAt: null,
      });

      const mockTask = { name: 'Test Task', status: 'planning' };
      databaseService.queryOne.mockReturnValue(mockTask);
      databaseService.update.mockReturnValue({ changes: 1 });

      const markSpy = vi.spyOn(notificationService, 'markAsSent');

      // Act
      await notificationService.sendNotification(notification);

      // Assert: Should mark as sent with both id and notification
      expect(markSpy).toHaveBeenCalledWith('test-4', notification);
    });
  });

  describe('App Restart Scenarios', () => {
    it('should only load unsent notifications on startup', async () => {
      // Arrange: Mix of sent and unsent notifications
      const mockNotifications = [
        {
          id: 'sent-1',
          task_id: 'task-1',
          time: new Date(Date.now() + 60000).toISOString(),
          type: TYPE.REMINDER,
          message: 'Already sent',
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(), // Already sent
        },
        {
          id: 'unsent-1',
          task_id: 'task-2',
          time: new Date(Date.now() + 60000).toISOString(),
          type: TYPE.REMINDER,
          message: 'Not sent',
          created_at: new Date().toISOString(),
          sent_at: null, // Not sent
        },
      ];

      // Mock database to return all notifications
      // But getUpcomingNotifications filters by sent_at IS NULL
      databaseService.query.mockReturnValue([mockNotifications[1]]);

      // Act
      await notificationService.loadScheduledNotifications();

      // Assert: Only unsent notification should be scheduled
      expect(notificationService.scheduledNotifications.size).toBe(1);
    });
  });

  describe('Sleep/Wake Handling', () => {
    it('should reschedule notifications after system wake', async () => {
      // Arrange
      const notification = new Notification({
        id: 'test-5',
        taskId: 'task-5',
        time: new Date(Date.now() + 60000),
        type: TYPE.REMINDER,
      });

      databaseService.query.mockReturnValue([notification]);
      vi.spyOn(notificationService, 'scheduleNotification');

      // Act: Simulate wake (call rescheduleAllPending)
      const result = await notificationService.rescheduleAllPending();

      // Assert
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(notificationService.scheduleNotification).toHaveBeenCalledWith(notification);
    });
  });

  describe('Past Notification Handling', () => {
    it('should not schedule notifications already sent in the past', async () => {
      // Arrange: Mock empty result (no unsent notifications)
      const scheduleSpy = vi.spyOn(notificationService, 'scheduleNotification');
      databaseService.query.mockReturnValue([]);

      // Act
      await notificationService.loadScheduledNotifications();

      // Assert: Should not be scheduled
      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Access', () => {
    it('should handle multiple schedule attempts gracefully', async () => {
      // Arrange
      const notification = new Notification({
        id: 'test-7',
        taskId: 'task-7',
        time: new Date(Date.now() + 60000),
        type: TYPE.REMINDER,
      });

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // Act: Schedule same notification twice
      notificationService.scheduleNotification(notification);
      notificationService.scheduleNotification(notification);

      // Assert: Should cancel first schedule and create new one
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(notificationService.scheduledNotifications.size).toBe(1);
    });
  });

  describe('markAsSent', () => {
    it('should update notification with sent timestamp', async () => {
      // Arrange
      databaseService.update.mockReturnValue({ changes: 1 });

      // Act
      const result = await notificationService.markAsSent('test-id');

      // Assert
      expect(result.success).toBe(true);
      expect(result.sentAt).toBeInstanceOf(Date);
      expect(databaseService.update).toHaveBeenCalledWith(
        'UPDATE notifications SET sent_at = ? WHERE id = ?',
        expect.arrayContaining([expect.any(String), 'test-id'])
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      databaseService.update.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act & Assert - should not throw
      const result = await notificationService.markAsSent('test-id');

      // Assert
      expect(result.success).toBe(false);
      expect(result.sentAt).toBeNull();
    });
  });

  describe('cleanupOldSentNotifications', () => {
    it('should delete old sent notifications', async () => {
      // Arrange
      databaseService.delete.mockReturnValue({ changes: 5 });

      // Act
      const result = await notificationService.cleanupOldSentNotifications(30);

      // Assert
      expect(result).toBe(true);
      expect(databaseService.delete).toHaveBeenCalled();
    });

    it('should return true when no old notifications exist', async () => {
      // Arrange
      databaseService.delete.mockReturnValue({ changes: 0 });

      // Act
      const result = await notificationService.cleanupOldSentNotifications(30);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getUpcomingNotifications filters sent', () => {
    it('should only return unsent notifications', async () => {
      // Arrange
      const mockNotifications = [
        {
          id: 'notif-1',
          task_id: 'task-1',
          time: new Date(Date.now() + 60000).toISOString(),
          type: TYPE.REMINDER,
          message: 'Unsent',
          created_at: new Date().toISOString(),
          sent_at: null,
        },
      ];
      databaseService.query.mockReturnValue(mockNotifications);

      // Act
      const result = await notificationService.getUpcomingNotifications();

      // Assert
      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM notifications WHERE time > ? AND sent_at IS NULL ORDER BY time ASC',
        expect.any(Array) // Array containing timestamp parameter
      );
      expect(result).toHaveLength(1);
      expect(result[0].sentAt).toBeNull();
    });
  });
});
