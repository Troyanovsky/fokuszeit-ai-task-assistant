<template>
  <div class="task-item p-3 rounded border-gray-200 border bg-white hover:bg-gray-50">
    <div class="flex items-start gap-3">
      <!-- Status Checkbox -->
      <div class="mt-0.5">
        <div
          class="w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer"
          :class="statusClasses"
          @click="toggleStatus"
        >
          <svg
            v-if="task.status === 'done'"
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="white"
            stroke-width="3"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div
            v-else-if="task.status === 'doing'"
            class="w-2.5 h-2.5 rounded-full bg-yellow-500"
          ></div>
          <div v-else-if="task.status === 'planning'" class="w-2.5 h-2.5 rounded-full"></div>
        </div>
      </div>

      <!-- Task Content -->
      <div class="flex-1 min-w-0">
        <!-- Added min-w-0 to allow truncation -->
        <div class="flex justify-between">
          <h4
            class="font-medium truncate max-w-[calc(100%-30px)]"
            :class="{ 'line-through text-gray-500': task.status === 'done' }"
          >
            {{ task.name }}
          </h4>
          <div class="relative flex-shrink-0">
            <button
              class="text-gray-500 hover:text-gray-700 p-1"
              title="Task options"
              @click.stop="showDropdown = !showDropdown"
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
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div
              v-if="showDropdown"
              class="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200"
              @click.stop
            >
              <div class="py-1">
                <a
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                  @click.stop="
                    $emit('edit', task);
                    showDropdown = false;
                  "
                >
                  Edit Task
                </a>
                <div v-if="availableProjects.length > 0" class="relative">
                  <a
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                    @click.stop="showMoveOptions = !showMoveOptions"
                  >
                    Move Task
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>

                  <!-- Project List Submenu -->
                  <div
                    v-if="showMoveOptions"
                    class="absolute right-full top-0 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200"
                  >
                    <div v-if="isLoadingProjects" class="px-4 py-2 text-sm text-gray-500">
                      Loading projects...
                    </div>
                    <div v-else-if="projects.length === 0" class="px-4 py-2 text-sm text-gray-500">
                      No other projects available
                    </div>
                    <div v-else class="py-1 max-h-48 overflow-y-auto">
                      <a
                        v-for="project in availableProjects"
                        :key="project.id"
                        class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer truncate"
                        @click.stop="
                          moveTaskToProject(project);
                          showDropdown = false;
                          showMoveOptions = false;
                        "
                      >
                        {{ project.name }}
                      </a>
                    </div>
                  </div>
                </div>
                <a
                  class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 cursor-pointer"
                  @click.stop="
                    $emit('delete', task.id);
                    showDropdown = false;
                  "
                >
                  Delete Task
                </a>
              </div>
            </div>
          </div>
        </div>

        <p v-if="task.description" class="text-sm text-gray-600 mt-1 line-clamp-2">
          <!-- Added line-clamp-2 -->
          {{ task.description }}
        </p>

        <div class="flex flex-wrap gap-2 mt-2">
          <!-- Due Date -->
          <span
            v-if="task.dueDate"
            class="inline-flex items-center text-xs px-2 py-0.5 rounded"
            :class="isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {{ formatDate(task.dueDate) }}
            <span v-if="isOverdue" class="ml-1 font-medium">Overdue!</span>
          </span>

          <!-- Planned Time -->
          <span
            v-if="task.plannedTime"
            class="inline-flex items-center text-xs px-2 py-0.5 rounded"
            :class="{
              'bg-orange-50 text-orange-700': isPlannedTimeAfterDueDate,
              'bg-red-100 text-red-700': isMissedPlannedTime,
              'bg-indigo-50 text-indigo-700': !isPlannedTimeAfterDueDate && !isMissedPlannedTime,
            }"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ formatDateTime(task.plannedTime) }}
            <span v-if="isPlannedTimeAfterDueDate" class="ml-1 font-medium">!</span>
            <span v-if="isMissedPlannedTime" class="ml-1 font-medium">Missed!</span>
          </span>

          <!-- Priority -->
          <span
            class="inline-flex items-center text-xs px-2 py-0.5 rounded"
            :class="priorityClasses"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {{ capitalizeFirst(task.priority) }}
          </span>

          <!-- Duration -->
          <span
            v-if="task.duration"
            class="inline-flex items-center text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ formatDuration(task.duration) }}
          </span>

          <!-- Notifications -->
          <span
            v-if="notificationCount > 0"
            class="inline-flex items-center text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {{ notificationCount }}
          </span>

          <!-- Recurrence Indicator -->
          <RecurrenceIndicator :task-id="task.id" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useStore } from 'vuex';
import { Task } from '../../../shared/models/Task.js';
import RecurrenceIndicator from '../recurrence/RecurrenceIndicator.vue';
import { useTaskValidation } from './composables/useTaskValidation.js';
import { useTaskFormatting } from './composables/useTaskFormatting.js';

export default {
  name: 'TaskItem',
  components: {
    RecurrenceIndicator,
  },
  props: {
    task: {
      type: Object,
      required: true,
    },
    isMissedPlannedTime: {
      type: Boolean,
      default: false,
    },
    notificationCount: {
      type: Number,
      default: 0,
    },
  },
  emits: ['status-change', 'edit', 'delete', 'move'],
  setup(props, { emit }) {
    const store = useStore();
    const showDropdown = ref(false);
    const showMoveOptions = ref(false);

    // Use business logic composables
    const { isTaskOverdue } = useTaskValidation();
    const { formatTaskDate, formatTaskDateTime, formatTaskDuration, capitalizeFirst } = useTaskFormatting();

    // Get projects from store
    const projects = computed(() => store.getters['projects/allProjects']);
    const isLoadingProjects = computed(() => store.getters['projects/isLoading']);

    // Filter out the current project
    const availableProjects = computed(() => {
      return projects.value.filter((project) => project.id !== props.task.projectId);
    });

    // Check if planned time is after due date (computed for template)
    const isPlannedTimeAfterDueDate = computed(() => {
      if (!props.task.dueDate || !props.task.plannedTime) {
        return false;
      }
      // Check if planned time exceeds due date
      const plannedDate = props.task.plannedTime instanceof Date ? props.task.plannedTime : new Date(props.task.plannedTime);
      const dueEndDate = new Date(props.task.dueDate + 'T23:59:59');
      return plannedDate > dueEndDate;
    });

    // Check if task is overdue using composable
    const isOverdue = computed(() => isTaskOverdue(props.task));

    // Close dropdowns when clicking outside
    const closeDropdowns = (event) => {
      if (!event.target.closest('.task-item')) {
        showDropdown.value = false;
        showMoveOptions.value = false;
      }
    };

    // Function to move task to another project
    const moveTaskToProject = async (project) => {
      // Create a new task object with updated projectId
      const updatedTask = { ...props.task, projectId: project.id };

      // Emit the move event with the updated task object
      emit('move', updatedTask);
    };

    // Fetch projects when dropdown is opened
    watch(showDropdown, async (isOpen) => {
      if (isOpen) {
        await store.dispatch('projects/fetchProjects');
      }
    });

    onMounted(async () => {
      // Add click event listener to close dropdowns
      document.addEventListener('click', closeDropdowns);
    });

    onBeforeUnmount(() => {
      // Remove click event listener
      document.removeEventListener('click', closeDropdowns);
    });

    const statusClasses = computed(() => {
      switch (props.task.status) {
        case 'planning':
          return 'border-blue-500 text-blue-500';
        case 'doing':
          return 'border-yellow-500 text-yellow-500';
        case 'done':
          return 'border-green-500 bg-green-500';
        default:
          return 'border-gray-500 text-gray-500';
      }
    });

    const priorityClasses = computed(() => {
      switch (props.task.priority) {
        case 'high':
          return 'bg-red-50 text-red-700';
        case 'medium':
          return 'bg-yellow-50 text-yellow-700';
        case 'low':
          return 'bg-green-50 text-green-700';
        default:
          return 'bg-gray-100 text-gray-700';
      }
    });

    const toggleStatus = () => {
      // Create a temporary Task instance to use the cycleStatus method
      const taskInstance = new Task(props.task);
      const newStatus = taskInstance.cycleStatus();
      emit('status-change', props.task.id, newStatus);
    };

    return {
      statusClasses,
      priorityClasses,
      showDropdown,
      showMoveOptions,
      projects,
      availableProjects,
      isLoadingProjects,
      isPlannedTimeAfterDueDate,
      isOverdue,
      toggleStatus,
      moveTaskToProject,
      formatDate: formatTaskDate,
      formatDateTime: formatTaskDateTime,
      formatDuration: formatTaskDuration,
      capitalizeFirst,
    };
  },
};
</script>
