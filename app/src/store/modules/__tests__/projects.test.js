import { describe, it, expect, vi, beforeEach } from 'vitest';
import projectsModule from '../projects.js';

// Mock window object
vi.stubGlobal('window', {
  electron: {
    getProjects: vi.fn(),
    addProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
});

// Mock Project model
vi.mock('../../../models/Project', () => {
  const MockProject = function (data) {
    Object.assign(this, data);

    this.toDatabase = vi.fn(() => ({
      id: this.id || 'project-123',
      name: this.name || 'Project Name',
      description: this.description || 'Project Description',
      created_at: this.created_at || '2023-01-01T00:00:00.000Z',
      updated_at: this.updated_at || '2023-01-01T00:00:00.000Z',
    }));
  };

  return {
    default: MockProject,
  };
});

describe('Projects Store Module', () => {
  // Mock projects data
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Project 1',
      description: 'Description 1',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'project-2',
      name: 'Project 2',
      description: 'Description 2',
      created_at: '2023-01-02T00:00:00.000Z',
      updated_at: '2023-01-02T00:00:00.000Z',
    },
  ];

  // Helper to create a mock commit function
  const createCommit = () => vi.fn();

  // Helper to create a mock dispatch function
  const createDispatch = () => vi.fn();

  // Helper to create mock state
  const createState = () => ({
    projects: [],
    selectedProject: null,
    loading: false,
    error: null,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Getters', () => {
    it('allProjects should return all projects', () => {
      const state = {
        projects: mockProjects,
      };

      const result = projectsModule.getters.allProjects(state);

      expect(result).toEqual(mockProjects);
    });

    it('selectedProject should return the selected project', () => {
      const state = {
        selectedProject: mockProjects[0],
      };

      const result = projectsModule.getters.selectedProject(state);

      expect(result).toEqual(mockProjects[0]);
    });

    it('isLoading should return the loading state', () => {
      const state = {
        loading: true,
      };

      const result = projectsModule.getters.isLoading(state);

      expect(result).toBe(true);
    });

    it('error should return the error state', () => {
      const state = {
        error: 'Test error',
      };

      const result = projectsModule.getters.error(state);

      expect(result).toBe('Test error');
    });
  });

  describe('Actions', () => {
    describe('fetchProjects', () => {
      it('should fetch projects successfully', async () => {
        const commit = createCommit();
        window.electron.getProjects.mockResolvedValue(mockProjects);

        await projectsModule.actions.fetchProjects({ commit });

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.getProjects).toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setProjects', expect.any(Array));
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when fetching projects', async () => {
        const commit = createCommit();
        window.electron.getProjects.mockRejectedValue(new Error('API error'));

        await projectsModule.actions.fetchProjects({ commit });

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to load projects');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('selectProject', () => {
      it('should select a project', async () => {
        const commit = createCommit();
        const project = mockProjects[0];

        await projectsModule.actions.selectProject({ commit }, project);

        expect(commit).toHaveBeenCalledWith('setSelectedProject', project);
      });
    });

    describe('addProject', () => {
      it('should add a project successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addProject.mockResolvedValue(true);

        const projectData = {
          name: 'New Project',
          description: 'New Project Description',
        };

        await projectsModule.actions.addProject({ commit, dispatch }, projectData);

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.addProject).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith('fetchProjects');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when adding a project', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addProject.mockResolvedValue(false);

        const projectData = {
          name: 'New Project',
          description: 'New Project Description',
        };

        await projectsModule.actions.addProject({ commit, dispatch }, projectData);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to add project');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle exceptions when adding a project', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.addProject.mockRejectedValue(new Error('API error'));

        const projectData = {
          name: 'New Project',
          description: 'New Project Description',
        };

        await projectsModule.actions.addProject({ commit, dispatch }, projectData);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to add project');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('updateProject', () => {
      it('should update a project successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateProject.mockResolvedValue(true);

        const project = {
          id: 'project-1',
          name: 'Updated Project',
          description: 'Updated Description',
          toDatabase: () => ({
            id: 'project-1',
            name: 'Updated Project',
            description: 'Updated Description',
          }),
        };

        await projectsModule.actions.updateProject({ commit, dispatch }, project);

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.updateProject).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith('fetchProjects');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should handle errors when updating a project', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        window.electron.updateProject.mockResolvedValue(false);

        const project = {
          id: 'project-1',
          name: 'Updated Project',
          description: 'Updated Description',
          toDatabase: () => ({
            id: 'project-1',
            name: 'Updated Project',
            description: 'Updated Description',
          }),
        };

        await projectsModule.actions.updateProject({ commit, dispatch }, project);

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to update project');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });

    describe('deleteProject', () => {
      it('should delete a project successfully', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        const state = {
          selectedProject: { id: 'project-1' },
        };
        window.electron.deleteProject.mockResolvedValue(true);

        await projectsModule.actions.deleteProject({ commit, dispatch, state }, 'project-1');

        expect(commit).toHaveBeenCalledWith('setLoading', true);
        expect(commit).toHaveBeenCalledWith('setError', null);
        expect(window.electron.deleteProject).toHaveBeenCalledWith('project-1');
        expect(commit).toHaveBeenCalledWith('setSelectedProject', null);
        expect(dispatch).toHaveBeenCalledWith('fetchProjects');
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });

      it('should not deselect project if different project is selected', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        const state = {
          selectedProject: { id: 'project-2' },
        };
        window.electron.deleteProject.mockResolvedValue(true);

        await projectsModule.actions.deleteProject({ commit, dispatch, state }, 'project-1');

        expect(commit).not.toHaveBeenCalledWith('setSelectedProject', null);
        expect(dispatch).toHaveBeenCalledWith('fetchProjects');
      });

      it('should handle errors when deleting a project', async () => {
        const commit = createCommit();
        const dispatch = createDispatch();
        const state = createState();
        window.electron.deleteProject.mockResolvedValue(false);

        await projectsModule.actions.deleteProject({ commit, dispatch, state }, 'project-1');

        expect(commit).toHaveBeenCalledWith('setError', 'Failed to delete project');
        expect(dispatch).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith('setLoading', false);
      });
    });
  });

  describe('Mutations', () => {
    it('setProjects should update projects state', () => {
      const state = createState();

      projectsModule.mutations.setProjects(state, mockProjects);

      expect(state.projects).toEqual(mockProjects);
    });

    it('setSelectedProject should update selectedProject state', () => {
      const state = createState();

      projectsModule.mutations.setSelectedProject(state, mockProjects[0]);

      expect(state.selectedProject).toEqual(mockProjects[0]);
    });

    it('setLoading should update loading state', () => {
      const state = createState();

      projectsModule.mutations.setLoading(state, true);

      expect(state.loading).toBe(true);
    });

    it('setError should update error state', () => {
      const state = createState();

      projectsModule.mutations.setError(state, 'Test error');

      expect(state.error).toBe('Test error');
    });
  });
});
