/**
 * Tests for AI function handlers that manage task recurrence.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFunctionCall } from '../functionHandlers.js';
import recurrenceService from '../services/recurrence.js';

vi.mock('../services/recurrence.js', () => ({
  default: {
    getRecurrenceRuleByTaskId: vi.fn(),
    updateRecurrenceRule: vi.fn(),
    addRecurrenceRule: vi.fn(),
    getRecurrenceRuleById: vi.fn()
  }
}));

describe('functionHandlers - setTaskRecurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a formatted recurrence rule when updating an existing rule', async () => {
    recurrenceService.getRecurrenceRuleByTaskId.mockResolvedValue({
      id: 'rule-1',
      taskId: 'task-1'
    });
    recurrenceService.updateRecurrenceRule.mockResolvedValue(true);
    recurrenceService.getRecurrenceRuleById.mockResolvedValue({
      id: 'rule-1',
      taskId: 'task-1',
      frequency: 'weekly',
      interval: 2,
      endDate: new Date(2025, 0, 2),
      count: 3
    });

    const result = await handleFunctionCall(
      'setTaskRecurrence',
      { taskId: 'task-1', frequency: 'weekly', interval: 2 },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.recurrenceRule).toEqual({
      taskId: 'task-1',
      frequency: 'weekly',
      interval: 2,
      endDate: '2025-01-02',
      count: 3
    });
  });

  it('preserves interval when updating without providing one', async () => {
    recurrenceService.getRecurrenceRuleByTaskId.mockResolvedValue({
      id: 'rule-3',
      taskId: 'task-3',
      interval: 2
    });
    recurrenceService.updateRecurrenceRule.mockResolvedValue(true);
    recurrenceService.getRecurrenceRuleById.mockResolvedValue({
      id: 'rule-3',
      taskId: 'task-3',
      frequency: 'weekly',
      interval: 2,
      endDate: '2025-02-01',
      count: null
    });

    const result = await handleFunctionCall(
      'setTaskRecurrence',
      { taskId: 'task-3', frequency: 'weekly', endDate: '2025-02-01' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.recurrenceRule).toEqual({
      taskId: 'task-3',
      frequency: 'weekly',
      interval: 2,
      endDate: '2025-02-01',
      count: null
    });
  });

  it('returns a formatted recurrence rule when creating a new rule', async () => {
    recurrenceService.getRecurrenceRuleByTaskId.mockResolvedValue(null);
    recurrenceService.addRecurrenceRule.mockResolvedValue({ id: 'rule-2' });
    recurrenceService.getRecurrenceRuleById.mockResolvedValue({
      id: 'rule-2',
      task_id: 'task-2',
      frequency: 'daily',
      interval: 1,
      endDate: '2025-03-04',
      count: null
    });

    const result = await handleFunctionCall(
      'setTaskRecurrence',
      { taskId: 'task-2', frequency: 'daily' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.recurrenceRule).toEqual({
      taskId: 'task-2',
      frequency: 'daily',
      interval: 1,
      endDate: '2025-03-04',
      count: null
    });
  });
});
