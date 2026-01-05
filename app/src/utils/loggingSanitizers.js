/**
 * Logging sanitizers and summary helpers to reduce sensitive data exposure.
 */

const REDACTED = '[REDACTED]';

function getIdSample(items, sampleSize) {
  return items
    .slice(0, sampleSize)
    .map((item) => item?.id)
    .filter(Boolean);
}

export function summarizeTasks(tasks, { sampleSize = 5 } = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  return {
    count: list.length,
    sampleIds: getIdSample(list, sampleSize)
  };
}

export function summarizeNotifications(notifications, { sampleSize = 5 } = {}) {
  const list = Array.isArray(notifications) ? notifications : [];
  return {
    count: list.length,
    sampleIds: getIdSample(list, sampleSize)
  };
}

export function redactTask(task) {
  if (!task || typeof task !== 'object') {
    return task;
  }

  return {
    id: task.id,
    projectId: task.projectId ?? task.project_id,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate || task.due_date ? REDACTED : task.dueDate,
    plannedTime: task.plannedTime || task.planned_time ? REDACTED : task.plannedTime
  };
}

export function redactTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return tasks;
  }
  return tasks.map((task) => redactTask(task));
}

export function redactNotification(notification) {
  if (!notification || typeof notification !== 'object') {
    return notification;
  }

  return {
    id: notification.id,
    taskId: notification.taskId ?? notification.task_id,
    type: notification.type,
    time: notification.time ? REDACTED : notification.time,
    message: notification.message ? REDACTED : notification.message
  };
}

export function redactNotifications(notifications) {
  if (!Array.isArray(notifications)) {
    return notifications;
  }
  return notifications.map((notification) => redactNotification(notification));
}

export function redactFunctionCall(functionCall) {
  if (!functionCall || typeof functionCall !== 'object') {
    return functionCall;
  }

  return {
    id: functionCall.id,
    name: functionCall.name,
    arguments: functionCall.arguments ? REDACTED : functionCall.arguments
  };
}

function redactToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    return toolCalls;
  }

  return toolCalls.map((toolCall) => ({
    id: toolCall?.id,
    type: toolCall?.type,
    function: toolCall?.function
      ? {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments ? REDACTED : toolCall.function.arguments
        }
      : toolCall?.function
  }));
}

export function redactAiMessage(message) {
  if (!message || typeof message !== 'object') {
    return message;
  }

  return {
    ...message,
    content: message.content ? REDACTED : message.content,
    tool_calls: redactToolCalls(message.tool_calls)
  };
}

export function redactAiRequestPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return {
    ...payload,
    messages: Array.isArray(payload.messages)
      ? payload.messages.map((message) => redactAiMessage(message))
      : payload.messages
  };
}

export function redactAiResponsePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return {
    ...payload,
    choices: Array.isArray(payload.choices)
      ? payload.choices.map((choice) => ({
          ...choice,
          message: redactAiMessage(choice.message)
        }))
      : payload.choices
  };
}
