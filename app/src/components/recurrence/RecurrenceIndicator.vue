<!-- Recurrence indicator badge for tasks. -->
<template>
  <span
    v-if="recurrenceRule"
    class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700"
    :title="recurrenceTooltip"
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
    {{ recurrenceText }}
  </span>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { FREQUENCY } from '../../models/RecurrenceRule.js';
import logger from '../../services/logger.js';

export default {
  name: 'RecurrenceIndicator',
  props: {
    taskId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const store = useStore();

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

    // Get recurrence rule from store (reactive)
    const recurrenceRule = computed(() => {
      return store.getters['recurrence/getRecurrenceRuleByTaskId'](props.taskId);
    });

    // Computed text for recurrence display
    const recurrenceText = computed(() => {
      if (!recurrenceRule.value) return '';

      const rule = recurrenceRule.value;
      const frequencyLabels = {
        [FREQUENCY.DAILY]: rule.interval === 1 ? 'Daily' : `Every ${rule.interval} days`,
        [FREQUENCY.WEEKLY]: rule.interval === 1 ? 'Weekly' : `Every ${rule.interval} weeks`,
        [FREQUENCY.MONTHLY]: rule.interval === 1 ? 'Monthly' : `Every ${rule.interval} months`,
        [FREQUENCY.YEARLY]: rule.interval === 1 ? 'Yearly' : `Every ${rule.interval} years`,
      };

      return frequencyLabels[rule.frequency] || 'Recurring';
    });

    // Computed tooltip with full recurrence details
    const recurrenceTooltip = computed(() => {
      if (!recurrenceRule.value) return '';

      const rule = recurrenceRule.value;
      let tooltip = `Repeats ${recurrenceText.value.toLowerCase()}`;

      if (rule.endDate) {
        const endDate = parseDateOnly(rule.endDate);
        tooltip += endDate ? ` until ${endDate.toLocaleDateString()}` : '';
      } else if (rule.count) {
        tooltip += ` for ${rule.count} occurrences total`;
      }

      return tooltip;
    });

    onMounted(async () => {
      // Fetch recurrence rule for this task if not already in store
      try {
        await store.dispatch('recurrence/fetchRecurrenceRuleByTaskId', props.taskId);
      } catch (error) {
        logger.error('Error fetching recurrence rule:', error);
      }
    });

    return {
      recurrenceRule,
      recurrenceText,
      recurrenceTooltip,
    };
  },
};
</script>
