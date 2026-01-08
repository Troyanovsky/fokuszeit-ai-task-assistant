import { ipcMain } from 'electron';
import Project from '../../shared/models/Project.js';
import projectManager from '../services/project.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for project CRUD operations.
 */
export function registerProjectHandlers() {
  ipcMain.handle('projects:getAll', async () => {
    try {
      return await projectManager.getProjects();
    } catch (error) {
      logger.logError(error, 'IPC Error - getProjects');
      return [];
    }
  });

  ipcMain.handle('projects:add', async (_, projectData) => {
    try {
      const project = new Project(projectData);
      return await projectManager.addProject(project);
    } catch (error) {
      logger.logError(error, 'IPC Error - addProject');
      return false;
    }
  });

  ipcMain.handle('projects:update', async (_, projectData) => {
    try {
      logger.debug('Received project update request:', projectData);
      const project = new Project(projectData);
      logger.debug('Created project instance:', project);
      const result = await projectManager.updateProject(project);
      logger.debug('Update result:', result);
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - updateProject');
      return false;
    }
  });

  ipcMain.handle('projects:delete', async (_, projectId) => {
    try {
      return await projectManager.deleteProject(projectId);
    } catch (error) {
      logger.logError(error, 'IPC Error - deleteProject');
      return false;
    }
  });
}
