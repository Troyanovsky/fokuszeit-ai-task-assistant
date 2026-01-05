// Vuex store module for AI assistant state and configuration.
// Initial state
import logger from '../../services/logger';

const state = {
  chatHistory: [],
  isProcessing: false,
  error: null,
  isConfigured: false,
  apiKey: '',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
};

// Getters
const getters = {
  chatHistory: (state) => state.chatHistory,
  isProcessing: (state) => state.isProcessing,
  error: (state) => state.error,
  isConfigured: (state) => state.isConfigured,
  apiKey: (state) => state.apiKey,
  apiUrl: (state) => state.apiUrl,
  model: (state) => state.model,
};

// Actions
const actions = {
  async configureAI({ commit }, config) {
    try {
      // Use IPC bridge instead of direct service call
      const result = await window.electron.configureAI(config);

      if (result.success) {
        commit('setApiKey', result.apiKey);
        commit('setApiUrl', result.apiUrl);
        commit('setModel', result.model);
        commit('setConfigured', result.isConfigured);
        return true;
      } else {
        throw new Error(result.error || 'Failed to configure AI service');
      }
    } catch (error) {
      logger.error('Error configuring AI service:', error);
      commit('setError', 'Failed to configure AI service');
      commit('setConfigured', false);
      return false;
    }
  },

  async sendMessage({ commit }, message) {
    commit('setProcessing', true);
    commit('setError', null);

    try {
      // Use IPC bridge instead of direct service call
      const result = await window.electron.sendMessage(message);

      if (result.success) {
        // Update chat history from the main process
        commit('setChatHistory', result.chatHistory);
      } else {
        throw new Error(result.error || 'Failed to process message');
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      commit('setError', error.message || 'Failed to process message');
    } finally {
      commit('setProcessing', false);
    }
  },

  async loadChatHistory({ commit }) {
    try {
      const chatHistory = await window.electron.getChatHistory();
      commit('setChatHistory', chatHistory);
    } catch (error) {
      logger.error('Error loading chat history:', error);
    }
  },

  async loadSettings({ commit }) {
    try {
      const result = await window.electron.configureAI({});
      if (result.success) {
        commit('setApiKey', result.apiKey);
        commit('setApiUrl', result.apiUrl);
        commit('setModel', result.model);
        commit('setConfigured', result.isConfigured);
      }
    } catch (error) {
      logger.error('Error loading AI settings:', error);
    }
  },

  async clearHistory({ commit }) {
    try {
      await window.electron.clearChatHistory();
      commit('clearChatHistory');
    } catch (error) {
      logger.error('Error clearing chat history:', error);
    }
  },
};

// Mutations
const mutations = {
  addMessage(state, message) {
    state.chatHistory.push(message);
  },
  setChatHistory(state, chatHistory) {
    state.chatHistory = chatHistory;
  },
  setProcessing(state, isProcessing) {
    state.isProcessing = isProcessing;
  },
  clearChatHistory(state) {
    state.chatHistory = [];
  },
  setError(state, error) {
    state.error = error;
  },
  setConfigured(state, isConfigured) {
    state.isConfigured = isConfigured;
  },
  setApiKey(state, apiKey) {
    state.apiKey = apiKey;
  },
  setApiUrl(state, apiUrl) {
    state.apiUrl = apiUrl;
  },
  setModel(state, model) {
    state.model = model;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
