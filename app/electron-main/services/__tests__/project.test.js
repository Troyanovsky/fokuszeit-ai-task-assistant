import { describe, it, expect, vi, beforeEach } from 'vitest';
import projectManager from '../project.js';
import databaseService from '../database.js';
import Project from '../../../shared/models/Project.js';

// Mock the database service
vi.mock('../database.js', () => ({
  default: {
    query: vi.fn(),
    queryOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the Project model
vi.mock('../../../shared/models/Project.js', () => {
  const MockProject = function (data = {}) {
    // Initialize properties
    this.id = data.id || 'mock-id';
    this.name = data.name || '';
    this.description = data.description || '';
    this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
    this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();

    // Add methods
    this.validate = vi.fn(() => {
      // Basic validation logic
      return (
        !!this.name &&
        this.name.trim() !== '' &&
        this.name.length <= 255 &&
        (!this.description || this.description.length <= 255)
      );
    });

    this.toDatabase = vi.fn(() => {
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        created_at: this.createdAt.toISOString(),
        updated_at: this.updatedAt.toISOString(),
      };
    });
  };

  MockProject.fromDatabase = vi.fn((data) => new MockProject(data));

  return {
    default: MockProject,
  };
});

describe('ProjectManager', () => {
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

  const mockProject = {
    id: 'project-3',
    name: 'Project 3',
    description: 'Description 3',
    created_at: '2023-01-03T00:00:00.000Z',
    updated_at: '2023-01-03T00:00:00.000Z',
    validate: () => true,
    toDatabase: () => ({
      id: 'project-3',
      name: 'Project 3',
      description: 'Description 3',
      created_at: '2023-01-03T00:00:00.000Z',
      updated_at: '2023-01-03T00:00:00.000Z',
    }),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getProjects', () => {
    it('should return an array of projects', async () => {
      databaseService.query.mockReturnValue(mockProjects);
      Project.fromDatabase.mockImplementation((data) => ({
        ...data,
        validate: () => true,
        toDatabase: () => data,
      }));

      const result = await projectManager.getProjects();

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM projects ORDER BY created_at DESC'
      );
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('project-1');
      expect(result[1].id).toBe('project-2');
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.getProjects();

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    it('should return a project when found', async () => {
      databaseService.queryOne.mockReturnValue(mockProjects[0]);
      Project.fromDatabase.mockImplementation((data) => ({
        ...data,
        validate: () => true,
        toDatabase: () => data,
      }));

      const result = await projectManager.getProjectById('project-1');

      expect(databaseService.queryOne).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?', [
        'project-1',
      ]);
      expect(result.id).toBe('project-1');
    });

    it('should return null when project is not found', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await projectManager.getProjectById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null if there is an error', async () => {
      databaseService.queryOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.getProjectById('project-1');

      expect(result).toBeNull();
    });
  });

  describe('addProject', () => {
    it('should add a project successfully', async () => {
      databaseService.insert.mockReturnValue({ changes: 1 });

      const result = await projectManager.addProject(mockProject);

      expect(databaseService.insert).toHaveBeenCalledWith(
        'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [
          mockProject.id,
          mockProject.name,
          mockProject.description,
          mockProject.created_at,
          mockProject.updated_at,
        ]
      );
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      const invalidProject = {
        ...mockProject,
        validate: () => false,
      };

      const result = await projectManager.addProject(invalidProject);

      expect(databaseService.insert).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if there is an error', async () => {
      databaseService.insert.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.addProject(mockProject);

      expect(result).toBe(false);
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      databaseService.update.mockReturnValue({ changes: 1 });

      const result = await projectManager.updateProject(mockProject);

      expect(databaseService.update).toHaveBeenCalledWith(
        'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        [mockProject.name, mockProject.description, mockProject.updated_at, mockProject.id]
      );
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      const invalidProject = {
        ...mockProject,
        validate: () => false,
      };

      const result = await projectManager.updateProject(invalidProject);

      expect(databaseService.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if there is an error', async () => {
      databaseService.update.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.updateProject(mockProject);

      expect(result).toBe(false);
    });
  });

  describe('validateProjectDeletion', () => {
    it('should validate project deletion successfully', async () => {
      // Mock project exists
      databaseService.queryOne.mockReturnValue(mockProject);

      // Mock tasks for the project
      const mockTasks = [
        { id: 'task-1', name: 'Task 1', status: 'planning' },
        { id: 'task-2', name: 'Task 2', status: 'doing' },
        { id: 'task-3', name: 'Task 3', status: 'done' },
      ];

      // Mock the task manager import and method
      const mockTaskManager = {
        getTasksByProject: vi.fn().mockResolvedValue(mockTasks),
      };

      // Mock dynamic import
      vi.doMock('../task.js', () => ({ default: mockTaskManager }));

      const result = await projectManager.validateProjectDeletion('project-1');

      expect(result.canDelete).toBe(true);
      expect(result.details.taskCounts.total).toBe(3);
      expect(result.details.taskCounts.planning).toBe(1);
      expect(result.details.taskCounts.doing).toBe(1);
      expect(result.details.taskCounts.done).toBe(1);
    });

    it('should return false for non-existent project', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await projectManager.validateProjectDeletion('non-existent');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Project not found');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project and all associated tasks successfully', async () => {
      // Mock project exists
      databaseService.queryOne.mockReturnValue(mockProject);

      // Mock tasks for the project
      const mockTasks = [
        { id: 'task-1', name: 'Task 1', status: 'planning' },
        { id: 'task-2', name: 'Task 2', status: 'doing' },
      ];

      // Mock the task manager
      const mockTaskManager = {
        getTasksByProject: vi.fn().mockResolvedValue(mockTasks),
        deleteTask: vi.fn().mockResolvedValue(true),
      };

      // Mock dynamic import
      vi.doMock('../task.js', () => ({ default: mockTaskManager }));

      // Mock project deletion
      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await projectManager.deleteProject('project-1');

      // Verify tasks were deleted
      expect(mockTaskManager.getTasksByProject).toHaveBeenCalledWith('project-1');
      expect(mockTaskManager.deleteTask).toHaveBeenCalledWith('task-1');
      expect(mockTaskManager.deleteTask).toHaveBeenCalledWith('task-2');

      // Verify project was deleted
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);
      expect(result).toBe(true);
    });

    it('should force delete without validation when force=true', async () => {
      // Mock project exists
      databaseService.queryOne.mockReturnValue(mockProject);

      // Mock no tasks
      const mockTaskManager = {
        getTasksByProject: vi.fn().mockResolvedValue([]),
      };

      vi.doMock('../task.js', () => ({ default: mockTaskManager }));

      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await projectManager.deleteProject('project-1', true);

      expect(result).toBe(true);
    });

    it('should continue with project deletion even if some tasks fail to delete', async () => {
      // Mock project exists
      databaseService.queryOne.mockReturnValue(mockProject);

      const mockTasks = [
        { id: 'task-1', name: 'Task 1', status: 'planning' },
        { id: 'task-2', name: 'Task 2', status: 'doing' },
      ];

      const mockTaskManager = {
        getTasksByProject: vi.fn().mockResolvedValue(mockTasks),
        deleteTask: vi
          .fn()
          .mockResolvedValueOnce(true) // First task succeeds
          .mockResolvedValueOnce(false), // Second task fails
      };

      vi.doMock('../task.js', () => ({ default: mockTaskManager }));

      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await projectManager.deleteProject('project-1');

      expect(mockTaskManager.deleteTask).toHaveBeenCalledTimes(2);
      expect(result).toBe(true); // Should still succeed
    });

    it('should return false if there is an error', async () => {
      databaseService.queryOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.deleteProject('project-1');

      expect(result).toBe(false);
    });
  });

  describe('getProjectCount', () => {
    it('should return the correct project count', async () => {
      databaseService.queryOne.mockReturnValue({ count: 5 });

      const result = await projectManager.getProjectCount();

      expect(databaseService.queryOne).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM projects'
      );
      expect(result).toBe(5);
    });

    it('should return 0 if no result is returned', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await projectManager.getProjectCount();

      expect(result).toBe(0);
    });

    it('should return 0 if there is an error', async () => {
      databaseService.queryOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.getProjectCount();

      expect(result).toBe(0);
    });
  });

  describe('searchProjects', () => {
    it('should return projects matching the search query', async () => {
      databaseService.query.mockReturnValue(mockProjects);
      Project.fromDatabase.mockImplementation((data) => ({
        ...data,
        validate: () => true,
        toDatabase: () => data,
      }));

      const result = await projectManager.searchProjects('Project');

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE name LIKE ? ORDER BY created_at DESC',
        ['%Project%']
      );
      expect(result.length).toBe(2);
    });

    it('should return an empty array if there is an error', async () => {
      databaseService.query.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectManager.searchProjects('Project');

      expect(result).toEqual([]);
    });
  });

  describe('Project Validation', () => {
    it('should return true for valid project data', async () => {
      const validProject = new Project({
        id: 'project-1',
        name: 'Valid Project',
        description: 'Valid Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      expect(validProject.validate()).toBe(true);
    });

    it('should return false for invalid project data (missing name)', async () => {
      const invalidProject = new Project({
        id: 'project-1',
        description: 'Valid Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      expect(invalidProject.validate()).toBe(false);
    });
  });

  describe('Data Conversion', () => {
    it('should correctly convert data from the database format to the Project model format', () => {
      const dbData = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const project = Project.fromDatabase(dbData);

      expect(project.id).toBe(dbData.id);
      expect(project.name).toBe(dbData.name);
      expect(project.description).toBe(dbData.description);
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should correctly convert data from the Project model format to the database format', () => {
      const project = new Project({
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      const dbData = project.toDatabase();

      expect(dbData.id).toBe(project.id);
      expect(dbData.name).toBe(project.name);
      expect(dbData.description).toBe(project.description);
      expect(dbData.created_at).toBe(project.createdAt.toISOString());
      expect(dbData.updated_at).toBe(project.updatedAt.toISOString());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project names and descriptions', async () => {
      const project = new Project({
        id: 'project-1',
        name: '',
        description: '',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      expect(project.validate()).toBe(false);
    });

    it('should handle very long project names and descriptions', async () => {
      const longString = 'a'.repeat(256); // Exceeds the typical database column limit

      const project = new Project({
        id: 'project-1',
        name: longString,
        description: longString,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      expect(project.validate()).toBe(false);
    });

    it('should prevent SQL injection in the searchProjects method', async () => {
      const maliciousQuery = "'; DROP TABLE projects; --";

      await projectManager.searchProjects(maliciousQuery);

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE name LIKE ? ORDER BY created_at DESC',
        [`%${maliciousQuery}%`]
      );
    });
  });

  describe('SQLite Error Handling', () => {
    describe('getProjects', () => {
      it('should handle SQLITE_BUSY database errors', async () => {
        const busyError = new Error('Database is locked');
        busyError.code = 'SQLITE_BUSY';
        databaseService.query.mockImplementation(() => {
          throw busyError;
        });

        const result = await projectManager.getProjects();

        expect(result).toEqual([]);
        expect(databaseService.query).toHaveBeenCalled();
      });

      it('should handle SQLITE_CORRUPT database errors', async () => {
        const corruptError = new Error('Database disk image is malformed');
        corruptError.code = 'SQLITE_CORRUPT';
        databaseService.query.mockImplementation(() => {
          throw corruptError;
        });

        const result = await projectManager.getProjects();

        expect(result).toEqual([]);
        expect(databaseService.query).toHaveBeenCalled();
      });

      it('should handle SQLITE_IOERR database errors', async () => {
        const ioError = new Error('Disk I/O error');
        ioError.code = 'SQLITE_IOERR';
        databaseService.query.mockImplementation(() => {
          throw ioError;
        });

        const result = await projectManager.getProjects();

        expect(result).toEqual([]);
        expect(databaseService.query).toHaveBeenCalled();
      });
    });

    describe('getProjectById', () => {
      it('should handle SQLITE_CANTOPEN database errors', async () => {
        const cantOpenError = new Error('Cannot open database file');
        cantOpenError.code = 'SQLITE_CANTOPEN';
        databaseService.queryOne.mockImplementation(() => {
          throw cantOpenError;
        });

        const result = await projectManager.getProjectById('project-1');

        expect(result).toBeNull();
        expect(databaseService.queryOne).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?', [
          'project-1',
        ]);
      });

      it('should handle SQLITE_READONLY database errors', async () => {
        const readOnlyError = new Error('Database file is read-only');
        readOnlyError.code = 'SQLITE_READONLY';
        databaseService.queryOne.mockImplementation(() => {
          throw readOnlyError;
        });

        const result = await projectManager.getProjectById('project-1');

        expect(result).toBeNull();
        expect(databaseService.queryOne).toHaveBeenCalled();
      });
    });

    describe('addProject', () => {
      it('should handle SQLITE_CONSTRAINT_UNIQUE for duplicate project IDs', async () => {
        const constraintError = new Error('UNIQUE constraint failed: projects.id');
        constraintError.code = 'SQLITE_CONSTRAINT_UNIQUE';
        databaseService.insert.mockImplementation(() => {
          throw constraintError;
        });

        const result = await projectManager.addProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.insert).toHaveBeenCalled();
      });

      it('should handle SQLITE_CONSTRAINT_NOTNULL for missing required fields', async () => {
        const notNullError = new Error('NOT NULL constraint failed: projects.name');
        notNullError.code = 'SQLITE_CONSTRAINT_NOTNULL';
        databaseService.insert.mockImplementation(() => {
          throw notNullError;
        });

        const result = await projectManager.addProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.insert).toHaveBeenCalled();
      });

      it('should handle SQLITE_CONSTRAINT_FOREIGNKEY for invalid references', async () => {
        const fkError = new Error('FOREIGN KEY constraint failed');
        fkError.code = 'SQLITE_CONSTRAINT_FOREIGNKEY';
        databaseService.insert.mockImplementation(() => {
          throw fkError;
        });

        const result = await projectManager.addProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.insert).toHaveBeenCalled();
      });

      it('should handle SQLITE_FULL database errors', async () => {
        const fullError = new Error('Database is full');
        fullError.code = 'SQLITE_FULL';
        databaseService.insert.mockImplementation(() => {
          throw fullError;
        });

        const result = await projectManager.addProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.insert).toHaveBeenCalled();
      });

      it('should handle SQLITE_TOOBIG for data size errors', async () => {
        const tooBigError = new Error('String or blob too big');
        tooBigError.code = 'SQLITE_TOOBIG';
        databaseService.insert.mockImplementation(() => {
          throw tooBigError;
        });

        const result = await projectManager.addProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.insert).toHaveBeenCalled();
      });
    });

    describe('updateProject', () => {
      it('should handle SQLITE_CONSTRAINT errors on update', async () => {
        const constraintError = new Error('Constraint violation');
        constraintError.code = 'SQLITE_CONSTRAINT';
        databaseService.update.mockImplementation(() => {
          throw constraintError;
        });

        const result = await projectManager.updateProject(mockProject);

        expect(result).toBe(false);
        expect(databaseService.update).toHaveBeenCalled();
      });
    });

    describe('searchProjects', () => {
      it('should handle database errors during search', async () => {
        const searchError = new Error('Search failed');
        searchError.code = 'SQLITE_ERROR';
        databaseService.query.mockImplementation(() => {
          throw searchError;
        });

        const result = await projectManager.searchProjects('test');

        expect(result).toEqual([]);
        expect(databaseService.query).toHaveBeenCalled();
      });
    });

    describe('getProjectCount', () => {
      it('should handle database errors when counting', async () => {
        const countError = new Error('Count failed');
        countError.code = 'SQLITE_ERROR';
        databaseService.queryOne.mockImplementation(() => {
          throw countError;
        });

        const result = await projectManager.getProjectCount();

        expect(result).toBe(0);
        expect(databaseService.queryOne).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM projects'
        );
      });
    });
  });

  describe('Error Context Logging', () => {
    it('should include project ID in error logs for getProjectById', async () => {
      const error = new Error('Database error');
      databaseService.queryOne.mockImplementation(() => {
        throw error;
      });

      await projectManager.getProjectById('test-project-id');

      expect(databaseService.queryOne).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?', [
        'test-project-id',
      ]);
    });

    it('should include project name in error logs for addProject', async () => {
      const error = new Error('Insert failed');
      databaseService.insert.mockImplementation(() => {
        throw error;
      });

      await projectManager.addProject(mockProject);

      expect(databaseService.insert).toHaveBeenCalled();
    });

    it('should include search query in error logs for searchProjects', async () => {
      const error = new Error('Search failed');
      databaseService.query.mockImplementation(() => {
        throw error;
      });

      await projectManager.searchProjects('test search');

      expect(databaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE name LIKE ? ORDER BY created_at DESC',
        ['%test search%']
      );
    });
  });

  describe('Error Recovery', () => {
    it('should continue with project deletion even if some tasks fail to delete', async () => {
      // Mock project exists
      databaseService.queryOne.mockReturnValue(mockProject);

      const mockTasks = [
        { id: 'task-1', name: 'Task 1', status: 'planning' },
        { id: 'task-2', name: 'Task 2', status: 'doing' },
      ];

      const mockTaskManager = {
        getTasksByProject: vi.fn().mockResolvedValue(mockTasks),
        deleteTask: vi
          .fn()
          .mockResolvedValueOnce(true) // First task succeeds
          .mockResolvedValueOnce(false), // Second task fails
      };

      vi.doMock('../task.js', () => ({ default: mockTaskManager }));

      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await projectManager.deleteProject('project-1');

      expect(result).toBe(true); // Should still succeed
      expect(mockTaskManager.deleteTask).toHaveBeenCalledTimes(2);
    });

    it('should validate project deletion returns proper reason for non-existent projects', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await projectManager.validateProjectDeletion('non-existent');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Project not found');
    });
  });
});
