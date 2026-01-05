import { describe, it, expect, vi, beforeEach } from 'vitest';
import aiModule from '../ai.js';

// Mock dependencies
vi.mock('../../../services/ai.js', () => ({
  default: {
    configure: vi.fn(),
    processUserInput: vi.fn(),
    executeFunctionCall: vi.fn(),
  },
}));

// Mock window.electron
global.window = {
  electron: {
    configureAI: vi.fn(),
    sendMessage: vi.fn(),
    getChatHistory: vi.fn(),
    clearChatHistory: vi.fn(),
  },
};

describe('AI Store Module', () => {
  // Helper to create a mock commit function
  const createCommit = () => vi.fn();

  // Helper to create a mock dispatch function
  const createDispatch = () => vi.fn();

  // Helper to create mock state
  const createState = () => ({
    chatHistory: [],
    isProcessing: false,
    error: null,
    isConfigured: false,
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
  });

  // Helper to create mock rootState
  const createRootState = () => ({
    tasks: { tasks: [] },
    projects: { projects: [] },
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('configureAI', () => {
    it('should configure the AI service and update state', async () => {
      const commit = createCommit();
      const state = createState();
      const config = {
        apiKey: 'test-api-key',
        apiUrl: 'test-api-url',
        model: 'test-model',
      };

      // Mock successful configuration
      window.electron.configureAI.mockResolvedValue({
        success: true,
        apiKey: 'test-api-key',
        apiUrl: 'test-api-url',
        model: 'test-model',
        isConfigured: true,
      });

      await aiModule.actions.configureAI({ commit, state }, config);

      expect(window.electron.configureAI).toHaveBeenCalledWith(config);

      expect(commit).toHaveBeenCalledWith('setApiKey', 'test-api-key');
      expect(commit).toHaveBeenCalledWith('setApiUrl', 'test-api-url');
      expect(commit).toHaveBeenCalledWith('setModel', 'test-model');
      expect(commit).toHaveBeenCalledWith('setConfigured', true);
    });

    it('should handle configuration errors', async () => {
      const commit = createCommit();
      const state = createState();
      const config = { apiKey: 'test-api-key' };

      window.electron.configureAI.mockRejectedValue(new Error('Configuration error'));

      const result = await aiModule.actions.configureAI({ commit, state }, config);

      expect(result).toBe(false);
      expect(commit).toHaveBeenCalledWith('setError', 'Failed to configure AI service');
      expect(commit).toHaveBeenCalledWith('setConfigured', false);
    });
  });

  describe('sendMessage', () => {
    it('should add user message and set processing state', async () => {
      const commit = createCommit();
      const dispatch = createDispatch();
      const state = { ...createState(), isConfigured: true };
      const rootState = createRootState();
      const message = 'Test message';

      // Mock Date.now for consistent timestamps
      const mockDate = new Date('2023-01-01T12:00:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Mock successful response
      window.electron.sendMessage.mockResolvedValue({
        success: true,
        chatHistory: [
          { text: 'Test message', sender: 'user', timestamp: mockDate },
          { text: 'AI response', sender: 'ai', timestamp: mockDate },
        ],
      });

      await aiModule.actions.sendMessage({ commit, dispatch, state, rootState }, message);

      // Check processing state was set
      expect(commit).toHaveBeenCalledWith('setProcessing', true);
      expect(commit).toHaveBeenCalledWith('setError', null);

      // Check electron API was called
      expect(window.electron.sendMessage).toHaveBeenCalledWith(message);

      // Check chat history was updated
      expect(commit).toHaveBeenCalledWith('setChatHistory', [
        { text: 'Test message', sender: 'user', timestamp: mockDate },
        { text: 'AI response', sender: 'ai', timestamp: mockDate },
      ]);

      // Check processing state was reset
      expect(commit).toHaveBeenCalledWith('setProcessing', false);
    });

    it('should handle function calls in AI response', async () => {
      const commit = createCommit();
      const dispatch = createDispatch();
      const state = { ...createState(), isConfigured: true };
      const rootState = createRootState();
      const message = 'Create a task';

      // Mock successful response with function call
      window.electron.sendMessage.mockResolvedValue({
        success: true,
        chatHistory: [
          { text: 'Create a task', sender: 'user', timestamp: new Date() },
          {
            text: 'I will create a task',
            sender: 'ai',
            timestamp: new Date(),
            functionCall: {
              name: 'addTask',
              arguments: { name: 'New task', projectId: '123' },
            },
          },
          {
            text: 'Task created successfully',
            sender: 'ai',
            timestamp: new Date(),
            functionResult: {
              success: true,
            },
          },
        ],
      });

      await aiModule.actions.sendMessage({ commit, dispatch, state, rootState }, message);

      // Check electron API was called
      expect(window.electron.sendMessage).toHaveBeenCalledWith(message);

      // Check chat history was updated with all messages
      expect(commit).toHaveBeenCalledWith('setChatHistory', expect.any(Array));
    });

    it('should handle errors when AI service is not configured', async () => {
      const commit = createCommit();
      const dispatch = createDispatch();
      const state = { ...createState(), isConfigured: false };
      const rootState = createRootState();
      const message = 'Test message';

      window.electron.sendMessage.mockRejectedValue(new Error('AI service not configured'));

      await aiModule.actions.sendMessage({ commit, dispatch, state, rootState }, message);

      expect(commit).toHaveBeenCalledWith('setError', 'AI service not configured');
      expect(commit).toHaveBeenCalledWith('setProcessing', false);
    });
  });

  describe('loadChatHistory', () => {
    it('should load chat history from electron', async () => {
      const commit = createCommit();
      const chatHistory = [
        { text: 'Hello', sender: 'user', timestamp: new Date() },
        { text: 'Hi there', sender: 'ai', timestamp: new Date() },
      ];

      window.electron.getChatHistory.mockResolvedValue(chatHistory);

      await aiModule.actions.loadChatHistory({ commit });

      expect(window.electron.getChatHistory).toHaveBeenCalled();
      expect(commit).toHaveBeenCalledWith('setChatHistory', chatHistory);
    });
  });

  describe('clearHistory', () => {
    it('should clear chat history', async () => {
      const commit = createCommit();

      await aiModule.actions.clearHistory({ commit });

      expect(window.electron.clearChatHistory).toHaveBeenCalled();
      expect(commit).toHaveBeenCalledWith('clearChatHistory');
    });
  });

  describe('mutations', () => {
    it('should add a message to chat history', () => {
      const state = createState();
      const message = { text: 'Hello', sender: 'user', timestamp: new Date() };

      aiModule.mutations.addMessage(state, message);

      expect(state.chatHistory).toContain(message);
    });

    it('should set processing state', () => {
      const state = createState();

      aiModule.mutations.setProcessing(state, true);

      expect(state.isProcessing).toBe(true);
    });

    it('should clear chat history', () => {
      const state = { ...createState(), chatHistory: [{ text: 'Hello', sender: 'user' }] };

      aiModule.mutations.clearChatHistory(state);

      expect(state.chatHistory).toEqual([]);
    });

    it('should set error message', () => {
      const state = createState();

      aiModule.mutations.setError(state, 'Test error');

      expect(state.error).toBe('Test error');
    });

    it('should set configuration state', () => {
      const state = createState();

      aiModule.mutations.setConfigured(state, true);

      expect(state.isConfigured).toBe(true);
    });
  });
});
