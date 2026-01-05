<!-- Task form component for creating and editing tasks, notifications, and recurrence. -->
<template>
  <div class="task-form">
    <h3 class="text-lg font-medium mb-3">{{ task ? 'Edit Task' : 'Add Task' }}</h3>
    <form @submit.prevent="saveTask">
      <div class="mb-3">
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div class="mb-3">
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1"
          >Description</label
        >
        <textarea
          id="description"
          v-model="formData.description"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        ></textarea>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="status"
            v-model="formData.status"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="planning">Planning</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div>
          <label for="priority" class="block text-sm font-medium text-gray-700 mb-1"
            >Priority</label
          >
          <select
            id="priority"
            v-model="formData.priority"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label for="dueDate" class="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input
            id="dueDate"
            v-model="formData.dueDate"
            type="date"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 date-input"
            :class="{
              'border-orange-500 focus:ring-orange-500 focus:border-orange-500':
                isPlannedTimeAfterDueDate,
              'border-red-500 focus:ring-red-500 focus:border-red-500': isDueDateInPast,
            }"
            :min="currentDate"
          />
          <p v-if="isDueDateInPast" class="text-xs mt-1 text-red-500">
            Warning: Due date is in the past
          </p>
        </div>

        <div>
          <label for="duration" class="block text-sm font-medium text-gray-700 mb-1"
            >Duration (minutes)</label
          >
          <input
            id="duration"
            v-model.number="formData.duration"
            type="number"
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Planned Time Section -->
      <div class="mb-3">
        <label for="plannedTime" class="block text-sm font-medium text-gray-700 mb-1"
          >Planned Time</label
        >
        <div class="grid grid-cols-2 gap-3">
          <div>
            <input
              id="plannedDate"
              v-model="formData.plannedDate"
              type="date"
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 date-input"
              :class="{
                'border-orange-500 focus:ring-orange-500 focus:border-orange-500':
                  isPlannedTimeAfterDueDate,
                'border-red-500 focus:ring-red-500 focus:border-red-500': isPlannedTimeInPast,
              }"
              :min="currentDate"
            />
          </div>
          <div>
            <input
              id="plannedTime"
              v-model="formData.plannedTime"
              type="time"
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              :class="{
                'border-orange-500 focus:ring-orange-500 focus:border-orange-500':
                  isPlannedTimeAfterDueDate,
                'border-red-500 focus:ring-red-500 focus:border-red-500': isPlannedTimeInPast,
              }"
              :min="formData.plannedDate === currentDate ? currentTime : undefined"
            />
          </div>
        </div>
        <p
          v-if="formData.plannedDate && formData.plannedTime"
          class="text-xs mt-1"
          :class="{
            'text-orange-500': isPlannedTimeAfterDueDate && !isPlannedTimeInPast,
            'text-red-500': isPlannedTimeInPast,
            'text-gray-500': !isPlannedTimeAfterDueDate && !isPlannedTimeInPast,
          }"
        >
          <span v-if="isPlannedTimeInPast">Warning: Planned time is in the past</span>
          <span v-else-if="isPlannedTimeAfterDueDate">Warning: Planned time is after due date</span>
          <span v-else>A reminder notification will be automatically set for this time.</span>
        </p>
      </div>

      <!-- Notifications Section -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">Additional Notifications</label>
          <button
            type="button"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            @click="addNewNotification"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Notification
          </button>
        </div>

        <div v-if="notifications.length === 0" class="text-sm text-gray-500 italic mb-2">
          No additional notifications set for this task.
        </div>

        <div v-else class="space-y-2 mb-3">
          <div
            v-for="(notification, index) in notifications"
            :key="notification.id"
            class="flex items-center p-2 rounded-md border border-gray-200 bg-gray-50"
          >
            <div class="flex-1 grid grid-cols-2 gap-2">
              <div>
                <input
                  v-model="notification.date"
                  type="date"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 date-input"
                  :min="currentDate"
                />
              </div>
              <div>
                <input
                  v-model="notification.time"
                  type="time"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  :min="notification.date === currentDate ? currentTime : undefined"
                />
              </div>
            </div>
            <button
              type="button"
              class="ml-2 text-red-500 hover:text-red-700"
              @click="removeNotification(index)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Recurrence Section -->
      <RecurrenceForm
        :task-id="task ? task.id : null"
        :initial-rule="existingRecurrenceRule"
        @recurrence-change="handleRecurrenceChange"
      />

      <div class="flex justify-end space-x-2">
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {{ task ? 'Update' : 'Create' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { reactive, onMounted, ref, computed } from 'vue';
import { TYPE } from '../../models/Notification';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../services/logger';
import RecurrenceForm from '../recurrence/RecurrenceForm.vue';

const DEFAULT_NOTIFICATION_TIME = '09:00';

const toDateInputValue = (date) => date.toISOString().split('T')[0];

const toTimeInputValue = (date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildDateTimeFromInput = (dateString, timeString) => {
  const [year, month, day] = dateString.split('-');
  const [hours, minutes] = timeString.split(':');

  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  );
};

const applyTaskToFormData = (task, formData) => {
  formData.name = task.name;
  formData.description = task.description || '';
  formData.status = task.status;
  formData.priority = task.priority;
  formData.duration = task.duration !== null ? task.duration : 0;

  if (task.dueDate) {
    const date = new Date(task.dueDate);
    formData.dueDate = toDateInputValue(date);
  }

  if (task.plannedTime) {
    const plannedDateTime = new Date(task.plannedTime);
    const localDate = plannedDateTime.toLocaleDateString('en-CA');
    const localTime = toTimeInputValue(plannedDateTime);
    formData.plannedDate = localDate;
    formData.plannedTime = localTime;
    logger.info(
      `Converted UTC plannedTime ${task.plannedTime} to local: ${localDate} ${localTime}`
    );
  }
};

const buildTaskData = (formData, projectId, existingTask) => {
  const taskData = {
    name: formData.name.trim(),
    description: formData.description.trim(),
    status: formData.status,
    priority: formData.priority,
    projectId,
    duration: formData.duration !== '' ? Number(formData.duration) : 0,
    dueDate: formData.dueDate || null,
    plannedTime: null,
  };

  if (formData.plannedDate && formData.plannedTime) {
    const plannedDateTime = buildDateTimeFromInput(formData.plannedDate, formData.plannedTime);
    taskData.plannedTime = plannedDateTime.toISOString();
    logger.info(
      `Saving plannedTime: Local ${plannedDateTime.toString()} as UTC ${taskData.plannedTime}`
    );
  }

  if (existingTask) {
    taskData.id = existingTask.id;
    taskData.createdAt = existingTask.createdAt;
  }

  return taskData;
};

const resetFormData = (formData) => {
  formData.name = '';
  formData.description = '';
  formData.dueDate = '';
  formData.duration = 0;
  formData.plannedDate = '';
  formData.plannedTime = '';
};

const formatNotificationsForUi = (existingNotifications) =>
  existingNotifications
    .filter((notification) => notification.type !== 'PLANNED_TIME')
    .map((notification) => {
      const notificationDate = new Date(notification.time);
      const date = toDateInputValue(notificationDate);
      const time = toTimeInputValue(notificationDate);

      logger.info(
        `Notification ${notification.id} time: ${notificationDate.toLocaleString()}, formatted as ${date} ${time}`
      );

      return {
        id: notification.id,
        date,
        time,
        type: notification.type,
        message: notification.message,
        isExisting: true,
      };
    });

export default {
  name: 'TaskForm',
  components: {
    RecurrenceForm,
  },
  props: {
    task: {
      type: Object,
      default: null,
    },
    projectId: {
      type: String,
      required: true,
    },
  },
  emits: ['save', 'cancel'],
  setup(props, { emit }) {
    // Current date in YYYY-MM-DD format for min date attribute
    const currentDate = computed(() => {
      return toDateInputValue(new Date());
    });

    // Current time in HH:MM format
    const currentTime = computed(() => {
      return toTimeInputValue(new Date());
    });

    const formData = reactive({
      name: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      dueDate: '',
      duration: 0,
      plannedDate: '',
      plannedTime: '',
      projectId: props.projectId,
    });

    // Store notifications as an array of objects with date and time properties
    const notifications = ref([]);

    // Track notifications to be deleted (existing ones)
    const notificationsToDelete = ref([]);

    // Recurrence-related data
    const existingRecurrenceRule = ref(null);
    const pendingRecurrenceData = ref(null);

    // Check if planned time is after due date
    const isPlannedTimeAfterDueDate = computed(() => {
      // Only validate if both due date and planned time are set
      if (!formData.dueDate || !formData.plannedDate || !formData.plannedTime) {
        return false;
      }

      const dueDate = new Date(formData.dueDate);
      dueDate.setHours(23, 59, 59); // End of the due date

      const plannedDateTime = buildDateTimeFromInput(formData.plannedDate, formData.plannedTime);

      return plannedDateTime > dueDate;
    });

    // Check if planned time is in the past
    const isPlannedTimeInPast = computed(() => {
      if (!formData.plannedDate || !formData.plannedTime) {
        return false;
      }

      const plannedDateTime = buildDateTimeFromInput(formData.plannedDate, formData.plannedTime);

      const now = new Date();

      return plannedDateTime < now;
    });

    // Check if due date is in the past
    const isDueDateInPast = computed(() => {
      if (!formData.dueDate) {
        return false;
      }

      // Create due date at beginning of day
      const dueDate = new Date(formData.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Get current date at beginning of day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Compare dates (allow today)
      return dueDate < today;
    });

    // Function to confirm with user about past dates
    const confirmDateIssues = async () => {
      if (isDueDateInPast.value || isPlannedTimeInPast.value) {
        const confirmMessage = [];

        if (isDueDateInPast.value) {
          confirmMessage.push('• The due date is in the past');
        }

        if (isPlannedTimeInPast.value) {
          confirmMessage.push('• The planned time is in the past');
        }

        const shouldContinue = await window.electron.showConfirmDialog(
          'Warning: Date issues detected',
          `The following issues were detected:\n${confirmMessage.join('\n')}\n\nDo you want to continue anyway?`
        );

        if (!shouldContinue) {
          return false; // User canceled
        }
      }
      return true; // No issues or user confirmed
    };

    // Handle recurrence changes from the RecurrenceForm
    const handleRecurrenceChange = (ruleData) => {
      pendingRecurrenceData.value = ruleData;
      logger.info('Recurrence data changed:', ruleData);
    };

    onMounted(async () => {
      if (props.task) {
        applyTaskToFormData(props.task, formData);

        // Fetch existing notifications for the task
        try {
          logger.info(`Fetching notifications for task: ${props.task.id}`);
          const existingNotifications = await window.electron.getNotificationsByTask(props.task.id);
          logger.info('Existing notifications:', existingNotifications);

          if (existingNotifications && existingNotifications.length > 0) {
            notifications.value = formatNotificationsForUi(existingNotifications);

            // Note: Planned time notifications are now handled automatically by the task service

            logger.info('Formatted notifications for UI:', notifications.value);
          }
        } catch (error) {
          logger.error('Error fetching notifications:', error);
        }

        // Fetch existing recurrence rule for the task
        try {
          logger.info(`Fetching recurrence rule for task: ${props.task.id}`);
          const recurrenceRule = await window.electron.getRecurrenceRuleByTask(props.task.id);
          existingRecurrenceRule.value = recurrenceRule;
          logger.info('Existing recurrence rule:', recurrenceRule);
        } catch (error) {
          logger.error('Error fetching recurrence rule:', error);
        }
      }
    });

    const addNewNotification = () => {
      notifications.value.push({
        id: uuidv4(), // Generate a temporary ID
        date: toDateInputValue(new Date()),
        time: DEFAULT_NOTIFICATION_TIME,
        type: TYPE.REMINDER,
        message: '',
        isExisting: false,
      });
    };

    const removeNotification = (index) => {
      const notification = notifications.value[index];

      // If it's an existing notification, add it to the list to be deleted
      if (notification.isExisting) {
        notificationsToDelete.value.push(notification.id);
      }

      // Remove from the UI list
      notifications.value.splice(index, 1);
    };

    const clearNotifications = () => {
      notifications.value = [];
      notificationsToDelete.value = [];
    };

    const handleExistingTaskSave = async (taskData) => {
      emit('save', taskData);
      await processNotifications(props.task.id, taskData.name, taskData.plannedTime);
      await processRecurrenceRule(props.task.id);
    };

    const saveNewTaskNotifications = async (savedTaskId, taskName, pendingNotifications) => {
      for (const notification of pendingNotifications) {
        try {
          const notificationDateTime = buildDateTimeFromInput(notification.date, notification.time);

          const notificationData = {
            task_id: savedTaskId,
            taskId: savedTaskId,
            time: notificationDateTime,
            type: TYPE.REMINDER,
            message: `Reminder for task: ${taskName}`,
          };

          logger.info('Saving notification for new task:', notificationData);

          const success = await window.electron.addNotification(notificationData);
          if (success) {
            logger.info('Successfully created notification for new task');
          } else {
            logger.error('Failed to create notification for new task');
          }
        } catch (error) {
          logger.error('Error saving notification for new task:', error);
        }
      }
    };

    const saveNewTaskRecurrence = async (savedTaskId) => {
      if (!pendingRecurrenceData.value) {
        return;
      }

      try {
        const recurrenceData = {
          ...pendingRecurrenceData.value,
          taskId: savedTaskId,
        };
        logger.info('Saving recurrence rule for new task:', recurrenceData);
        const success = await window.electron.addRecurrenceRule(recurrenceData);
        if (success) {
          logger.info('Successfully created recurrence rule for new task');
        } else {
          logger.error('Failed to create recurrence rule for new task');
        }
      } catch (error) {
        logger.error('Error saving recurrence rule for new task:', error);
      }
    };

    const handleSavedNewTask = async (savedTaskId, taskName, pendingNotifications) => {
      if (!savedTaskId) {
        return;
      }

      logger.info(`Task saved with ID: ${savedTaskId}, now saving notifications`);

      await saveNewTaskNotifications(savedTaskId, taskName, pendingNotifications);
      await saveNewTaskRecurrence(savedTaskId);
    };

    const saveTask = async () => {
      // Check for past dates and confirm with user
      if (!(await confirmDateIssues())) {
        return; // User canceled the save operation
      }

      const taskData = buildTaskData(formData, props.projectId, props.task);

      logger.info('Saving task with data:', taskData);

      // For existing tasks, we can save notifications immediately
      if (props.task) {
        await handleExistingTaskSave(taskData);
      } else {
        const pendingNotifications = [...notifications.value];
        const taskName = taskData.name;

        resetFormData(formData);
        clearNotifications();

        // Emit save event with a callback to process notifications
        emit('save', taskData, async (savedTaskId) => {
          await handleSavedNewTask(savedTaskId, taskName, pendingNotifications);
        });
      }
    };

    // Note: Planned time notification handling has been moved to the task service

    // Helper function to handle deletion of existing notifications
    const deleteRemovedNotifications = async () => {
      for (const notificationId of notificationsToDelete.value) {
        try {
          logger.info(`Deleting notification: ${notificationId}`);
          const success = await window.electron.deleteNotification(notificationId);
          if (success) {
            logger.info(`Successfully deleted notification: ${notificationId}`);
          } else {
            logger.error(`Failed to delete notification: ${notificationId}`);
          }
        } catch (error) {
          logger.error(`Error deleting notification ${notificationId}:`, error);
        }
      }
    };

    // Helper function to save/update additional reminder notifications
    const saveReminderNotifications = async (taskId, taskName) => {
      for (const notification of notifications.value) {
        try {
          const notificationDateTime = buildDateTimeFromInput(
            notification.date,
            notification.time
          );

          logger.info(`Notification date/time: ${notification.date} ${notification.time}`);
          logger.info(`Parsed notification datetime: ${notificationDateTime.toLocaleString()}`);

          // Create notification data
          const notificationData = {
            id: notification.isExisting ? notification.id : undefined,
            task_id: taskId,
            taskId: taskId,
            time: notificationDateTime,
            type: TYPE.REMINDER,
            message: `Reminder for task: ${taskName}`,
          };

          logger.info('Saving notification:', notificationData);

          let success = false;

          // If it's an existing notification, update it
          if (notification.isExisting) {
            logger.info(`Updating existing notification: ${notification.id}`);
            success = await window.electron.updateNotification(notificationData);
            if (success) {
              logger.info(`Successfully updated notification: ${notification.id}`);
            } else {
              logger.error(`Failed to update notification: ${notification.id}`);
            }
          } else {
            // Otherwise add a new one
            logger.info('Creating new notification');
            success = await window.electron.addNotification(notificationData);
            if (success) {
              logger.info('Successfully created new notification');
            } else {
              logger.error('Failed to create new notification');
            }
          }
        } catch (error) {
          logger.error('Error saving notification:', error);
        }
      }
    };

    // Helper function to process notifications for existing tasks
    const processNotifications = async (taskId, taskName, plannedTime) => {
      logger.info(`Processing notifications for task ID: ${taskId}`);
      logger.info(`Notifications to delete: ${notificationsToDelete.value.length}`);
      logger.info(`Notifications to save: ${notifications.value.length}`);
      logger.info(`Planned time: ${plannedTime}`);

      // Note: Planned time notifications are now handled automatically by the task service
      await deleteRemovedNotifications();
      await saveReminderNotifications(taskId, taskName);
    };

    const deleteExistingRecurrenceRule = async (ruleId) => {
      logger.info('Deleting existing recurrence rule');
      const success = await window.electron.deleteRecurrenceRule(ruleId);
      if (success) {
        logger.info('Successfully deleted recurrence rule');
      } else {
        logger.error('Failed to delete recurrence rule');
      }
    };

    const upsertRecurrenceRule = async (taskId, pendingRule, existingRule) => {
      const recurrenceData = {
        ...pendingRule,
        taskId: taskId,
      };

      if (existingRule) {
        logger.info('Updating existing recurrence rule');
        const success = await window.electron.updateRecurrenceRule(existingRule.id, recurrenceData);
        if (success) {
          logger.info('Successfully updated recurrence rule');
        } else {
          logger.error('Failed to update recurrence rule');
        }
        return;
      }

      logger.info('Creating new recurrence rule');
      const success = await window.electron.addRecurrenceRule(recurrenceData);
      if (success) {
        logger.info('Successfully created recurrence rule');
      } else {
        logger.error('Failed to create recurrence rule');
      }
    };

    // Helper function to process recurrence rule for existing tasks
    const processRecurrenceRule = async (taskId) => {
      try {
        const pendingRule = pendingRecurrenceData.value;
        const existingRule = existingRecurrenceRule.value;

        logger.info(`Processing recurrence rule for task ID: ${taskId}`);
        logger.info('Pending recurrence data:', pendingRule);
        logger.info('Existing recurrence rule:', existingRule);

        if (!pendingRule && !existingRule) {
          return;
        }

        if (!pendingRule && existingRule) {
          await deleteExistingRecurrenceRule(existingRule.id);
          return;
        }

        await upsertRecurrenceRule(taskId, pendingRule, existingRule);
      } catch (error) {
        logger.error('Error processing recurrence rule:', error);
      }
    };

    return {
      formData,
      notifications,
      existingRecurrenceRule,
      currentDate,
      currentTime,
      isPlannedTimeAfterDueDate,
      isPlannedTimeInPast,
      isDueDateInPast,
      addNewNotification,
      removeNotification,
      saveTask,
      handleRecurrenceChange,
    };
  },
};
</script>

<style>
/* Fix for date picker icon visibility */
.date-input::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
}
</style>
