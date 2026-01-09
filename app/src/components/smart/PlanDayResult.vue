<template>
  <div class="plan-day-result">
    <!-- Result Message -->
    <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <p class="text-blue-700">{{ result.message }}</p>
    </div>

    <!-- Scheduled Tasks Section -->
    <div v-if="result.scheduled.length > 0" class="mb-4">
      <h3 class="text-md font-medium mb-2">Scheduled Tasks</h3>
      <div class="space-y-2">
        <div
          v-for="task in result.scheduled"
          :key="task.id"
          class="p-3 bg-green-50 border border-green-200 rounded-md"
        >
          <div class="flex justify-between items-center">
            <div>
              <h4 class="font-medium">{{ task.name }}</h4>
              <p class="text-sm text-gray-600">
                {{ formatTime(task.plannedTime) }} -
                {{ formatEndTime(task.plannedTime, task.duration) }}
                <span class="ml-2 px-1 py-0.5 bg-gray-200 rounded text-xs">
                  {{ formatDuration(task.duration) }}
                </span>
              </p>
            </div>
            <div>
              <span
                class="px-2 py-1 rounded text-xs font-medium"
                :class="priorityClass(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unscheduled Tasks Section -->
    <div v-if="result.unscheduled.length > 0" class="mb-4">
      <h3 class="text-md font-medium mb-2">Unscheduled Tasks</h3>
      <div class="space-y-2">
        <div
          v-for="task in result.unscheduled"
          :key="task.id"
          class="p-3 bg-red-50 border border-red-200 rounded-md"
        >
          <div class="flex justify-between items-center">
            <div>
              <h4 class="font-medium">{{ task.name }}</h4>
              <p class="text-sm text-gray-600">
                <span class="px-1 py-0.5 bg-gray-200 rounded text-xs">
                  {{ formatDuration(task.duration) }}
                </span>
              </p>
            </div>
            <div>
              <span
                class="px-2 py-1 rounded text-xs font-medium"
                :class="priorityClass(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline View (optional enhancement) -->
    <div v-if="result.scheduled.length > 0" class="mt-6">
      <h3 class="text-md font-medium mb-2">Today's Schedule</h3>
      <div class="relative h-12 bg-gray-100 rounded-md">
        <!-- Working hours background -->
        <div class="absolute h-full bg-blue-50" :style="workingHoursStyle"></div>

        <!-- Current time indicator -->
        <div class="absolute h-full w-0.5 bg-red-500" :style="currentTimeStyle"></div>

        <!-- Task blocks -->
        <div
          v-for="task in result.scheduled"
          :key="task.id"
          class="absolute h-8 top-2 rounded-sm text-xs text-white overflow-hidden whitespace-nowrap px-1 flex items-center"
          :style="taskBlockStyle(task)"
          :class="taskBlockClass(task)"
        >
          {{ task.name }}
        </div>
      </div>
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>{{ formatHour(workingHoursStart) }}</span>
        <span>{{ formatHour(workingHoursEnd) }}</span>
      </div>
    </div>

    <!-- Close Button -->
    <div class="mt-4 flex justify-end">
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        @click="$emit('close')"
      >
        Close
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useTaskFormatting } from '../tasks/composables/useTaskFormatting.js';

export default {
  name: 'PlanDayResult',
  props: {
    result: {
      type: Object,
      default: () => ({
        scheduled: [],
        unscheduled: [],
        message: '',
      }),
    },
    workingHours: {
      type: Object,
      default: () => ({
        startTime: '10:00',
        endTime: '19:00',
      }),
    },
  },
  emits: ['close'],
  setup(props) {
    // Use formatting composable
    const { formatTime, formatHour, formatEndTime, formatTaskDuration } = useTaskFormatting();

    // Parse working hours
    const workingHoursStart = computed(() => {
      const [hours, minutes] = props.workingHours.startTime.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    });

    const workingHoursEnd = computed(() => {
      const [hours, minutes] = props.workingHours.endTime.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    });

    // Calculate total working day duration in minutes
    const workingDayDuration = computed(() => {
      return (workingHoursEnd.value - workingHoursStart.value) / (60 * 1000);
    });

    // Style for working hours background
    const workingHoursStyle = computed(() => {
      return {
        left: '0%',
        width: '100%',
      };
    });

    // Style for current time indicator
    const currentTimeStyle = computed(() => {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      const minutesSinceMidnight = (now - dayStart) / (60 * 1000);
      const startMinutes = (workingHoursStart.value - dayStart) / (60 * 1000);
      const endMinutes = (workingHoursEnd.value - dayStart) / (60 * 1000);

      // If current time is outside working hours, don't show the indicator
      if (minutesSinceMidnight < startMinutes || minutesSinceMidnight > endMinutes) {
        return { display: 'none' };
      }

      const percentage =
        ((minutesSinceMidnight - startMinutes) / (endMinutes - startMinutes)) * 100;
      return {
        left: `${percentage}%`,
      };
    });

    // Style for task blocks
    const taskBlockStyle = (task) => {
      const taskStart = new Date(task.plannedTime);
      const dayStart = new Date(taskStart);
      dayStart.setHours(0, 0, 0, 0);

      // Calculate position and width
      const startMinutes = (taskStart - dayStart) / (60 * 1000);
      const startWorkingMinutes = (workingHoursStart.value - dayStart) / (60 * 1000);
      const duration = task.duration !== null ? task.duration : 30;

      const startPercentage =
        ((startMinutes - startWorkingMinutes) / workingDayDuration.value) * 100;
      const widthPercentage = (duration / workingDayDuration.value) * 100;

      return {
        left: `${startPercentage}%`,
        width: `${widthPercentage}%`,
      };
    };

    // Class for task blocks based on priority
    const taskBlockClass = (task) => {
      switch (task.priority) {
        case 'high':
          return 'bg-red-600';
        case 'medium':
          return 'bg-yellow-600';
        case 'low':
          return 'bg-green-600';
        default:
          return 'bg-blue-600';
      }
    };

    // Class for priority badges
    const priorityClass = (priority) => {
      switch (priority) {
        case 'high':
          return 'bg-red-100 text-red-800';
        case 'medium':
          return 'bg-yellow-100 text-yellow-800';
        case 'low':
          return 'bg-green-100 text-green-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    return {
      workingHoursStart,
      workingHoursEnd,
      workingHoursStyle,
      currentTimeStyle,
      taskBlockStyle,
      taskBlockClass,
      priorityClass,
      formatTime,
      formatHour,
      formatEndTime,
      formatDuration: formatTaskDuration,
    };
  },
};
</script>
