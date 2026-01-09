/**
 * Project handlers for AI function calls.
 * Handles all project-related operations (CRUD).
 */

import Project from '../../shared/models/Project.js';
import projectManager from '../services/project.js';
import { buildProjectResponse } from './utils/responseFormatters.js';

/**
 * Handle addProject function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleAddProject(args, baseResult) {
  const project = new Project(args);
  await projectManager.addProject(project);
  return buildProjectResponse(
    baseResult,
    true,
    project,
    `Project "${args.name}" has been created with ID: ${project.id}.`
  );
}

/**
 * Handle getProjects function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleGetProjects(args, baseResult) {
  const projects = await projectManager.getProjects();
  const projectIds = projects.map(project => project.id);
  return {
    ...baseResult,
    success: true,
    projects,
    projectIds,
    message: `Found ${projects.length} projects.`
  };
}

/**
 * Handle updateProject function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleUpdateProject(args, baseResult) {
  const updatedProject = new Project(args);
  const updateProjectResult = await projectManager.updateProject(updatedProject);
  return {
    ...baseResult,
    success: updateProjectResult,
    projectId: updatedProject.id,
    message: updateProjectResult
      ? `Project "${args.name}" (ID: ${updatedProject.id}) has been updated.`
      : `Failed to update project "${args.name}" (ID: ${updatedProject.id}).`
  };
}

/**
 * Handle deleteProject function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleDeleteProject(args, baseResult) {
  const deleteProjectResult = await projectManager.deleteProject(args.id);
  return {
    ...baseResult,
    success: deleteProjectResult,
    projectId: args.id,
    message: deleteProjectResult
      ? `Project with ID ${args.id} has been deleted.`
      : `Failed to delete project with ID ${args.id}.`
  };
}
