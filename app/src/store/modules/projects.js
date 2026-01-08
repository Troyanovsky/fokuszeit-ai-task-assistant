// Import Project model - handle both ES modules and CommonJS modules
import ProjectModule from '../../../shared/models/Project';
import logger from '../../services/logger';

const Project = ProjectModule.default || ProjectModule;

// Initial state
const state = {
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
};

// Getters
const getters = {
  allProjects: (state) => state.projects,
  selectedProject: (state) => state.selectedProject,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

// Actions
const actions = {
  async fetchProjects({ commit }) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      // For now, we'll use a placeholder that will be replaced with actual IPC calls
      const projectsData = window.electron ? await window.electron.getProjects() : [];
      const projects = projectsData.map((data) => new Project(data));

      commit('setProjects', projects);
    } catch (error) {
      logger.error('Error fetching projects:', error);
      commit('setError', 'Failed to load projects');
    } finally {
      commit('setLoading', false);
    }
  },

  selectProject({ commit }, project) {
    commit('setSelectedProject', project);
  },

  async addProject({ commit, dispatch }, projectData) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      const project = new Project(projectData);

      // In Electron, we would use IPC to communicate with the main process
      const success = window.electron
        ? await window.electron.addProject(project.toDatabase())
        : false;

      if (success) {
        // Refresh the projects list
        dispatch('fetchProjects');
      } else {
        commit('setError', 'Failed to add project');
      }
    } catch (error) {
      logger.error('Error adding project:', error);
      commit('setError', 'Failed to add project');
    } finally {
      commit('setLoading', false);
    }
  },

  async updateProject({ commit, dispatch }, project) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      // Make sure we're passing the correct data format
      const projectData = project.toDatabase ? project.toDatabase() : project;
      const success = window.electron ? await window.electron.updateProject(projectData) : false;

      if (success) {
        // Refresh the projects list
        dispatch('fetchProjects');
      } else {
        commit('setError', 'Failed to update project');
      }
    } catch (error) {
      logger.error('Error updating project:', error);
      commit('setError', 'Failed to update project');
    } finally {
      commit('setLoading', false);
    }
  },

  async deleteProject({ commit, dispatch, state }, projectId) {
    commit('setLoading', true);
    commit('setError', null);

    try {
      // In Electron, we would use IPC to communicate with the main process
      const success = window.electron ? await window.electron.deleteProject(projectId) : false;

      if (success) {
        // If the deleted project was selected, deselect it
        if (state.selectedProject && state.selectedProject.id === projectId) {
          commit('setSelectedProject', null);
        }

        // Refresh the projects list
        dispatch('fetchProjects');
      } else {
        commit('setError', 'Failed to delete project');
      }
    } catch (error) {
      logger.error('Error deleting project:', error);
      commit('setError', 'Failed to delete project');
    } finally {
      commit('setLoading', false);
    }
  },

  // Watcher for real-time updates
  watchProjects({ dispatch }) {
    // In a real implementation, this would set up a listener
    // for database changes or server-sent events

    // For now, just set up a polling mechanism for demo purposes
    const pollInterval = 30000; // 30 seconds

    setInterval(() => {
      dispatch('fetchProjects');
    }, pollInterval);
  },
};

// Mutations
const mutations = {
  setProjects(state, projects) {
    state.projects = projects;
  },
  setSelectedProject(state, project) {
    state.selectedProject = project;
  },
  setLoading(state, loading) {
    state.loading = loading;
  },
  setError(state, error) {
    state.error = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
