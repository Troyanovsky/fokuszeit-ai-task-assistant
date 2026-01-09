/**
 * Task Sorting Composable
 *
 * Responsibility:
 * - Provide comparison functions for sorting tasks in consistent ways across the app.
 * - Encapsulates complex multi-level sorting logic (status, dates, priority) to reduce
 *   component complexity and eliminate code duplication.
 *
 * Usage:
 *   const { compareTasks, compareOverdueTasks } = useTaskSorting();
 *   tasks.sort(compareTasks);
 */

// Priority ordering constant (higher value = higher priority)
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

/**
 * Compare two tasks by dates and priority.
 * Used as fallback when both tasks are in the same status group.
 *
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareByDatesAndPriority(a, b) {
  // Compare by due date (if available)
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }

  // Compare by planned time (if available)
  if (a.plannedTime && b.plannedTime && a.plannedTime !== b.plannedTime) {
    return a.plannedTime.getTime() - b.plannedTime.getTime();
  }

  // Finally, sort by priority DESC (high > medium > low)
  return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
}

/**
 * Compare two non-done (planning/doing) tasks.
 * Tasks with dates come before tasks without dates.
 *
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareActiveTasks(a, b) {
  const aHasDate = a.dueDate || a.plannedTime;
  const bHasDate = b.dueDate || b.plannedTime;

  // Tasks with dates come first
  if (aHasDate && !bHasDate) return -1;
  if (!aHasDate && bHasDate) return 1;

  return compareByDatesAndPriority(a, b);
}

/**
 * Compare two done tasks.
 * Done tasks are sorted by dates and priority only.
 *
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareDoneTasks(a, b) {
  return compareByDatesAndPriority(a, b);
}

/**
 * Compare two tasks for general display (Today smart project, project task lists).
 * Non-done tasks come before done tasks. Within each group, tasks are sorted by
 * dates and priority.
 *
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareTasks(a, b) {
  const aIsDone = a.status === 'done';
  const bIsDone = b.status === 'done';

  // Non-done tasks come before done tasks
  if (!aIsDone && bIsDone) return -1;
  if (aIsDone && !bIsDone) return 1;

  // For non-done tasks
  if (!aIsDone && !bIsDone) {
    return compareActiveTasks(a, b);
  }

  // For done tasks
  if (aIsDone && bIsDone) {
    return compareDoneTasks(a, b);
  }

  return 0;
}

/**
 * Compare two overdue tasks.
 * Overdue tasks are sorted by due date (oldest first), then by priority.
 *
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareOverdueTasks(a, b) {
  // Compare by due date first (oldest overdue tasks first)
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }

  // If same due date or no due date, sort by priority DESC
  return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
}

/**
 * Task sorting composable.
 * Provides comparison functions for consistent task sorting across components.
 *
 * @returns {{ compareTasks: Function, compareOverdueTasks: Function }}
 */
export function useTaskSorting() {
  return {
    compareTasks,
    compareOverdueTasks,
  };
}
