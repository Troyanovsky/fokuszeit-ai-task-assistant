/**
 * Recurrence handlers for AI function calls.
 * Handles task recurrence rule operations (CRUD).
 */

import logger from '../logger.js';
import { formatToYYYYMMDD, formatDateToYYYYMMDDLocal, formatRecurrenceRuleForResponse } from './utils/dateTimeParsers.js';
import { validateFrequency } from './utils/argumentParsers.js';

/**
 * Handle setTaskRecurrence function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleSetTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('../services/recurrence.js');

  // Validate required parameters
  if (!args.taskId || !args.frequency) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameters: taskId and frequency',
      message: 'I need a task ID and frequency to set recurrence.'
    };
  }

  // Validate frequency enum
  if (!validateFrequency(args.frequency)) {
    return {
      ...baseResult,
      success: false,
      error: `Invalid frequency: ${args.frequency}`,
      message: `I couldn't set recurrence because "${args.frequency}" is not a valid frequency. Valid options are: daily, weekly, monthly, yearly`
    };
  }

  // Build recurrence rule data
  const ruleData = {
    taskId: args.taskId,
    frequency: args.frequency
  };

  if (args.interval !== undefined && args.interval !== null) {
    ruleData.interval = args.interval;
  }

  // Add optional parameters
  if (args.endDate) {
    const formattedEndDate = formatToYYYYMMDD(args.endDate);
    if (formattedEndDate) {
      ruleData.endDate = formattedEndDate;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Invalid end date format: ${args.endDate}`,
        message: `I couldn't set recurrence because the end date format is invalid. Use YYYY-MM-DD format.`
      };
    }
  }

  if (args.count !== undefined && args.count !== null) {
    ruleData.count = args.count;
  }

  try {
    // Check if task already has a recurrence rule
    const existingRule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);

    let result;
    let recurrenceRule = null;
    let ruleId = null;
    if (existingRule) {
      // Update existing rule
      result = await recurrenceService.default.updateRecurrenceRule(existingRule.id, ruleData);
      ruleId = existingRule.id;
    } else {
      // Add new rule
      if (ruleData.interval === undefined) {
        ruleData.interval = 1;
      }
      result = await recurrenceService.default.addRecurrenceRule(ruleData);
      ruleId = result?.id ?? null;
    }

    if (!result || !ruleId) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to save recurrence rule',
        message: `I couldn't save the recurrence rule for task "${args.taskId}". The operation may have failed validation or database constraints.`
      };
    }

    const savedRule = await recurrenceService.default.getRecurrenceRuleById(ruleId);
    recurrenceRule = formatRecurrenceRuleForResponse(savedRule);

    if (!recurrenceRule) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to save recurrence rule',
        message: `I couldn't save the recurrence rule for task "${args.taskId}". The operation may have failed validation or database constraints.`
      };
    }

    return {
      ...baseResult,
      success: true,
      recurrenceRule,
      taskId: args.taskId,
      message: `Task "${args.taskId}" has been set to repeat ${recurrenceRule.frequency}${recurrenceRule.interval > 1 ? ` every ${recurrenceRule.interval} ${recurrenceRule.frequency}s` : ''}.`
    };
  } catch (error) {
    logger.logError(error, 'Error setting task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't set recurrence for task "${args.taskId}": ${error.message}`
    };
  }
}

/**
 * Handle removeTaskRecurrence function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleRemoveTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('../services/recurrence.js');

  if (!args.taskId) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameter: taskId',
      message: 'I need a task ID to remove recurrence.'
    };
  }

  try {
    const existingRule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);
    if (!existingRule) {
      return {
        ...baseResult,
        success: true,
        taskId: args.taskId,
        hasRecurrence: false,
        message: `Task "${args.taskId}" does not have a recurrence rule to remove.`
      };
    }

    const removed = await recurrenceService.default.deleteRecurrenceRuleByTaskId(args.taskId);
    if (!removed) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to remove recurrence rule',
        message: `I couldn't remove recurrence from task "${args.taskId}". The delete operation failed.`
      };
    }

    return {
      ...baseResult,
      success: true,
      taskId: args.taskId,
      hasRecurrence: false,
      message: `Recurrence has been removed from task "${args.taskId}". The task will no longer repeat.`
    };
  } catch (error) {
    logger.logError(error, 'Error removing task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't remove recurrence from task "${args.taskId}": ${error.message}`
    };
  }
}

/**
 * Handle getTaskRecurrence function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleGetTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('../services/recurrence.js');

  if (!args.taskId) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameter: taskId',
      message: 'I need a task ID to get recurrence information.'
    };
  }

  try {
    const rule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);

    if (!rule) {
      return {
        ...baseResult,
        success: true,
        taskId: args.taskId,
        hasRecurrence: false,
        message: `Task "${args.taskId}" does not have a recurrence rule set.`
      };
    }

    // Format recurrence rule for AI readability
    const formattedRule = formatRecurrenceRuleForResponse(rule);

    // Build human-readable description
    const descriptionParts = [];
    descriptionParts.push(`Repeats ${rule.frequency}`);
    if (rule.interval > 1) {
      descriptionParts.push(`every ${rule.interval} ${rule.frequency}s`);
    }
    if (rule.endDate) {
      const formattedEndDate = formatDateToYYYYMMDDLocal(rule.endDate);
      if (formattedEndDate) {
        descriptionParts.push(`until ${formattedEndDate}`);
      }
    }
    if (rule.count) {
      descriptionParts.push(`for ${rule.count} total occurrences`);
    }

    return {
      ...baseResult,
      success: true,
      recurrenceRule: formattedRule,
      taskId: args.taskId,
      hasRecurrence: true,
      message: `Task "${args.taskId}" ${descriptionParts.join(' ')}.`
    };
  } catch (error) {
    logger.logError(error, 'Error getting task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't get recurrence information for task "${args.taskId}": ${error.message}`
    };
  }
}
