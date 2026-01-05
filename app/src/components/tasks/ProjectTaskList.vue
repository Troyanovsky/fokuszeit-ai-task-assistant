<template>
  <div class="project-task-list">
    <!-- Task Filter -->
    <task-filter
      v-if="selectedProject"
      :filters="filters"
      class="mb-4"
      @update:filters="updateFilters"
    />

    <!-- Add Task Button -->
    <div
      v-if="selectedProject"
      class="p-3 rounded cursor-pointer bg-white border-gray-200 border hover:bg-gray-50 text-center text-blue-500 mb-4"
      @click="showAddTaskForm = true"
    >
      + Add Task
    </div>

    <!-- Task Form Modal -->
    <div
      v-if="showAddTaskForm || editingTask"
      class="fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
        <task-form
          v-if="showAddTaskForm"
          :project-id="selectedProject ? selectedProject.id : null"
          @save="addTask"
          @cancel="showAddTaskForm = false"
        />
        <task-form
          v-else-if="editingTask"
          :task="editingTask"
          :project-id="selectedProject ? selectedProject.id : null"
          @save="updateTask"
          @cancel="editingTask = null"
        />
      </div>
    </div>

    <!-- Tasks List -->
    <div v-if="displayedTasks.length > 0" class="space-y-3">
      <template v-for="task in displayedTasks" :key="task.id">
        <task-item
          v-if="!isTaskBeingEdited(task)"
          :task="task"
          :is-missed-planned-time="isMissedPlannedTime(task)"
          :notification-count="getNotificationCount(task.id)"
          @status-change="updateTaskStatus"
          @edit="editTask"
          @delete="deleteTask"
          @move="moveTask"
        />
      </template>
    </div>
    <div v-else-if="tasks.length > 0" class="text-gray-500 text-sm mt-2 text-center">
      No tasks match your filters.
    </div>
    <div v-else-if="selectedProject" class="text-gray-500 text-sm mt-2 text-center">
      No tasks in this project. Create your first task.
    </div>
    <div v-else class="text-gray-500 text-sm mt-2 text-center">
      Select a project to view and manage tasks.
    </div>

    <!-- View All Tasks Button -->
    <div
      v-if="!showingAllTasks && selectedProject"
      class="mt-4 text-center text-gray-600 text-sm cursor-pointer hover:text-gray-800 hover:underline"
      @click="loadAllTasks"
    >
      View All Tasks
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="mt-4 text-center">
      <span class="text-gray-500">Loading tasks...</span>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-4 text-center">
      <span class="text-red-500">{{ error }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import { Task } from '../../models/Task.js';
import TaskItem from './TaskItem.vue';
import TaskForm from './TaskForm.vue';
import logger from '../../services/logger';
import TaskFilter from './TaskFilter.vue';

export default {
  name: 'ProjectTaskList',
  components: {
    TaskItem,
    TaskForm,
    TaskFilter,
  },
  props: {
    selectedProject: {
      type: Object,
      default: null,
    },
  },
  setup(props) {
    const store = useStore();
    const showAddTaskForm = ref(false);
    const editingTask = ref(null);
    const showingAllTasks = ref(false);
    const missedPlannedTimeCheckInterval = ref(null);

    // Store references to wrapped listener functions for proper cleanup
    const wrappedTasksRefreshListener = ref(null);
    const wrappedNotificationsRefreshListener = ref(null);
    const wrappedNotificationsChangedListener = ref(null);
    const filters = ref({
      status: 'all',
      priority: 'all',
      search: '',
    });

    // Track notification counts for each task
    const taskNotificationCounts = ref({});

    // Get tasks for the selected project
    const tasks = computed(() => {
      if (!props.selectedProject) return [];
      return store.getters['tasks/tasksByProject'](props.selectedProject.id);
    });

    const isLoading = computed(() => store.getters['tasks/isLoading']);
    const error = computed(() => store.getters['tasks/error']);

    // Apply filters to tasks
    const filteredTasks = computed(() => {
      let result = [...tasks.value];

      // Filter by status
      if (filters.value.status !== 'all') {
        result = result.filter((task) => task.status === filters.value.status);
      }

      // Filter by priority
      if (filters.value.priority !== 'all') {
        result = result.filter((task) => task.priority === filters.value.priority);
      }

      // Filter by search term
      if (filters.value.search) {
        const searchTerm = filters.value.search.toLowerCase();
        result = result.filter(
          (task) =>
            task.name.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm))
        );
      }

      return result;
    });

    // Tasks to display with sorting
    const displayedTasks = computed(() => {
      let tasksToDisplay = [...filteredTasks.value];

      // Sort tasks: Planning/Doing first, then Done
      return tasksToDisplay.sort((a, b) => {
        // Group tasks: non-done (planning/doing) vs done
        const aIsDone = a.status === 'done';
        const bIsDone = b.status === 'done';

        // Non-done tasks come before done tasks
        if (!aIsDone && bIsDone) return -1;
        if (aIsDone && !bIsDone) return 1;

        // For non-done tasks (both planning/doing)
        if (!aIsDone && !bIsDone) {
          // Tasks with due date/planned time come first
          const aHasDate = a.dueDate || a.plannedTime;
          const bHasDate = b.dueDate || b.plannedTime;

          if (aHasDate && !bHasDate) return -1;
          if (!aHasDate && bHasDate) return 1;

          // Compare by due date (if available)
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }

          // Compare by planned time (if available)
          if (a.plannedTime && b.plannedTime && a.plannedTime !== b.plannedTime) {
            return new Date(a.plannedTime) - new Date(b.plannedTime);
          }

          // For tasks without dates, sort by priority DESC
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }

        // For done tasks
        if (aIsDone && bIsDone) {
          // Compare by due date (if available)
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }

          // Compare by planned time (if available)
          if (a.plannedTime && b.plannedTime && a.plannedTime !== b.plannedTime) {
            return new Date(a.plannedTime) - new Date(b.plannedTime);
          }

          // Finally, sort by priority DESC
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }

        return 0;
      });
    });

    // Function to check if planned time is in the past but task is not started or completed
    const isMissedPlannedTime = (task) => {
      if (!task.plannedTime || task.status === 'doing' || task.status === 'done') {
        return false;
      }

      const plannedDateTime = new Date(task.plannedTime);
      const now = new Date();

      return now > plannedDateTime;
    };

    // Function to check if a task is currently being edited
    const isTaskBeingEdited = (task) => {
      return editingTask.value && task && editingTask.value.id === task.id;
    };

    // Function to fetch notification counts for all tasks
    const fetchNotificationCounts = async () => {
      if (!tasks.value || tasks.value.length === 0) return;

      const counts = {};
      for (const task of tasks.value) {
        try {
          const notifications = await window.electron.getNotificationsByTask(task.id);
          // Exclude planned time notifications from the count shown in UI
          const regularNotifications = notifications.filter((n) => n.type !== 'PLANNED_TIME');
          counts[task.id] = regularNotifications ? regularNotifications.length : 0;
        } catch (error) {
          logger.error(`Error fetching notifications for task ${task.id}:`, error);
          counts[task.id] = 0;
        }
      }
      taskNotificationCounts.value = counts;
    };

    // Function to fetch tasks for the current project
    const fetchTasks = async () => {
      if (props.selectedProject) {
        await store.dispatch('tasks/fetchTasksByProject', { projectId: props.selectedProject.id });

        // Batch fetch recurrence rules for all tasks
        const taskIds = tasks.value.map((task) => task.id);
        if (taskIds.length > 0) {
          await store.dispatch('recurrence/fetchRecurrenceRulesForTasks', taskIds);
        }

        // Fetch notification counts for all tasks
        await fetchNotificationCounts();
      }
    };

    // Function to load all tasks including those completed a long time ago
    const loadAllTasks = async () => {
      showingAllTasks.value = true;

      if (props.selectedProject) {
        await store.dispatch('tasks/fetchAllTasksByProject', props.selectedProject.id);
        // Fetch notification counts for all tasks
        await fetchNotificationCounts();
      }
    };

    const startMissedPlannedTimeCheck = () => {
      missedPlannedTimeCheckInterval.value = setInterval(() => {
        if (!displayedTasks.value) return;

        for (const task of displayedTasks.value) {
          if (isMissedPlannedTime(task)) {
            logger.info(`Missed planned time detected for task ${task.id}. Refreshing tasks.`);
            fetchTasks();
            break; // Refresh only once per interval
          }
        }
      }, 300000); // 5 minutes
    };

    const stopMissedPlannedTimeCheck = () => {
      clearInterval(missedPlannedTimeCheckInterval.value);
      missedPlannedTimeCheckInterval.value = null;
    };

    onMounted(() => {
      // Load preferences
      store.dispatch('preferences/loadPreferences');

      // Start checking for missed planned times
      startMissedPlannedTimeCheck();

      // Listen for task refresh events from main process
      try {
        if (window.electron && window.electron.receive) {
          // Set up tasks refresh listener
          wrappedTasksRefreshListener.value = window.electron.receive('tasks:refresh', async () => {
            logger.info('Received tasks:refresh event');
            await fetchTasks();
          });

          // Set up notifications refresh listener
          wrappedNotificationsRefreshListener.value = window.electron.receive(
            'notifications:refresh',
            async () => {
              logger.info('Received notifications:refresh event');
              await fetchTasks();
            }
          );

          // Set up notifications changed listener
          wrappedNotificationsChangedListener.value = window.electron.receive(
            'notifications:changed',
            async (taskId) => {
              logger.info(`Received notifications:changed event for task ${taskId}`);
              // Refresh notification counts for all tasks to keep UI in sync
              await fetchNotificationCounts();
            }
          );
        } else {
          logger.warn('Electron API not available - task refresh events will not work');
        }
      } catch (error) {
        logger.logError(error, 'Error setting up task refresh listeners');
      }
    });

    onBeforeUnmount(() => {
      // Stop checking for missed planned times
      stopMissedPlannedTimeCheck();

      // Remove event listeners when component is unmounted
      try {
        if (window.electron && window.electron.removeListener) {
          // Remove specific listeners using their wrapped function references
          if (wrappedTasksRefreshListener.value) {
            window.electron.removeListener('tasks:refresh', wrappedTasksRefreshListener.value);
            wrappedTasksRefreshListener.value = null;
          }
          if (wrappedNotificationsRefreshListener.value) {
            window.electron.removeListener(
              'notifications:refresh',
              wrappedNotificationsRefreshListener.value
            );
            wrappedNotificationsRefreshListener.value = null;
          }
          if (wrappedNotificationsChangedListener.value) {
            window.electron.removeListener(
              'notifications:changed',
              wrappedNotificationsChangedListener.value
            );
            wrappedNotificationsChangedListener.value = null;
          }
        }
      } catch (error) {
        logger.logError(error, 'Error removing task refresh listeners');
      }
    });

    // Fetch tasks when selected project changes
    watch(
      () => props.selectedProject,
      async (newProject) => {
        showingAllTasks.value = false;
        if (newProject) {
          await store.dispatch('tasks/fetchTasksByProject', { projectId: newProject.id });
          // Fetch notification counts for all tasks
          await fetchNotificationCounts();
        }
      },
      { immediate: true }
    );

    const addTask = async (taskData, callback) => {
      try {
        // Dispatch the action to add the task
        const result = await store.dispatch('tasks/addTask', taskData);

        // If we have a callback and the task was successfully added
        if (callback && result && result.id) {
          // Call the callback with the new task ID
          callback(result.id);
        }

        // Hide the form
        showAddTaskForm.value = false;
      } catch (error) {
        logger.error('Error adding task:', error);
      }
    };

    const updateTask = async (taskData) => {
      logger.info('updateTask called with data:', taskData);
      // Create a Task instance from the plain object
      const taskInstance = new Task(taskData);
      logger.info('Task instance:', taskInstance);
      await store.dispatch('tasks/updateTask', taskInstance);
      editingTask.value = null;
    };

    const updateTaskStatus = async (taskId, newStatus) => {
      await store.dispatch('tasks/updateTaskStatus', {
        taskId,
        status: newStatus,
        projectId: props.selectedProject ? props.selectedProject.id : null,
      });
    };

    const editTask = (task) => {
      editingTask.value = task;
    };

    const deleteTask = async (taskId) => {
      if (confirm('Are you sure you want to delete this task?')) {
        await store.dispatch('tasks/deleteTask', {
          taskId,
          projectId: props.selectedProject ? props.selectedProject.id : null,
        });
      }
    };

    const moveTask = async (task) => {
      try {
        // Store the original projectId to reference where the task is moving FROM
        const originalProjectId = props.selectedProject ? props.selectedProject.id : null;

        // The task object already has the new projectId set by the TaskItem component
        await store.dispatch('tasks/updateTask', task);

        // Refresh tasks for the current project to remove the moved task from view
        if (originalProjectId) {
          await store.dispatch('tasks/fetchTasksByProject', { projectId: originalProjectId });
        }

        logger.info(
          `Task ${task.id} moved from project ${originalProjectId} to project ${task.projectId}`
        );
      } catch (error) {
        logger.error('Error moving task:', error);
      }
    };

    const updateFilters = (newFilters) => {
      filters.value = { ...newFilters };
      store.dispatch('tasks/filterTasks', newFilters);
    };

    // Helper function to get notification count for a specific task
    const getNotificationCount = (taskId) => {
      return taskNotificationCounts.value[taskId] || 0;
    };

    return {
      tasks,
      filteredTasks,
      displayedTasks,
      isLoading,
      error,
      showAddTaskForm,
      editingTask,
      showingAllTasks,
      filters,
      isTaskBeingEdited,
      addTask,
      updateTask,
      updateTaskStatus,
      editTask,
      deleteTask,
      moveTask,
      updateFilters,
      loadAllTasks,
      isMissedPlannedTime,
      getNotificationCount,
    };
  },
};
</script>
