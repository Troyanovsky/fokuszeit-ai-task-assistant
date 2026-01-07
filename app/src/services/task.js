/**
 * Task Service
 * Handles task-related operations
 */

import databaseService from './database.js';
import { Task, STATUS, PRIORITY } from '../models/Task.js';
import notificationService from './notification.js';
import recurrenceService from './recurrence.js';
import { isDebugLoggingEnabled } from '../utils/loggingConfig.js';
import { redactTask } from '../utils/loggingSanitizers.js';
import { coerceDateOnly, formatDateOnlyLocal, getTodayDateOnlyLocal } from '../utils/dateTime.js';
import logger from '../../electron-main/logger.js';

class TaskManager {
  /**
   * Get all tasks
   * @returns {Array} - Array of Task instances
   */
  async getTasks() {
    try {
      const tasks = databaseService.query('SELECT * FROM tasks ORDER BY created_at DESC');
      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error('Error getting tasks:', error);
      return [];
    }
  }

  /**
   * Get recent tasks (not done or done within past 2 days)
   * @returns {Array} - Array of Task instances
   */
  async getRecentTasks() {
    try {
      // Get current date
      const today = new Date();

      // Get date 2 days ago
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      // Format date as YYYY-MM-DD (local) for SQLite comparison
      const twoDaysAgoStr = formatDateOnlyLocal(twoDaysAgo);

      // Get tasks that are either not done OR are done but due within past 2 days
      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE status != ? OR (status = ? AND due_date >= ?) ORDER BY created_at DESC',
        [STATUS.DONE, STATUS.DONE, twoDaysAgoStr]
      );

      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error('Error getting recent tasks:', error);
      return [];
    }
  }

  /**
   * Get a task by ID
   * @param {string} id - Task ID
   * @returns {Task|null} - Task instance or null
   */
  async getTaskById(id) {
    try {
      const task = databaseService.queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
      return task ? Task.fromDatabase(task) : null;
    } catch (error) {
      logger.error(`Error getting task ${id}:`, error);
      return null;
    }
  }

  /**
   * Get tasks by project ID
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of Task instances
   */
  async getTasksByProject(projectId) {
    try {
      logger.info(`Querying tasks for project_id: ${projectId}`);
      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      logger.info(`Found ${tasks.length} tasks for project ${projectId}`);
      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error(`Error getting tasks for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Get recent tasks by project ID (not done or done within past 2 days)
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of Task instances
   */
  async getRecentTasksByProject(projectId) {
    try {
      // Get current date
      const today = new Date();

      // Get date 2 days ago
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      // Format date as YYYY-MM-DD (local) for SQLite comparison
      const twoDaysAgoStr = formatDateOnlyLocal(twoDaysAgo);

      logger.info(`Querying recent tasks for project_id: ${projectId}`);
      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE project_id = ? AND (status != ? OR (status = ? AND due_date >= ?)) ORDER BY created_at DESC',
        [projectId, STATUS.DONE, STATUS.DONE, twoDaysAgoStr]
      );
      logger.info(`Found ${tasks.length} recent tasks for project ${projectId}`);
      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error(`Error getting recent tasks for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Add a new task
   * @param {Object} taskData - Task data
   * @returns {Object|boolean} - Task object with ID if successful, false otherwise
   */
  // eslint-disable-next-line complexity
  async addTask(taskData) {
    try {
      const debugEnabled = isDebugLoggingEnabled();
      logger.info('Adding task', {
        projectId: taskData?.projectId ?? taskData?.project_id
      });
      if (debugEnabled) {
        logger.debug('Add task payload', { task: redactTask(taskData) });
      }

      // Make sure project_id is correctly set
      if (!taskData.project_id && taskData.projectId) {
        taskData.project_id = taskData.projectId;
      }

      // Create a Task instance from the data
      const task = new Task(taskData);

      if (debugEnabled) {
        logger.debug('Task instance created', { task: redactTask(task) });
      }

      // Validate the task
      const isValid = task.validate();
      if (!isValid) {
        logger.error('Invalid task data - validation failed');
        logger.error('Task validation details:');
        logger.error('- Name:', task.name, task.name && task.name.trim() !== '');
        logger.error('- Project ID:', task.projectId, !!task.projectId);
        logger.error('- Status:', task.status, Object.values(STATUS).includes(task.status));
        logger.error('- Priority:', task.priority, Object.values(PRIORITY).includes(task.priority));
        return false;
      }

      const data = task.toDatabase();
      if (debugEnabled) {
        logger.debug('Add task database payload', { task: redactTask(data) });
      }

      const result = databaseService.insert(
        `INSERT INTO tasks (
          id, name, description, duration, due_date, planned_time, project_id, 
          dependencies, status, labels, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.name,
          data.description,
          data.duration,
          data.due_date,
          data.planned_time,
          data.project_id,
          data.dependencies,
          data.status,
          data.labels,
          data.priority,
          data.created_at,
          data.updated_at,
        ]
      );

      if (debugEnabled) {
        logger.debug('Task insert result', { result });
      }
      if (result && result.changes > 0) {
        // Handle planned time notification for new task if plannedTime is provided
        if (data.planned_time) {
          try {
            await this._handlePlannedTimeNotificationUpdate(
              data.id,
              data.name,
              null, // no old planned time for new task
              data.planned_time
            );
            logger.debug(`Planned time notification handled for new task ${data.id}`);
          } catch (notificationError) {
            logger.error(
              `Error handling planned time notification for new task ${data.id}:`,
              notificationError
            );
            // Don't fail the task creation if notification fails
          }
        }

        // Return the task data with ID so it can be used for notifications
        return data;
      }
      return false;
    } catch (error) {
      logger.error('Error adding task:', error);
      return false;
    }
  }

  /**
   * Update an existing task
   * @param {Object} taskData - Task data
   * @returns {boolean} - Success status
   */
  // eslint-disable-next-line complexity
  async updateTask(taskData) {
    try {
      const debugEnabled = isDebugLoggingEnabled();
      logger.info('Updating task', { taskId: taskData?.id });
      if (debugEnabled) {
        logger.debug('Update task payload', { task: redactTask(taskData) });
      }

      // Get existing task to preserve any fields not included in the update
      const existingTask = await this.getTaskById(taskData.id);
      if (!existingTask) {
        logger.error(`Task ${taskData.id} not found for update`);
        return false;
      }

      // Store the old planned time for comparison
      const oldPlannedTime = existingTask.plannedTime;

      // Preserve project ID from existing task if not provided in update
      if (!taskData.projectId && !taskData.project_id) {
        taskData.projectId = existingTask.projectId;
      }

      // Create a Task instance from the data, merging with existing task
      const task = new Task({
        ...existingTask.toDatabase(),
        ...taskData,
      });

      // Make sure project_id is correctly set for database
      const taskDbData = task.toDatabase();
      if (!taskDbData.project_id && task.projectId) {
        taskDbData.project_id = task.projectId;
        // Update the task instance with the corrected data
        task.projectId = taskDbData.project_id;
      }

      // Validate the task
      const isValid = task.validate();
      if (!isValid) {
        logger.error('Invalid task data - validation failed');
        return false;
      }

      const data = taskDbData;
      if (debugEnabled) {
        logger.debug('Update task database payload', { task: redactTask(data) });
      }

      const result = databaseService.update(
        `UPDATE tasks SET
          name = ?, description = ?, duration = ?, due_date = ?, planned_time = ?,
          project_id = ?, dependencies = ?, status = ?, labels = ?,
          priority = ?, updated_at = ?
        WHERE id = ?`,
        [
          data.name,
          data.description,
          data.duration,
          data.due_date,
          data.planned_time,
          data.project_id,
          data.dependencies,
          data.status,
          data.labels,
          data.priority,
          data.updated_at,
          data.id,
        ]
      );

      if (result && result.changes > 0) {
        // Handle planned time notification changes
        await this._handlePlannedTimeNotificationUpdate(
          data.id,
          data.name,
          oldPlannedTime,
          data.planned_time
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error updating task ${taskData.id}:`, error);
      return false;
    }
  }

  /**
   * Handle planned time notification updates when a task's planned time changes
   * @param {string} taskId - Task ID
   * @param {string} taskName - Task name
   * @param {string|Date|null} oldPlannedTime - Previous planned time
   * @param {string|Date|null} newPlannedTime - New planned time
   * @private
   */
  // eslint-disable-next-line complexity
  async _handlePlannedTimeNotificationUpdate(taskId, taskName, oldPlannedTime, newPlannedTime) {
    try {
      logger.debug(`Handling planned time notification update for task ${taskId}`);
      logger.debug(`Old planned time: ${oldPlannedTime}`);
      logger.debug(`New planned time: ${newPlannedTime}`);

      // Get existing planned time notifications for this task
      const existingNotifications = await notificationService.getNotificationsByTask(taskId);
      const plannedTimeNotifications = existingNotifications.filter(
        (n) => n.type === 'PLANNED_TIME'
      );

      // Case 1: No planned time before or after - nothing to do
      if (!oldPlannedTime && !newPlannedTime) {
        return;
      }

      // Case 2: Had planned time before, but not anymore - delete existing notifications
      if (oldPlannedTime && !newPlannedTime) {
        for (const notification of plannedTimeNotifications) {
          await notificationService.deleteNotification(notification.id);
          logger.debug(`Deleted planned time notification ${notification.id} for task ${taskId}`);
        }
        return;
      }

      // Case 3: No planned time before, but has one now - create new notification
      if (!oldPlannedTime && newPlannedTime) {
        const notificationData = {
          task_id: taskId,
          taskId: taskId,
          time: newPlannedTime,
          type: 'PLANNED_TIME',
          message: `It's time to work on: ${taskName}`,
        };

        await notificationService.addNotification(notificationData);
        logger.debug(
          `Created new planned time notification for task ${taskId} at ${newPlannedTime}`
        );
        return;
      }

      // Case 4: Had planned time before and has one now - update existing or create new
      if (oldPlannedTime && newPlannedTime) {
        // Convert times to comparable format
        const oldTime = new Date(oldPlannedTime).getTime();
        const newTime = new Date(newPlannedTime).getTime();

        // If times are the same, no need to update
        if (oldTime === newTime) {
          return;
        }

        // Update existing notification or create new one if none exists
        if (plannedTimeNotifications.length > 0) {
          // Update the first notification and delete any extras
          const notificationToUpdate = plannedTimeNotifications[0];
          const updateData = {
            id: notificationToUpdate.id,
            task_id: taskId,
            taskId: taskId,
            time: newPlannedTime,
            type: 'PLANNED_TIME',
            message: `It's time to work on: ${taskName}`,
          };

          await notificationService.updateNotification(updateData);
          logger.debug(
            `Updated planned time notification ${notificationToUpdate.id} for task ${taskId} to ${newPlannedTime}`
          );

          // Delete any extra notifications (there should only be one planned time notification per task)
          for (let i = 1; i < plannedTimeNotifications.length; i++) {
            await notificationService.deleteNotification(plannedTimeNotifications[i].id);
            logger.debug(
              `Deleted duplicate planned time notification ${plannedTimeNotifications[i].id} for task ${taskId}`
            );
          }
        } else {
          // No existing notification, create a new one
          const notificationData = {
            task_id: taskId,
            taskId: taskId,
            time: newPlannedTime,
            type: 'PLANNED_TIME',
            message: `It's time to work on: ${taskName}`,
          };

          await notificationService.addNotification(notificationData);
          logger.debug(
            `Created new planned time notification for task ${taskId} at ${newPlannedTime}`
          );
        }
      }
    } catch (error) {
      logger.error(`Error handling planned time notification update for task ${taskId}:`, error);
    }
  }

  /**
   * Delete a task and all its associated data
   * @param {string} id - Task ID
   * @returns {boolean} - Success status
   */
  // eslint-disable-next-line complexity
  async deleteTask(id) {
    try {
      // First check if the task exists
      const task = await this.getTaskById(id);
      if (!task) {
        logger.error(`Task ${id} not found for deletion`);
        return false;
      }

      // Delete associated notifications
      try {
        const notifications = await notificationService.getNotificationsByTask(id);
        for (const notification of notifications) {
          await notificationService.deleteNotification(notification.id);
        }
        logger.debug(`Deleted ${notifications.length} notifications for task ${id}`);
      } catch (notificationError) {
        logger.error(`Error deleting notifications for task ${id}:`, notificationError);
        // Continue with task deletion even if notification deletion fails
      }

      // Delete associated recurrence rules
      try {
        const recurrenceRules = databaseService.query(
          'SELECT * FROM recurrence_rules WHERE task_id = ?',
          [id]
        );

        for (const rule of recurrenceRules) {
          const deleteResult = databaseService.delete('DELETE FROM recurrence_rules WHERE id = ?', [
            rule.id,
          ]);
          if (deleteResult && deleteResult.changes > 0) {
            logger.debug(`Deleted recurrence rule ${rule.id} for task ${id}`);
          }
        }

        if (recurrenceRules.length > 0) {
          logger.debug(`Deleted ${recurrenceRules.length} recurrence rules for task ${id}`);
        }
      } catch (recurrenceError) {
        logger.error(`Error deleting recurrence rules for task ${id}:`, recurrenceError);
        // Continue with task deletion even if recurrence rule deletion fails
      }

      // Delete the task
      const result = databaseService.delete('DELETE FROM tasks WHERE id = ?', [id]);

      if (result && result.changes > 0) {
        logger.info(`Successfully deleted task ${id} and all associated data`);
        return true;
      } else {
        logger.error(`Failed to delete task ${id} from database`);
        return false;
      }
    } catch (error) {
      logger.error(`Error deleting task ${id}:`, error);
      return false;
    }
  }

  /**
   * Update task status
   * @param {string} id - Task ID
   * @param {string} status - New status
   * @returns {boolean|Object} - Success status or new task data if recurrence created
   */
  async updateTaskStatus(id, status) {
    try {
      // Validate status
      if (!Object.values(STATUS).includes(status)) {
        logger.error('Invalid task status');
        return false;
      }

      // Check if task exists
      const task = await this.getTaskById(id);
      if (!task) {
        logger.error(`Task ${id} not found`);
        return false;
      }

      // Store the old status for comparison
      const oldStatus = task.status;

      // Update status
      const result = databaseService.update(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
        [status, new Date().toISOString(), id]
      );

      if (!result || result.changes === 0) {
        return false;
      }

      // Handle notification management based on status changes
      await this._handleNotificationStatusChange(id, oldStatus, status);

      // Handle recurrence if task was just completed
      if (oldStatus !== STATUS.DONE && status === STATUS.DONE) {
        try {
          logger.debug(`Task ${id} completed, checking for recurrence`);
          const newTaskData = await recurrenceService.processTaskCompletion(id);

          if (newTaskData) {
            logger.debug(`Created recurring task ${newTaskData.id} from completed task ${id}`);
            // Return both success status and new task data
            return {
              success: true,
              newTask: newTaskData,
            };
          }
        } catch (recurrenceError) {
          logger.error(`Error processing recurrence for task ${id}:`, recurrenceError);
          // Don't fail the status update if recurrence processing fails
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error updating task status for ${id}:`, error);
      return false;
    }
  }

  /**
   * Handle notification management when task status changes
   * @param {string} taskId - Task ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @private
   */
  async _handleNotificationStatusChange(taskId, oldStatus, newStatus) {
    try {
      // Get all notifications for this task
      const notifications = await notificationService.getNotificationsByTask(taskId);

      // Case 1: Task was marked as DONE - cancel all scheduled notifications
      if (oldStatus !== STATUS.DONE && newStatus === STATUS.DONE) {
        logger.debug(`Task ${taskId} marked as DONE, cancelling ${notifications.length} notifications`);
        for (const notification of notifications) {
          notificationService.cancelNotification(notification.id);
        }
      }

      // Case 2: Task was changed from DONE to another status - re-schedule notifications
      else if (oldStatus === STATUS.DONE && newStatus !== STATUS.DONE) {
        logger.debug(
          `Task ${taskId} changed from DONE to ${newStatus}, re-scheduling ${notifications.length} notifications`
        );
        for (const notification of notifications) {
          // Only re-schedule notifications that are in the future
          const notificationTime = new Date(notification.time);
          const now = new Date();

          if (notificationTime > now) {
            notificationService.scheduleNotification(notification);
            logger.debug(
              `Re-scheduled notification ${notification.id} for ${notificationTime.toLocaleString()}`
            );
          } else {
            logger.debug(`Notification ${notification.id} time has passed, not re-scheduling`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error handling notification status change for task ${taskId}:`, error);
      // Don't fail the status update if notification handling fails
    }
  }

  /**
   * Get tasks by status
   * @param {...string} statuses - Task statuses
   * @returns {Array} - Array of Task instances
   */
  async getTasksByStatus(...statuses) {
    try {
      // Validate statuses
      if (
        statuses.length === 0 ||
        !statuses.every((status) => Object.values(STATUS).includes(status))
      ) {
        logger.error('Invalid task status');
        return [];
      }

      if (statuses.length === 1) {
        const tasks = databaseService.query(
          'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC',
          [statuses[0]]
        );

        return tasks.map((task) => Task.fromDatabase(task));
      } else {
        // Create placeholders for SQL query
        const placeholders = statuses.map(() => '?').join(', ');

        const tasks = databaseService.query(
          `SELECT * FROM tasks WHERE status IN (${placeholders}) ORDER BY created_at DESC`,
          statuses
        );

        return tasks.map((task) => Task.fromDatabase(task));
      }
    } catch (error) {
      logger.error(`Error getting tasks with status ${statuses.join(', ')}:`, error);
      return [];
    }
  }

  /**
   * Get tasks by priority
   * @param {string} priority - Task priority
   * @returns {Array} - Array of Task instances
   */
  async getTasksByPriority(priority) {
    try {
      // Validate priority
      if (!Object.values(PRIORITY).includes(priority)) {
        logger.error('Invalid task priority');
        return [];
      }

      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE priority = ? ORDER BY created_at DESC',
        [priority]
      );

      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error(`Error getting tasks with priority ${priority}:`, error);
      return [];
    }
  }

  /**
   * Get tasks due soon (within the next 3 days)
   * @returns {Array} - Array of Task instances
   */
  async getTasksDueSoon() {
    try {
      // Get current date and date 3 days from now
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(today.getDate() + 3);

      // Format dates as YYYY-MM-DD for SQLite comparison
      const todayStr = formatDateOnlyLocal(today);
      const futureDateStr = formatDateOnlyLocal(threeDaysLater);

      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE due_date BETWEEN ? AND ? AND status != ? ORDER BY due_date ASC',
        [todayStr, futureDateStr, STATUS.DONE]
      );

      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error('Error getting tasks due soon:', error);
      return [];
    }
  }

  /**
   * Get overdue tasks (due date in the past)
   * @returns {Array} - Array of Task instances
   */
  async getOverdueTasks() {
    try {
      // Get today's local date to find tasks due before today
      const todayStr = getTodayDateOnlyLocal();

      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE due_date < ? AND status != ? ORDER BY due_date ASC',
        [todayStr, STATUS.DONE]
      );

      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error('Error getting overdue tasks:', error);
      return [];
    }
  }

  /**
   * Search tasks by name or description
   * @param {string} query - Search query
   * @returns {Array} - Array of Task instances
   */
  async searchTasks(query) {
    try {
      const tasks = databaseService.query(
        'SELECT * FROM tasks WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC',
        [`%${query}%`, `%${query}%`]
      );

      return tasks.map((task) => Task.fromDatabase(task));
    } catch (error) {
      logger.error('Error searching tasks:', error);
      return [];
    }
  }

  /**
   * Prioritize tasks based on due date, status, and user-set priority
   * @returns {Array} - Array of prioritized Task instances
   */
  async prioritizeTasks() {
    try {
      const todayStr = getTodayDateOnlyLocal();

      // Get all tasks that are not done
      logger.debug('Getting tasks for prioritization with statuses:', STATUS.PLANNING, STATUS.DOING);
      const tasks = await this.getTasksByStatus(STATUS.PLANNING, STATUS.DOING);
      logger.debug(`Retrieved ${tasks.length} tasks for prioritization`);

      // Sort tasks by:
      // 1. Overdue tasks first (highest priority)
      // 2. Tasks due today
      // 3. Tasks with high priority
      // 4. Tasks due soon (within 3 days)
      // 5. Tasks with medium priority
      // 6. All other tasks

      // eslint-disable-next-line complexity
      return tasks.sort((a, b) => {
        const aDueDate = coerceDateOnly(a.dueDate);
        const bDueDate = coerceDateOnly(b.dueDate);

        // Overdue tasks first
        if (aDueDate && bDueDate) {
          if (aDueDate < todayStr && bDueDate >= todayStr) return -1;
          if (bDueDate < todayStr && aDueDate >= todayStr) return 1;
        }

        // Tasks due today
        if (aDueDate === todayStr && bDueDate !== todayStr) return -1;
        if (bDueDate === todayStr && aDueDate !== todayStr) return 1;

        // Tasks with high priority
        if (a.priority === PRIORITY.HIGH && b.priority !== PRIORITY.HIGH) return -1;
        if (b.priority === PRIORITY.HIGH && a.priority !== PRIORITY.HIGH) return 1;

        // Sort by due date (ascending)
        if (aDueDate && bDueDate) {
          return aDueDate.localeCompare(bDueDate);
        }

        // Tasks with due dates come before tasks without due dates
        if (aDueDate && !bDueDate) return -1;
        if (!aDueDate && bDueDate) return 1;

        // Sort by priority as a final tiebreaker
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    } catch (error) {
      logger.error('Error prioritizing tasks:', error);
      return [];
    }
  }

  /**
   * Plan tasks for today based on working hours, buffer time, and existing scheduled tasks
   * @param {Object} preferences - User's preferences including working hours and buffer time
   * @returns {Object} - Planning result with scheduled and unscheduled tasks
   */
  async planMyDay(preferences) {
    try {
      // Extract working hours and buffer time from preferences
      const workingHours = preferences.workingHours || preferences;
      const bufferTime = preferences.bufferTime || 0;

      logger.debug('Planning day with preferences:', { workingHours, bufferTime });

      // Get tasks that need scheduling
      const { tasksToSchedule, today, planningStart, workEnd } =
        await this._getTasksToSchedule(workingHours);

      // If no tasks to plan, return early
      if (tasksToSchedule.length === 0) {
        return {
          scheduled: [],
          unscheduled: [],
          message: 'No tasks to plan for today.',
        };
      }

      // Create timeline of busy slots from existing planned tasks
      const busySlots = await this._createBusySlots(today);

      // Schedule tasks using optimized algorithm
      const { scheduledTasks, unscheduledTasks } = this._optimizeScheduling(
        tasksToSchedule,
        busySlots,
        planningStart,
        workEnd,
        bufferTime
      );

      // Save the scheduled tasks
      for (const task of scheduledTasks) {
        await this.updateTask(task);
      }

      // Create summary message
      const message = this._createSummaryMessage(scheduledTasks, unscheduledTasks, tasksToSchedule);

      return {
        scheduled: scheduledTasks,
        unscheduled: unscheduledTasks,
        message,
      };
    } catch (error) {
      logger.error('Error planning day:', error);
      return {
        scheduled: [],
        unscheduled: [],
        message: `Error planning day: ${error.message}`,
      };
    }
  }

  /**
   * Get and filter tasks that need scheduling
   * @param {Object} workingHours - Working hours configuration
   * @returns {Object} - Tasks to schedule and time boundaries
   */
  async _getTasksToSchedule(workingHours) {
    // Get current date
    const today = new Date();
    const todayStr = getTodayDateOnlyLocal(); // YYYY-MM-DD (local)

    // Get all tasks
    const allTasks = await this.getTasks();

    // Filter tasks due today
    const tasksDueToday = allTasks.filter((task) => {
      if (!task.dueDate) return false;
      const taskDateStr = coerceDateOnly(task.dueDate);
      return taskDateStr === todayStr;
    });

    // Filter tasks that need planning
    const unplannedTasks = tasksDueToday.filter((task) => {
      // Task doesn't have a planned time
      const hasNoPlannedTime = !task.plannedTime;

      // Task already has a planned time, but it has passed and the task doesn't have status doing/done
      const plannedTimePassed =
        task.plannedTime &&
        new Date(task.plannedTime) < today &&
        task.status !== STATUS.DOING &&
        task.status !== STATUS.DONE;

      return (
        (hasNoPlannedTime || plannedTimePassed) &&
        task.status !== STATUS.DOING &&
        task.status !== STATUS.DONE
      );
    });

    logger.debug(`Found ${unplannedTasks.length} unplanned tasks for today`);

    // Parse working hours
    const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = workingHours.endTime.split(':').map(Number);

    // Create Date objects for start and end of working hours today
    const workStart = new Date(today);
    workStart.setHours(startHour, startMinute, 0, 0);

    const workEnd = new Date(today);
    workEnd.setHours(endHour, endMinute, 0, 0);

    // If current time is after work start, use current time as start
    const planningStart = today > workStart ? new Date(today) : new Date(workStart);

    logger.debug(`Planning start time: ${planningStart.toLocaleTimeString()}`);
    logger.debug(`Work end time: ${workEnd.toLocaleTimeString()}`);

    // Sort unplanned tasks by priority first, then by duration (shorter first)
    const tasksToSchedule = [...unplannedTasks].sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // If same priority, sort by duration (shorter first)
      const aDuration = a.duration !== null ? a.duration : 30;
      const bDuration = b.duration !== null ? b.duration : 30;
      return aDuration - bDuration;
    });

    return { tasksToSchedule, today, planningStart, workEnd };
  }

  /**
   * Create timeline of busy slots from existing planned tasks
   * @param {Date} today - Today's date
   * @returns {Array} - Array of busy time slots
   */
  async _createBusySlots(today) {
    // Get all tasks
    const allTasks = await this.getTasks();

    // Get tasks that already have planned time for today and are NOT being rescheduled
    const plannedTasks = allTasks.filter((task) => {
      if (!task.plannedTime) return false;

      const plannedDate = new Date(task.plannedTime);
      const isToday =
        plannedDate.getFullYear() === today.getFullYear() &&
        plannedDate.getMonth() === today.getMonth() &&
        plannedDate.getDate() === today.getDate();

      if (!isToday) return false;

      // Exclude tasks with past planned times that need rescheduling
      // (i.e., tasks that are not in progress or done)
      const plannedTimePassed = new Date(task.plannedTime) < today;
      const needsRescheduling =
        plannedTimePassed && task.status !== STATUS.DOING && task.status !== STATUS.DONE;

      // Only include tasks that don't need rescheduling
      return !needsRescheduling;
    });

    logger.debug(
      `Found ${plannedTasks.length} already planned tasks for today (excluding tasks needing rescheduling)`
    );

    // Create timeline of busy slots from existing planned tasks
    const busySlots = plannedTasks.map((task) => {
      const start = new Date(task.plannedTime);
      const end = new Date(start);
      // Use task duration if available, otherwise default to 30 min
      const durationMinutes = task.duration !== null ? task.duration : 30;
      end.setMinutes(end.getMinutes() + durationMinutes);

      return { start, end };
    });

    // Sort busy slots by start time
    busySlots.sort((a, b) => a.start - b.start);

    return busySlots;
  }

  /**
   * Optimize task scheduling using a two-pass algorithm
   * @param {Array} tasksToSchedule - Tasks to schedule
   * @param {Array} busySlots - Existing busy time slots
   * @param {Date} planningStart - Start time for planning
   * @param {Date} workEnd - End of working hours
   * @param {number} bufferTime - Buffer time in minutes
   * @returns {Object} - Scheduled and unscheduled tasks
   */
  _optimizeScheduling(tasksToSchedule, busySlots, planningStart, workEnd, bufferTime) {
    const scheduledTasks = [];
    const unscheduledTasks = [];

    // First pass: Try to schedule tasks in priority order
    const remainingTasks = [];
    let currentTime = new Date(planningStart);

    for (const task of tasksToSchedule) {
      const slot = this._findAvailableSlot(task, currentTime, workEnd, busySlots, bufferTime);

      if (slot) {
        const scheduledTask = this._scheduleTaskInSlot(task, slot, busySlots, bufferTime);
        scheduledTasks.push(scheduledTask);
        currentTime = new Date(slot.end);
      } else {
        remainingTasks.push(task);
      }
    }

    // Second pass: Try to fit remaining tasks in any available gaps
    for (const task of remainingTasks) {
      const slot = this._findAnyAvailableSlot(task, planningStart, workEnd, busySlots, bufferTime);

      if (slot) {
        const scheduledTask = this._scheduleTaskInSlot(task, slot, busySlots, bufferTime);
        scheduledTasks.push(scheduledTask);
      } else {
        unscheduledTasks.push(task);
      }
    }

    return { scheduledTasks, unscheduledTasks };
  }

  /**
   * Find an available time slot for a task starting from a specific time
   * @param {Object} task - Task to schedule
   * @param {Date} startTime - Start time to search from
   * @param {Date} workEnd - End of working hours
   * @param {Array} busySlots - Existing busy time slots
   * @param {number} bufferTime - Buffer time in minutes
   * @returns {Object|null} - Available slot or null if not found
   */
  _findAvailableSlot(task, startTime, workEnd, busySlots, bufferTime) {
    const durationMinutes = task.duration !== null ? task.duration : 30;
    let currentTime = new Date(startTime);
    const now = new Date();

    // Ensure we never schedule before the current time
    if (currentTime < now) {
      currentTime = new Date(now);
    }

    while (currentTime < workEnd) {
      // Add buffer time before the task
      const taskStartTime = new Date(currentTime);
      taskStartTime.setMinutes(taskStartTime.getMinutes() + bufferTime);

      // Calculate task end time
      const taskEndTime = new Date(taskStartTime);
      taskEndTime.setMinutes(taskEndTime.getMinutes() + durationMinutes);

      // Check if this slot fits before end of work day
      if (taskEndTime > workEnd) {
        break;
      }

      // Check if this slot overlaps with any busy slot
      const overlaps = busySlots.some((slot) => {
        return (
          (taskStartTime >= slot.start && taskStartTime < slot.end) || // Start time is within a busy slot
          (taskEndTime > slot.start && taskEndTime <= slot.end) || // End time is within a busy slot
          (taskStartTime <= slot.start && taskEndTime >= slot.end) // Slot is completely within our time
        );
      });

      if (!overlaps) {
        // Slot found!
        return {
          start: taskStartTime,
          end: taskEndTime,
        };
      }

      // Find the next available time after the current busy slot
      const nextSlot = busySlots.find(
        (slot) => slot.start <= taskStartTime && slot.end > taskStartTime
      );
      if (nextSlot) {
        // Move to the end of this busy slot
        currentTime = new Date(nextSlot.end);
      } else {
        // Find the next busy slot that starts after current time
        const futureSlots = busySlots.filter((slot) => slot.start > taskStartTime);
        if (futureSlots.length > 0) {
          // Sort by start time and move to the next slot
          futureSlots.sort((a, b) => a.start - b.start);
          currentTime = new Date(futureSlots[0].end);
        } else {
          // No more busy slots, move forward by 15 minutes and try again
          currentTime.setMinutes(currentTime.getMinutes() + 15);
        }
      }
    }

    return null;
  }

  /**
   * Find any available time slot for a task (gap-filling algorithm)
   * @param {Object} task - Task to schedule
   * @param {Date} planningStart - Start of planning window
   * @param {Date} workEnd - End of working hours
   * @param {Array} busySlots - Existing busy time slots
   * @param {number} bufferTime - Buffer time in minutes
   * @returns {Object|null} - Available slot or null if not found
   */
  // eslint-disable-next-line complexity
  _findAnyAvailableSlot(task, planningStart, workEnd, busySlots, bufferTime) {
    const durationMinutes = task.duration !== null ? task.duration : 30;
    const totalTimeNeeded = durationMinutes; // Removed buffer time from total calculation
    const now = new Date();

    // Ensure we never schedule before the current time
    const effectivePlanningStart = planningStart < now ? now : planningStart;

    // Sort busy slots by start time
    const sortedSlots = [...busySlots].sort((a, b) => a.start - b.start);

    // Check gap before first busy slot
    if (sortedSlots.length > 0) {
      const firstSlot = sortedSlots[0];
      const gapDuration = (firstSlot.start - effectivePlanningStart) / (1000 * 60); // Convert to minutes

      if (gapDuration >= totalTimeNeeded + bufferTime) {
        // Added buffer time here
        const taskStartTime = new Date(effectivePlanningStart);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + bufferTime);

        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + durationMinutes);

        return {
          start: taskStartTime,
          end: taskEndTime,
        };
      }
    }

    // Check gaps between busy slots
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentSlot = sortedSlots[i];
      const nextSlot = sortedSlots[i + 1];

      const gapStart = currentSlot.end;
      const gapEnd = nextSlot.start;

      // Ensure gap start is not before current time
      const effectiveGapStart = gapStart < now ? now : gapStart;
      const gapDuration = (gapEnd - effectiveGapStart) / (1000 * 60); // Convert to minutes

      if (gapDuration >= totalTimeNeeded + bufferTime) {
        // Added buffer time here
        const taskStartTime = new Date(effectiveGapStart);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + bufferTime);

        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + durationMinutes);

        // Ensure the task doesn't extend beyond the gap
        if (taskEndTime <= gapEnd) {
          return {
            start: taskStartTime,
            end: taskEndTime,
          };
        }
      }
    }

    // Check gap after last busy slot
    if (sortedSlots.length > 0) {
      const lastSlot = sortedSlots[sortedSlots.length - 1];
      const gapStart = lastSlot.end;

      // Ensure gap start is not before current time
      const effectiveGapStart = gapStart < now ? now : gapStart;
      const gapDuration = (workEnd - effectiveGapStart) / (1000 * 60); // Convert to minutes

      if (gapDuration >= totalTimeNeeded + bufferTime) {
        // Added buffer time here
        const taskStartTime = new Date(effectiveGapStart);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + bufferTime);

        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + durationMinutes);

        if (taskEndTime <= workEnd) {
          return {
            start: taskStartTime,
            end: taskEndTime,
          };
        }
      }
    }

    // If no busy slots exist, check if task fits in the entire work period
    if (sortedSlots.length === 0) {
      const totalWorkTime = (workEnd - effectivePlanningStart) / (1000 * 60); // Convert to minutes

      if (totalWorkTime >= totalTimeNeeded + bufferTime) {
        // Added buffer time here
        const taskStartTime = new Date(effectivePlanningStart);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + bufferTime);

        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + durationMinutes);

        return {
          start: taskStartTime,
          end: taskEndTime,
        };
      }
    }

    return null;
  }

  /**
   * Schedule a task in a specific time slot
   * @param {Object} task - Task to schedule
   * @param {Object} slot - Time slot with start and end times
   * @param {Array} busySlots - Existing busy time slots (modified in place)
   * @param {number} bufferTime - Buffer time in minutes
   * @returns {Object} - Scheduled task
   */
  _scheduleTaskInSlot(task, slot, busySlots, _eBufferTime) {
    // Create a copy of the task with planned time
    const scheduledTask = new Task(task);
    scheduledTask.plannedTime = new Date(slot.start);

    // Add this to busy slots for future tasks (without buffer time)
    busySlots.push({
      start: new Date(slot.start),
      end: new Date(slot.end),
    });

    // Sort busy slots again
    busySlots.sort((a, b) => a.start - b.start);

    return scheduledTask;
  }

  /**
   * Create summary message for planning results
   * @param {Array} scheduledTasks - Successfully scheduled tasks
   * @param {Array} unscheduledTasks - Tasks that couldn't be scheduled
   * @param {Array} tasksToSchedule - All tasks that were attempted to be scheduled
   * @returns {string} - Summary message
   */
  _createSummaryMessage(scheduledTasks, unscheduledTasks, tasksToSchedule) {
    let message = '';
    if (scheduledTasks.length > 0) {
      message = `${scheduledTasks.length} of ${tasksToSchedule.length} tasks scheduled.`;
      if (unscheduledTasks.length > 0) {
        message += ` ${unscheduledTasks.length} tasks could not fit in your schedule.`;
      }
    } else {
      message = 'No tasks could be scheduled. Your day is already full.';
    }
    return message;
  }

  /**
   * Reschedule all overdue tasks to today's date.
   * @returns {number} - The number of tasks rescheduled.
   */
  async rescheduleOverdueTasksToToday() {
    try {
      logger.debug('Attempting to reschedule all overdue tasks to today.');
      const overdueTasks = await this.getOverdueTasks();
      logger.debug(`Found ${overdueTasks.length} overdue tasks to reschedule.`);

      if (overdueTasks.length === 0) {
        return 0;
      }

      const todayStr = getTodayDateOnlyLocal(); // YYYY-MM-DD (local)
      let rescheduledCount = 0;

      for (const task of overdueTasks) {
        // Only reschedule tasks that are not already done
        if (task.status !== STATUS.DONE) {
          const updatedTaskData = { ...task.toDatabase(), dueDate: todayStr };
          // Ensure projectId is correctly set for update if it was missing or null
          if (!updatedTaskData.project_id && task.projectId) {
            updatedTaskData.project_id = task.projectId;
          }
          const success = await this.updateTask(updatedTaskData);
          if (success) {
            rescheduledCount++;
            logger.debug(`Rescheduled task ${task.id} to today: ${todayStr}`);
          } else {
            logger.warn(`Failed to reschedule task ${task.id}.`);
          }
        }
      }
      logger.info(`Successfully rescheduled ${rescheduledCount} overdue tasks.`);
      return rescheduledCount;
    } catch (error) {
      logger.error('Error rescheduling overdue tasks:', error);
      return 0;
    }
  }
}

// Create singleton instance
const taskManager = new TaskManager();

export default taskManager;
