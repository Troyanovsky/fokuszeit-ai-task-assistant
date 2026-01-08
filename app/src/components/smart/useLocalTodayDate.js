/**
 * Local "today" date composable for smart projects.
 *
 * Responsibility:
 * - Provide a reactive `YYYY-MM-DD` string for the current local calendar day.
 * - Update automatically after the next local midnight, so "Today/Overdue" filters refresh even if
 *   no task data changes occur.
 */

import { ref } from 'vue';
import { getTodayDateOnlyLocal } from '../../../shared/utils/dateTime.js';

/**
 * Create a reactive local calendar date string that refreshes shortly after local midnight.
 * @returns {{ todayDateStr: import('vue').Ref<string>, start: () => void, stop: () => void }}
 */
export function useLocalTodayDate() {
  const todayDateStr = ref(getTodayDateOnlyLocal());
  const refreshTimeout = ref(null);

  const stop = () => {
    if (refreshTimeout.value) {
      clearTimeout(refreshTimeout.value);
      refreshTimeout.value = null;
    }
  };

  const scheduleNextRefresh = () => {
    stop();

    const now = new Date();
    const nextMidnightLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    // Buffer to avoid edge cases around timer jitter at exactly midnight.
    const bufferMs = 1000;
    const delayMs = Math.max(0, nextMidnightLocal.getTime() - now.getTime() + bufferMs);

    refreshTimeout.value = setTimeout(() => {
      todayDateStr.value = getTodayDateOnlyLocal();
      scheduleNextRefresh();
    }, delayMs);
  };

  const start = () => {
    todayDateStr.value = getTodayDateOnlyLocal();
    scheduleNextRefresh();
  };

  return { todayDateStr, start, stop };
}

