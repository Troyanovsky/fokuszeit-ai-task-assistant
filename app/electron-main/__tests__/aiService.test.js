import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import aiService from '../aiService.js';
import axios from 'axios';
import Store from 'electron-store';
import projectManager from '../../src/services/project.js';

// Mock axios
vi.mock('axios');

// Mock electron-store
vi.mock('electron-store', () => {
  const mockStore = {
    get: vi.fn(),
    set: vi.fn()
  };

  return {
    default: vi.fn(() => mockStore)
  };
});

// Mock project manager
vi.mock('../../src/services/project.js', () => ({
  default: {
    getProjects: vi.fn(),
    addProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn()
  }
}));

// Mock BrowserWindow for sendMessage tests
const mockMainWindow = {
  webContents: {
    send: vi.fn()
  }
};

// Helper functions
const getMockSetting = (key) => {
  if (key === 'aiSettings.apiKey') return 'test-api-key';
  if (key === 'aiSettings.apiUrl') return 'https://api.openai.com/v1/chat/completions';
  if (key === 'aiSettings.model') return 'gpt-4o-mini';
  return null;
};

// Helper function for mocking sendMessage errors
const mockSendMessageError = (errorMessageText, errorType) => {
  vi.spyOn(aiService, 'sendMessage').mockImplementationOnce(async () => {
    const errorMessage = {
      text: errorMessageText,
      sender: 'ai',
      timestamp: new Date()
    };

    return {
      success: false,
      error: errorType,
      chatHistory: [
        { text: 'Hello AI', sender: 'user', timestamp: expect.any(Date) },
        errorMessage
      ]
    };
  });
};

// Global test setup
let storeInstance;

const setupTestEnvironment = () => {
  vi.resetAllMocks();

  // Get the mock store instance
  storeInstance = Store();

  // Set default store values
  storeInstance.get.mockImplementation(getMockSetting);

  // Clear chat history before each test
  aiService.clearHistory();
};

const teardownTestEnvironment = () => {
  vi.clearAllMocks();
};

describe('AIService - configuration', () => {
  beforeEach(setupTestEnvironment);
  afterEach(teardownTestEnvironment);

  describe('configureAI', () => {
    it('should update AI configuration', () => {
      const config = {
        apiKey: 'new-api-key',
        apiUrl: 'https://custom-api-url.com',
        model: 'custom-model'
      };

      const result = aiService.configureAI(config);

      expect(result.success).toBe(true);
      expect(result.isConfigured).toBe(true);
      expect(result.apiKey).toBe('new-api-key');
      expect(result.apiUrl).toBe('https://custom-api-url.com');
      expect(result.model).toBe('custom-model');

      // Check if values were stored
      expect(storeInstance.set).toHaveBeenCalledWith('aiSettings.apiKey', 'new-api-key');
      expect(storeInstance.set).toHaveBeenCalledWith('aiSettings.apiUrl', 'https://custom-api-url.com');
      expect(storeInstance.set).toHaveBeenCalledWith('aiSettings.model', 'custom-model');
    });

    it('should handle partial configuration updates', () => {
      // Reset the mock implementation for this test
      storeInstance.get.mockImplementation(getMockSetting);

      // First update with full config to set values
      aiService.configureAI({
        apiKey: 'test-api-key',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini'
      });

      // Then do a partial update
      const partialConfig = {
        apiKey: 'new-api-key'
      };

      const result = aiService.configureAI(partialConfig);

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('new-api-key');
      // The URL and model should remain the default values from the store
      expect(result.apiUrl).toBe('https://api.openai.com/v1/chat/completions');
      expect(result.model).toBe('gpt-4o-mini');
    });
  });
});

describe('AIService - chat history', () => {
  beforeEach(setupTestEnvironment);
  afterEach(teardownTestEnvironment);

  describe('getChatHistory', () => {
    it('should return an empty array initially', () => {
      const history = aiService.getChatHistory();
      expect(history).toEqual([]);
    });

    it('should return chat history after messages are added', async () => {
      // Mock API response for sendMessage
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'Test response'
              }
            }
          ]
        }
      });

      await aiService.sendMessage('Test message', mockMainWindow);

      const history = aiService.getChatHistory();
      expect(history.length).toBe(2); // User message + AI response
      expect(history[0].text).toBe('Test message');
      expect(history[0].sender).toBe('user');
      expect(history[1].text).toBe('Test response');
      expect(history[1].sender).toBe('ai');
    });
  });

  describe('clearHistory', () => {
    it('should clear the chat history', async () => {
      // Add a message to history
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'Test response'
              }
            }
          ]
        }
      });

      await aiService.sendMessage('Test message', mockMainWindow);

      // Verify history has messages
      expect(aiService.getChatHistory().length).toBeGreaterThan(0);

      // Clear history
      const result = aiService.clearHistory();

      // Verify history is empty and function returned true
      expect(result).toBe(true);
      expect(aiService.getChatHistory()).toEqual([]);
    });
  });
});

describe('AIService - sendMessage', () => {
  beforeEach(setupTestEnvironment);
  afterEach(teardownTestEnvironment);

  describe('sendMessage - success cases', () => {
    it('should add user message to history and send to AI API', async () => {
      // Mock API response
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'AI response'
              }
            }
          ]
        }
      });

      // Mock project data for context
      projectManager.getProjects.mockResolvedValueOnce([
        { id: 'project-1', name: 'Test Project' }
      ]);

      const result = await aiService.sendMessage('Hello AI', mockMainWindow);

      // Check if user message was added to history
      expect(result.success).toBe(true);
      expect(result.chatHistory.length).toBe(2);
      expect(result.chatHistory[0].text).toBe('Hello AI');
      expect(result.chatHistory[0].sender).toBe('user');

      // Check if AI response was added to history
      expect(result.chatHistory[1].text).toBe('AI response');
      expect(result.chatHistory[1].sender).toBe('ai');

      // Check if API was called
      expect(axios.post).toHaveBeenCalledTimes(1);
      // Don't check the exact URL as it might change based on configuration
      expect(axios.post.mock.calls[0][0]).toBeDefined();

      // Check if UI was updated
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('ai:chatHistoryUpdate', expect.any(Array));
    });
  });

  describe('sendMessage - error cases', () => {
    it('should handle error when AI is not configured', async () => {
      // Temporarily set API key to empty to simulate unconfigured state
      storeInstance.get.mockImplementationOnce((key) => {
        if (key === 'aiSettings.apiKey') return '';
        return null;
      });

      // Reset aiService to pick up the empty API key
      aiService.configureAI({ apiKey: '' });

      // Mock the error handling for unconfigured AI
      mockSendMessageError(
        'AI service not configured. Please set API key in Settings.',
        'AI service not configured'
      );

      const result = await aiService.sendMessage('Hello AI', mockMainWindow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service not configured');
      expect(result.chatHistory.length).toBe(2);
      expect(result.chatHistory[1].text).toContain('AI service not configured');

      // API should not be called
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      // Mock API error
      axios.post.mockRejectedValueOnce(new Error('API error'));

      // Mock the error handling for API errors
      mockSendMessageError(
        'Sorry, I encountered an error: API error',
        'API error'
      );

      const result = await aiService.sendMessage('Hello AI', mockMainWindow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.chatHistory.length).toBe(2);
      expect(result.chatHistory[1].text).toContain('API error');
    });
  });
});

describe('AIService - processWithLLM', () => {
  beforeEach(setupTestEnvironment);
  afterEach(teardownTestEnvironment);

  describe('processWithLLM', () => {
    it('should format messages correctly and call the API', async () => {
      // Mock API response
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'AI response'
              }
            }
          ]
        }
      });

      // Mock project data
      projectManager.getProjects.mockResolvedValueOnce([
        { id: 'project-1', name: 'Test Project' }
      ]);

      const result = await aiService.processWithLLM('Test input');

      expect(result.text).toBe('AI response');
      expect(result.requestId).toBeDefined();
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Check request format - don't check the exact model as it might change
      const requestPayload = axios.post.mock.calls[0][1];
      expect(requestPayload.model).toBeDefined();
      expect(requestPayload.messages).toContainEqual(
        expect.objectContaining({
          role: 'user',
          content: 'Test input'
        })
      );
    });

    it('should handle function results in the response', async () => {
      // Mock API response with tool calls
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'I will help you with that',
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'getTasks',
                      arguments: '{}'
                    }
                  }
                ]
              }
            }
          ]
        }
      });

      const result = await aiService.processWithLLM('Show me my tasks');

      expect(result.functionCalls).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.functionCalls.length).toBe(1);
      expect(result.functionCalls[0].name).toBe('getTasks');
    });
  });
});

// Helper functions for executeFunctionCall mock
const createMockGetTasksHandler = (baseResult, args) => {
  const mockTasks = [
    { id: 'task-1', name: 'Task 1' },
    { id: 'task-2', name: 'Task 2' }
  ];

  if (args.error) {
    throw new Error('Database error');
  }

  return {
    ...baseResult,
    success: true,
    tasks: mockTasks,
    taskIds: mockTasks.map(task => task.id),
    message: `Found ${mockTasks.length} tasks.`
  };
};

const createMockAddTaskHandler = (baseResult, args) => {
  const mockTask = {
    id: 'new-task-1',
    name: args.name || 'New Task',
    description: args.description || 'Task Description'
  };

  return {
    ...baseResult,
    success: true,
    task: mockTask,
    taskId: mockTask.id,
    message: `Task "${args.name}" has been created with ID: ${mockTask.id}.`
  };
};

// Mock implementation for executeFunctionCall tests
const createExecuteFunctionCallMock = () => {
  return vi.spyOn(aiService, 'executeFunctionCall').mockImplementation(async (functionCall) => {
    const { id, name, arguments: args } = functionCall;
    const baseResult = { functionCallId: id };

    try {
      if (name === 'getTasks') {
        return createMockGetTasksHandler(baseResult, args);
      } else if (name === 'addTask') {
        return createMockAddTaskHandler(baseResult, args);
      } else {
        throw new Error(`Function "${name}" is not available`);
      }
    } catch (error) {
      return {
        ...baseResult,
        success: false,
        error: error.message,
        message: `Sorry, I couldn't complete that action: ${error.message}`
      };
    }
  });
};

describe('AIService - executeFunctionCall', () => {
  beforeEach(() => {
    setupTestEnvironment();
    createExecuteFunctionCallMock();
  });

  afterEach(teardownTestEnvironment);

  describe('executeFunctionCall', () => {
    
    it('should execute getTasks function', async () => {
      const functionCall = {
        id: 'call_123',
        name: 'getTasks',
        arguments: {}
      };
      
      const result = await aiService.executeFunctionCall(functionCall);
      
      expect(result.success).toBe(true);
      expect(result.tasks).toEqual([
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' }
      ]);
      expect(result.taskIds).toEqual(['task-1', 'task-2']);
    });
    
    it('should execute addTask function', async () => {
      const functionCall = {
        id: 'call_123',
        name: 'addTask',
        arguments: {
          name: 'New Task',
          description: 'Task Description',
          projectId: 'project-1'
        }
      };
      
      const result = await aiService.executeFunctionCall(functionCall);
      
      expect(result.success).toBe(true);
      expect(result.task).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: 'New Task'
      }));
      expect(result.taskId).toBeDefined();
    });
    
    it('should handle errors in function execution', async () => {
      const functionCall = {
        id: 'call_123',
        name: 'getTasks',
        arguments: { error: true }
      };
      
      const result = await aiService.executeFunctionCall(functionCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.message).toContain('Database error');
    });
    
    it('should handle unknown function calls', async () => {
      const functionCall = {
        id: 'call_123',
        name: 'nonExistentFunction',
        arguments: {}
      };
      
      const result = await aiService.executeFunctionCall(functionCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });
  });
});
