<!-- Recurrence configuration form for task scheduling. -->
<template>
  <div class="recurrence-form">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-sm font-medium text-gray-700">Recurrence Settings</h4>
      <button
        type="button"
        class="text-sm text-blue-600 hover:text-blue-800"
        @click="toggleRecurrence"
      >
        {{ hasRecurrence ? 'Remove Recurrence' : 'Add Recurrence' }}
      </button>
    </div>

    <div v-if="hasRecurrence" class="space-y-3 p-3 bg-gray-50 rounded-md">
      <!-- Frequency Selection -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="frequency" class="block text-sm font-medium text-gray-700 mb-1">
            Frequency
          </label>
          <select
            id="frequency"
            v-model="formData.frequency"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div>
          <label for="interval" class="block text-sm font-medium text-gray-700 mb-1"> Every </label>
          <div class="flex items-center space-x-2">
            <input
              id="interval"
              v-model.number="formData.interval"
              type="number"
              min="1"
              max="365"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <span class="text-sm text-gray-500">{{ intervalLabel }}</span>
          </div>
        </div>
      </div>

      <!-- End Condition -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">End Condition</label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input v-model="endCondition" type="radio" value="never" class="mr-2" />
            <span class="text-sm">Never ends</span>
          </label>

          <label class="flex items-center">
            <input v-model="endCondition" type="radio" value="date" class="mr-2" />
            <span class="text-sm mr-2">End by date:</span>
            <input
              v-model="formData.endDate"
              type="date"
              :disabled="endCondition !== 'date'"
              :min="currentDate"
              class="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
          </label>

          <label class="flex items-center">
            <input v-model="endCondition" type="radio" value="count" class="mr-2" />
            <span class="text-sm mr-2">End after:</span>
            <input
              v-model.number="formData.count"
              type="number"
              min="1"
              max="100"
              :disabled="endCondition !== 'count'"
              class="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <span class="text-sm ml-1">occurrences</span>
          </label>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="previewText" class="text-xs text-gray-600 bg-blue-50 p-2 rounded">
        <strong>Preview:</strong> {{ previewText }}
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, computed, watch, onMounted, ref } from 'vue';
import { FREQUENCY } from '../../../shared/models/RecurrenceRule.js';
import { getTodayDateOnlyLocal } from '../../../shared/utils/dateTime.js';

export default {
  name: 'RecurrenceForm',
  props: {
    taskId: {
      type: String,
      default: null,
    },
    initialRule: {
      type: Object,
      default: null,
    },
  },
  emits: ['recurrence-change'],
  setup(props, { emit }) {
    const hasRecurrence = ref(false);
    const endCondition = ref('never');

    const formData = reactive({
      frequency: FREQUENCY.DAILY,
      interval: 1,
      endDate: '',
      count: 1,
    });

    // Current date for min date validation
    const currentDate = computed(() => {
      return getTodayDateOnlyLocal();
    });

    // Interval label based on frequency
    const intervalLabel = computed(() => {
      const labels = {
        [FREQUENCY.DAILY]: formData.interval === 1 ? 'day' : 'days',
        [FREQUENCY.WEEKLY]: formData.interval === 1 ? 'week' : 'weeks',
        [FREQUENCY.MONTHLY]: formData.interval === 1 ? 'month' : 'months',
        [FREQUENCY.YEARLY]: formData.interval === 1 ? 'year' : 'years',
      };
      return labels[formData.frequency] || '';
    });

    const parseDateOnly = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) {
        return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
      }
      if (typeof dateValue === 'string') {
        const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          return new Date(year, month - 1, day);
        }
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    };

    const formatDateOnly = (dateValue) => {
      const parsed = parseDateOnly(dateValue);
      if (!parsed) return '';
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Preview text
    const previewText = computed(() => {
      if (!hasRecurrence.value) return '';

      let text = `Repeats every ${formData.interval} ${intervalLabel.value}`;

      if (endCondition.value === 'date' && formData.endDate) {
        const endDate = parseDateOnly(formData.endDate);
        text += endDate ? ` until ${endDate.toLocaleDateString()}` : '';
      } else if (endCondition.value === 'count' && formData.count > 0) {
        text += ` for ${formData.count} occurrences`;
      }

      return text;
    });

    // Toggle recurrence on/off
    const toggleRecurrence = () => {
      hasRecurrence.value = !hasRecurrence.value;
      emitRecurrenceChange();
    };

    // Emit recurrence change event
    const emitRecurrenceChange = () => {
      if (!hasRecurrence.value) {
        emit('recurrence-change', null);
        return;
      }

      const ruleData = {
        taskId: props.taskId,
        frequency: formData.frequency,
        interval: formData.interval,
        endDate: endCondition.value === 'date' && formData.endDate ? formData.endDate : null,
        count: endCondition.value === 'count' && formData.count > 0 ? formData.count : null,
      };

      emit('recurrence-change', ruleData);
    };

    // Watch for form changes
    watch(
      [formData, endCondition],
      () => {
        if (hasRecurrence.value) {
          emitRecurrenceChange();
        }
      },
      { deep: true }
    );

    // Initialize with existing rule if provided
    onMounted(() => {
      if (props.initialRule) {
        hasRecurrence.value = true;
        formData.frequency = props.initialRule.frequency;
        formData.interval = props.initialRule.interval;

        if (props.initialRule.endDate) {
          endCondition.value = 'date';
          formData.endDate = formatDateOnly(props.initialRule.endDate);
        } else if (props.initialRule.count) {
          endCondition.value = 'count';
          formData.count = props.initialRule.count;
        } else {
          endCondition.value = 'never';
        }
      }
    });

    return {
      hasRecurrence,
      endCondition,
      formData,
      currentDate,
      intervalLabel,
      previewText,
      toggleRecurrence,
    };
  },
};
</script>
