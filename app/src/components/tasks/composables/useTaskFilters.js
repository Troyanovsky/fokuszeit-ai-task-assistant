/**
 * Task Filters Composable
 *
 * Responsibility:
 * - Provide task filtering functions for task lists
 * - Encapsulates business rules for filtering by status, priority, and search terms
 * - Used in ProjectTaskList and other task list components
 *
 * Usage:
 *   const { filterTasksByStatus, filterTasksByPriority, applyTaskFilters } = useTaskFilters();
 */

/**
 * Filter tasks by status
 * @param {Array} tasks - Array of task objects
 * @param {string} status - Status to filter by ('all' for no filter)
 * @returns {Array} Filtered tasks
 */
export function filterTasksByStatus(tasks, status) {
  if (status === 'all') {
    return tasks;
  }
  return tasks.filter((task) => task.status === status);
}

/**
 * Filter tasks by priority
 * @param {Array} tasks - Array of task objects
 * @param {string} priority - Priority to filter by ('all' for no filter)
 * @returns {Array} Filtered tasks
 */
export function filterTasksByPriority(tasks, priority) {
  if (priority === 'all') {
    return tasks;
  }
  return tasks.filter((task) => task.priority === priority);
}

/**
 * Filter tasks by search term (searches name and description)
 * @param {Array} tasks - Array of task objects
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered tasks
 */
export function filterTasksBySearchTerm(tasks, searchTerm) {
  if (!searchTerm) {
    return tasks;
  }
  const term = searchTerm.toLowerCase();
  return tasks.filter(
    (task) =>
      task.name.toLowerCase().includes(term) ||
      (task.description && task.description.toLowerCase().includes(term))
  );
}

/**
 * Apply all filters to tasks
 * @param {Array} tasks - Array of task objects
 * @param {Object} filters - Filters object with status, priority, and search properties
 * @returns {Array} Filtered tasks
 */
export function applyTaskFilters(tasks, filters) {
  let result = [...tasks];

  // Filter by status
  result = filterTasksByStatus(result, filters.status);

  // Filter by priority
  result = filterTasksByPriority(result, filters.priority);

  // Filter by search term
  result = filterTasksBySearchTerm(result, filters.search);

  return result;
}

/**
 * Task filters composable
 * Provides filtering functions for task lists
 *
 * @returns {Object} Filter functions
 */
export function useTaskFilters() {
  return {
    filterTasksByStatus,
    filterTasksByPriority,
    filterTasksBySearchTerm,
    applyTaskFilters,
  };
}
