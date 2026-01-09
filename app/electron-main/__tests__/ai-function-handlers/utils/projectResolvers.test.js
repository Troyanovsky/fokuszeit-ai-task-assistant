/**
 * Tests for projectResolvers utility module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../services/project.js', () => ({
  default: {
    getProjects: vi.fn()
  }
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { resolveProjectId, resolveProjectIds } from '../../../ai-function-handlers/utils/projectResolvers.js';
import projectManager from '../../../services/project.js';

describe('projectResolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveProjectId', () => {
    it('returns UUID as-is when it contains hyphens', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = await resolveProjectId(uuid);

      expect(result).toBe(uuid);
      expect(projectManager.getProjects).not.toHaveBeenCalled();
    });

    it('looks up project by name and returns ID', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work Project' },
        { id: 'proj-2', name: 'Personal Project' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectId('work project');

      expect(result).toBe('proj-1');
      expect(projectManager.getProjects).toHaveBeenCalled();
    });

    it('is case-insensitive when matching project names', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work Project' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result1 = await resolveProjectId('WORK PROJECT');
      const result2 = await resolveProjectId('work project');
      const result3 = await resolveProjectId('Work Project');

      expect(result1).toBe('proj-1');
      expect(result2).toBe('proj-1');
      expect(result3).toBe('proj-1');
    });

    it('returns null when project name not found', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work Project' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectId('Nonexistent Project');

      expect(result).toBeNull();
    });

    it('returns null when no projects exist', async () => {
      projectManager.getProjects.mockResolvedValue([]);

      const result = await resolveProjectId('Any Project');

      expect(result).toBeNull();
    });

    it('handles exact name match', async () => {
      const projects = [
        { id: 'proj-1', name: 'My Project' },
        { id: 'proj-2', name: 'My Project 2' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectId('My Project');

      expect(result).toBe('proj-1');
    });
  });

  describe('resolveProjectIds', () => {
    it('resolves multiple project names to IDs', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work' },
        { id: 'proj-2', name: 'Personal' },
        { id: 'proj-3', name: 'Hobbies' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectIds(['work', 'personal']);

      expect(result).toEqual(['proj-1', 'proj-2']);
    });

    it('handles mix of names and UUIDs', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectIds(['work', '123e4567-e89b-12d3-a456-426614174000']);

      expect(result).toEqual(['proj-1', '123e4567-e89b-12d3-a456-426614174000']);
    });

    it('skips projects that cannot be resolved', async () => {
      const projects = [
        { id: 'proj-1', name: 'Work' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectIds(['work', 'nonexistent']);

      expect(result).toEqual(['proj-1']);
    });

    it('returns empty array when no projects resolved', async () => {
      projectManager.getProjects.mockResolvedValue([]);

      const result = await resolveProjectIds(['project1', 'project2']);

      expect(result).toEqual([]);
    });

    it('handles empty input array', async () => {
      const result = await resolveProjectIds([]);

      expect(result).toEqual([]);
      expect(projectManager.getProjects).not.toHaveBeenCalled();
    });

    it('preserves order of resolved IDs', async () => {
      const projects = [
        { id: 'proj-1', name: 'A' },
        { id: 'proj-2', name: 'B' },
        { id: 'proj-3', name: 'C' }
      ];
      projectManager.getProjects.mockResolvedValue(projects);

      const result = await resolveProjectIds(['c', 'a', 'b']);

      expect(result).toEqual(['proj-3', 'proj-1', 'proj-2']);
    });
  });
});
