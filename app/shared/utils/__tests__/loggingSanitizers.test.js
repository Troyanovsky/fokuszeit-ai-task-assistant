/**
 * Tests for logging sanitizers and summary helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  redactAiRequestPayload,
  redactFunctionCall,
  redactTask,
  summarizeTasks
} from '../loggingSanitizers.js';

describe('loggingSanitizers', () => {
  it('summarizes tasks with count and sample ids', () => {
    const tasks = [{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3' }];
    expect(summarizeTasks(tasks, { sampleSize: 2 })).toEqual({
      count: 3,
      sampleIds: ['task-1', 'task-2']
    });
  });

  it('redacts task details', () => {
    const task = {
      id: 'task-1',
      name: 'Secret task',
      description: 'Sensitive details',
      dueDate: '2024-01-01',
      plannedTime: '2024-01-01T10:00:00Z',
      status: 'planning'
    };
    expect(redactTask(task)).toEqual({
      id: 'task-1',
      projectId: undefined,
      status: 'planning',
      priority: undefined,
      dueDate: '[REDACTED]',
      plannedTime: '[REDACTED]'
    });
  });

  it('redacts function call arguments', () => {
    const functionCall = { id: 'call-1', name: 'queryTasks', arguments: { name: 'Secrets' } };
    expect(redactFunctionCall(functionCall)).toEqual({
      id: 'call-1',
      name: 'queryTasks',
      arguments: '[REDACTED]'
    });
  });

  it('redacts AI request payload message content and tool arguments', () => {
    const payload = {
      model: 'test-model',
      messages: [
        { role: 'user', content: 'Secret message' },
        {
          role: 'assistant',
          content: 'Reply',
          tool_calls: [
            { id: 'tool-1', type: 'function', function: { name: 'queryTasks', arguments: '{}' } }
          ]
        }
      ]
    };

    const redacted = redactAiRequestPayload(payload);
    expect(redacted.messages[0].content).toBe('[REDACTED]');
    expect(redacted.messages[1].content).toBe('[REDACTED]');
    expect(redacted.messages[1].tool_calls[0].function.arguments).toBe('[REDACTED]');
  });
});
