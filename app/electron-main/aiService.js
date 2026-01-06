/**
 * AI service for handling LLM interactions and tool execution.
 */

import { randomUUID } from 'crypto';
import axios from 'axios';
import Store from 'electron-store';
import projectManager from '../src/services/project.js';
import logger from './logger.js';
import { handleFunctionCall } from './functionHandlers.js';
import { isDebugLoggingEnabled, shouldLogRaw } from '../src/utils/loggingConfig.js';
import { redactAiRequestPayload, redactAiResponsePayload, redactFunctionCall } from '../src/utils/loggingSanitizers.js';

// Initialize persistent store
const store = new Store({
  name: 'ai-settings',
  defaults: {
    aiSettings: {
      apiKey: '',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    }
  }
});

// AI state
const aiState = {
  chatHistory: [],
  isConfigured: false,
  apiKey: store.get('aiSettings.apiKey', ''),
  apiUrl: store.get('aiSettings.apiUrl', 'https://api.openai.com/v1/chat/completions'),
  model: store.get('aiSettings.model', 'gpt-4o-mini')
};

// Set initial configuration state
aiState.isConfigured = Boolean(aiState.apiKey);

function createRequestId() {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function logAiRequestSummary(requestId, requestPayload) {
  logger.info('AI API Request', {
    requestId,
    model: requestPayload?.model,
    messageCount: requestPayload?.messages?.length ?? 0,
    toolCount: requestPayload?.tools?.length ?? 0
  });
}

function logAiResponseSummary(requestId, responseData) {
  const choiceCount = responseData?.choices?.length ?? 0;
  const toolCallCount = responseData?.choices?.reduce((count, choice) => {
    return count + (choice?.message?.tool_calls?.length ?? 0);
  }, 0);

  logger.info('AI API Response', {
    requestId,
    choiceCount,
    toolCallCount
  });
}



/**
 * Helper function to update chat history and send update to frontend
 * @param {Object} message - Message to add to chat history
 * @param {BrowserWindow} mainWindow - Main window instance for sending updates
 */
function updateChatHistory(message, mainWindow) {
  aiState.chatHistory.push(message);
  if (mainWindow) {
    mainWindow.webContents.send('ai:chatHistoryUpdate', aiState.chatHistory);
  }
}

/**
 * Helper function to process function calls and collect results
 * @param {Array} functionCalls - Array of function calls to process
 * @param {BrowserWindow} mainWindow - Main window instance for sending updates
 * @returns {Array} - Array of function results
 */
async function processFunctionCalls(functionCalls, mainWindow, requestId) {
  const functionResults = [];
  
  for (const functionCall of functionCalls) {
    const result = await executeFunctionCall(functionCall, requestId);
    
    functionResults.push({
      functionName: functionCall.name,
      functionCallId: functionCall.id,
      data: result
    });
    
    // Handle tool message creation and update
    updateChatHistory(createToolMessage(functionCall, result), mainWindow);
    
    // Trigger UI updates if applicable
    if (result) {
      triggerUIUpdates(functionCall, result, mainWindow);
    }
  }
  
  return functionResults;
}

function createToolMessage(functionCall, result) {
  return {
    role: 'tool',
    tool_call_id: functionCall.id,
    content: JSON.stringify(result),
    sender: 'tool',
    timestamp: new Date(),
    functionName: functionCall.name
  };
}

function triggerUIUpdates(functionCall, result, mainWindow) {
  const functionGroups = {
    project: ['addProject', 'updateProject', 'deleteProject'],
    task: ['addTask', 'updateTask', 'deleteTask'],
    notification: ['addNotification', 'updateNotification', 'deleteNotification']
  };

  if (functionGroups.project.includes(functionCall.name)) {
    mainWindow.webContents.send('projects:refresh');
  }

  if (functionGroups.task.includes(functionCall.name)) {
    mainWindow.webContents.send('tasks:refresh');
  }

  if (functionGroups.notification.includes(functionCall.name)) {
    mainWindow.webContents.send('notifications:refresh');
    
    const taskId = result.notification?.taskId || result.taskId;
    if (taskId) {
      mainWindow.webContents.send('notifications:changed', taskId);
    }
  }
}

/**
 * Configure AI service with provided settings
 * @param {Object} config - Configuration object
 * @returns {Object} - Configuration status
 */
function configureAI(config) {
  try {
    aiState.apiKey = config.apiKey || aiState.apiKey;
    aiState.apiUrl = config.apiUrl || aiState.apiUrl;
    aiState.model = config.model || aiState.model;
    aiState.isConfigured = Boolean(aiState.apiKey);
    
    // Persist settings
    store.set('aiSettings.apiKey', aiState.apiKey);
    store.set('aiSettings.apiUrl', aiState.apiUrl);
    store.set('aiSettings.model', aiState.model);
    
    logger.info('AI service configured successfully');
    
    return { 
      success: true, 
      isConfigured: aiState.isConfigured,
      apiKey: aiState.apiKey,
      apiUrl: aiState.apiUrl,
      model: aiState.model
    };
  } catch (error) {
    logger.logError(error, 'Error configuring AI');
    return { success: false, error: error.message };
  }
}

/**
 * Get the current chat history
 * @returns {Array} - Chat history
 */
function getChatHistory() {
  return aiState.chatHistory;
}

/**
 * Clear the chat history
 * @returns {boolean} - Success status
 */
function clearHistory() {
  aiState.chatHistory = [];
  return true;
}

/**
 * Send a message to the AI service
 * @param {string} message - User message
 * @param {BrowserWindow} mainWindow - Main window instance for sending updates
 * @returns {Object} - Response with chat history
 */
async function sendMessage(message, mainWindow) {
  try {
    // Add user message to history
    const userMessage = {
      text: message,
      sender: 'user',
      timestamp: new Date()
    };
    updateChatHistory(userMessage, mainWindow);

    // Check if AI is configured
    if (!aiState.isConfigured) {
      const errorMessage = {
        text: 'AI service not configured. Please set API key in Settings.',
        sender: 'ai',
        timestamp: new Date()
      };
      updateChatHistory(errorMessage, mainWindow);
      return { success: false, error: 'AI service not configured', chatHistory: aiState.chatHistory };
    }

    // Process with LLM API using the user message directly
    const response = await processWithLLM(message);

    // Pick one random AI response for tool calls from the list of responses
    const randomAIResponses = [
      "I'll help you with that.",
      "I'm on it.",
      "I'm working on it.",
      "I'm on it.",
    ];
    const randomAIResponse = randomAIResponses[Math.floor(Math.random() * randomAIResponses.length)];

    // Add AI response to history
    const aiMessage = {
      text: response.text || randomAIResponse,
      sender: 'ai',
      timestamp: new Date(),
      functionCalls: response.functionCalls
    };
    updateChatHistory(aiMessage, mainWindow);

    // Handle function calls if present
    if (response.functionCalls && response.functionCalls.length > 0) {
      // Process the function calls and collect results
      const functionResults = await processFunctionCalls(
        response.functionCalls,
        mainWindow,
        response.requestId
      );
      
      // Send all function results back to the LLM for a follow-up response
      const followUpResponse = await processWithLLM(null, functionResults);
      
      // Add the follow-up response to chat history
      const followUpMessage = {
        text: followUpResponse.text || randomAIResponse,
        sender: 'ai',
        timestamp: new Date(),
        functionCalls: followUpResponse.functionCalls
      };
      updateChatHistory(followUpMessage, mainWindow);
      
      // Handle nested function calls if present in follow-up response
      if (followUpResponse.functionCalls && followUpResponse.functionCalls.length > 0) {
        // Process the nested function calls and collect results
        const nestedFunctionResults = await processFunctionCalls(
          followUpResponse.functionCalls,
          mainWindow,
          followUpResponse.requestId
        );
        
        // Send all nested function results back to the LLM for a final response
        const finalResponse = await processWithLLM(null, nestedFunctionResults);
        
        // Add the final response to chat history
        const finalMessage = {
          text: finalResponse.text,
          sender: 'ai',
          timestamp: new Date(),
          functionCalls: finalResponse.functionCalls
        };
        updateChatHistory(finalMessage, mainWindow);
      }
    }

    return { success: true, chatHistory: aiState.chatHistory };
  } catch (error) {
    logger.logError(error, 'Error sending message');
    
    // Add error message to chat history
    const errorMessage = {
      text: `Sorry, I encountered an error: ${error.message}`,
      sender: 'ai',
      timestamp: new Date()
    };
    updateChatHistory(errorMessage, mainWindow);
    
    return { 
      success: false, 
      error: error.message,
      chatHistory: aiState.chatHistory
    };
  }
}

/**
 * Prepare the system message for the LLM API
 * @returns {string} - System message
 */
async function prepareSystemMessage() {
  const systemMessageTemplate = `<role>
You're FokusZeit, an AI task assistant.
</role>

<goal>
Use the tools provided to you to help the user with their task & project management.
</goal>

<available_projects>
{{__PROJECTS_INFO__}}
</available_projects>

<current_datetime>{{__CURRENT_DATETIME__}}</current_datetime>

<recurrence>
Tasks can be set to repeat on a schedule (recurrence). When users want tasks to repeat:
- Use setTaskRecurrence to add or update recurrence for a task
- Use removeTaskRecurrence to stop a task from repeating
- Use getTaskRecurrence to check a task's recurrence settings

Recurrence parameters:
- frequency: "daily", "weekly", "monthly", or "yearly"
- interval: How often (default 1, e.g., 2 = "every 2 weeks")
- endDate: Optional end date in YYYY-MM-DD format
- count: Optional maximum number of occurrences

Common phrases indicating recurrence:
- "repeat daily", "every day", "daily task" â†?frequency: "daily"
- "every week", "weekly", "repeats weekly" â†?frequency: "weekly"
- "every month", "monthly" â†?frequency: "monthly"
- "every year", "yearly", "annually" â†?frequency: "yearly"
- "every 2 days", "every 3 weeks" â†?frequency + interval
- "until [date]" â†?endDate
- "for [n] times", "[n] occurrences" â†?count

Example: "Create a daily standup task" â†?addTask then setTaskRecurrence(frequency: "daily")
Example: "Make this task repeat every week until December 31st" â†?setTaskRecurrence(frequency: "weekly", endDate: "2024-12-31")
Example: "Stop this task from repeating" â†?removeTaskRecurrence(taskId)
</recurrence>

<tips>
- For some queries, you may need to execute multiple tools in a row to find info that the user didn't provide, like task id or notification id.
- Most of the time, the user won't refer to tasks/projects/notifications with id but names or vague descriptions. In this case, use queryTasks or queryNotifications to find out the id.
- When creating tasks that should repeat, first create the task with addTask, then use setTaskRecurrence on the returned task ID.
</tips>`;

  try {
    const projects = await projectManager.getProjects();
    let projectsInfo = 'No projects available.';
    if (projects && projects.length > 0) {
      projectsInfo = projects.map(project => `- ${project.name} (ID: ${project.id})`).join('\n');
    }
    const now = new Date();
    const localTimeString = now.toLocaleString();
    return systemMessageTemplate
      .replace('{{__PROJECTS_INFO__}}', projectsInfo)
      .replace('{{__CURRENT_DATETIME__}}', localTimeString);
  } catch (error) {
    logger.logError(error, 'Error fetching projects for AI context');
    return systemMessageTemplate
      .replace('{{__PROJECTS_INFO__}}', 'Error fetching projects.')
      .replace('{{__CURRENT_DATETIME__}}', new Date().toLocaleString());
  }
}

/**
 * Builds the messages array for the LLM API
 * @param {*} chatHistory 
 * @param {*} userInput 
 * @param {*} functionResults 
 * @param {*} systemMessage 
 * @returns 
 */
function buildMessagesArray(chatHistory, userInput, functionResults, systemMessage) {
  const messages = [{ role: 'system', content: systemMessage }];
  const functionCallIdsToSkip = new Set();

  if (functionResults) {
    const results = Array.isArray(functionResults) ? functionResults : [functionResults];
    results.forEach(result => {
      if (result.functionCallId) functionCallIdsToSkip.add(result.functionCallId);
    });
  }

  chatHistory.forEach((msg, i) => {
    if (shouldSkipMessage(msg, i, chatHistory.length, functionResults, functionCallIdsToSkip)) return;
    
    switch (msg.sender) {
      case 'user':
        messages.push({ role: 'user', content: msg.text });
        break;
      case 'ai':
        messages.push(createAssistantMessage(msg));
        break;
      case 'tool':
      default:
        if (msg.role === 'tool') {
          messages.push({
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            content: msg.content
          });
        }
        break;
    }
  });

  if (functionResults) {
    const results = Array.isArray(functionResults) ? functionResults : [functionResults];
    results.forEach((result, idx) => {
      const toolCallId = result.functionCallId || `call_${Date.now()}_${idx}`;
      messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result.data)
      });
    });
  } else if (userInput) {
    messages.push({ role: 'user', content: userInput });
  }

  return messages;
}

/**
 * Checks if a message should be skipped based on the function results
 * @param {Object} msg - The message to check
 * @param {number} index - The index of the message in the chat history
 * @param {number} historyLength - The length of the chat history
 * @param {Object} functionResults - The function results
 * @param {Set} skipIds - The set of tool call IDs to skip
 * @returns {boolean} - True if the message should be skipped, false otherwise
 */
function shouldSkipMessage(msg, index, historyLength, functionResults, skipIds) {
  return (
    (functionResults === null &&
     index === historyLength - 1 &&
     msg.sender === 'user') ||
    (msg.sender === 'tool' &&
     msg.tool_call_id &&
     skipIds.has(msg.tool_call_id))
  );
}

/**
 * Creates an assistant message for the LLM API
 * @param {Object} msg - The message to create an assistant message for
 * @returns {Object} - The assistant message
 */
function createAssistantMessage(msg) {
  const message = {
    role: 'assistant',
    content: msg.text
  };
  
  if (msg.functionCalls?.length > 0) {
    message.tool_calls = msg.functionCalls.map((fc, idx) => ({
      type: 'function',
      id: fc.id || `call_${Date.now()}_${idx}`,
      function: {
        name: fc.name,
        arguments: JSON.stringify(fc.arguments)
      }
    }));
  }
  
  return message;
}

/**
 * Calls the LLM API
 * @param {Array} messages - The messages to send to the LLM API
 * @param {Array} functionSchemas - The function schemas to use for the LLM API
 * @returns {Object} - The response from the LLM API
 */
async function callLLMAPI(messages, functionSchemas, requestId) {
  const requestPayload = {
    model: aiState.model,
    messages,
    tools: functionSchemas,
    tool_choice: 'auto'
  };

  const debugEnabled = isDebugLoggingEnabled();
  const rawEnabled = shouldLogRaw(requestId);

  logAiRequestSummary(requestId, requestPayload);
  if (debugEnabled) {
    const payload = rawEnabled ? requestPayload : redactAiRequestPayload(requestPayload);
    logger.debug('AI API Request Payload', { requestId, payload });
  }

  const response = await axios.post(
    aiState.apiUrl,
    requestPayload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiState.apiKey}`
      }
    }
  );

  logAiResponseSummary(requestId, response.data);
  if (debugEnabled) {
    const payload = rawEnabled ? response.data : redactAiResponsePayload(response.data);
    logger.debug('AI API Response Payload', { requestId, payload });
  }
  return response.data.choices[0].message;
}

/**
 * Processes the AI response
 * @param {Object} aiResponse - The response from the LLM API
 * @returns {Object} - The processed response
 */
function processAIResponse(aiResponse) {
  // Pick one random AI response for tool calls from the list of responses
  const randomAIResponses = [
    "I'll help you with that.",
    "I'm on it.",
    "I'm working on it.",
    "I'm on it.",
  ];
  const randomAIResponse = randomAIResponses[Math.floor(Math.random() * randomAIResponses.length)];

  if (aiResponse.tool_calls?.length > 0) {
    const functionCalls = aiResponse.tool_calls
      .filter(toolCall => toolCall.type === 'function')
      .map(toolCall => ({
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      }));

    if (functionCalls.length > 0) {
      return {
        text: aiResponse.content || randomAIResponse,
        functionCalls
      };
    }
  }

  return {
    text: aiResponse.content || randomAIResponse
  };
}

/**
 * Processes the user input with the LLM API
 * @param {string} userInput - The user input
 * @param {Object} functionResults - The function results
 * @returns {Object} - The processed response
 */
async function processWithLLM(userInput, functionResults = null) {
  try {
    const functionSchemasModule = await import('../src/services/functionSchemas.js');
    const functionSchemas = functionSchemasModule.default;
    
    const formattedSystemMessage = await prepareSystemMessage();
    const messages = buildMessagesArray(
      aiState.chatHistory,
      userInput,
      functionResults,
      formattedSystemMessage
    );
    
    const requestId = createRequestId();
    const aiResponse = await callLLMAPI(messages, functionSchemas, requestId);
    return {
      requestId,
      ...processAIResponse(aiResponse)
    };
  } catch (error) {
    logger.logError(error, 'Error calling LLM API');
    throw new Error(`Failed to process input: ${error.message}`);
  }
}

/**
 * Executes a function call based on AI response
 * @param {Object} functionCall - Function call object from AI
 * @returns {Promise<Object>} - Result of the function execution
 */
async function executeFunctionCall(functionCall, requestId = null) {
  const { id, name, arguments: args } = functionCall;
  const debugEnabled = isDebugLoggingEnabled();
  const rawEnabled = shouldLogRaw(requestId);

  logger.info('Executing function call', { requestId, toolCallId: id, name });
  if (debugEnabled) {
    const payload = rawEnabled ? functionCall : redactFunctionCall(functionCall);
    logger.debug('Function call payload', { requestId, toolCallId: id, payload });
  }

  try {
    // Common result properties to include the original function call ID
    const baseResult = {
      functionCallId: id // Store the original function call ID
    };

    // Use the function handler dispatcher
    return await handleFunctionCall(name, args, baseResult);
  } catch (error) {
    logger.logError(error, `Error executing function "${name}"`);
    const baseResult = {
      functionCallId: id // Store the original function call ID
    };
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `Sorry, I couldn't complete that action: ${error.message}`
    };
  }
}

export default {
  configureAI,
  getChatHistory,
  clearHistory,
  sendMessage,
  processWithLLM,
  executeFunctionCall
}; 

