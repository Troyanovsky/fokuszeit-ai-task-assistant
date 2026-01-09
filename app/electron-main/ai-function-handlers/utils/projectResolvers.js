/**
 * Project ID/name resolution utilities for AI function handlers.
 * Handles conversion between project names and IDs.
 */

import logger from '../../logger.js';
import projectManager from '../../services/project.js';

/**
 * Resolve a project ID from a name or ID.
 * @param {string} projectId - Project ID or name
 * @returns {Promise<string|null>} - Resolved project ID or null if not found
 */
export async function resolveProjectId(projectId) {
  // If it's already a UUID format (contains hyphens), return it as is
  if (typeof projectId === 'string' && projectId.includes('-')) {
    return projectId;
  }

  // It's likely a project name, look up the project by name
  logger.info(`Looking up project ID for project name: ${projectId}`);
  const projects = await projectManager.getProjects();
  const project = projects.find(p => p.name.toLowerCase() === projectId.toLowerCase());

  if (project) {
    logger.info(`Found project ID ${project.id} for name: ${projectId}`);
    return project.id;
  }

  logger.info(`No project found for name: ${projectId}`);
  return null;
}

/**
 * Resolve multiple project IDs from names or IDs.
 * @param {string[]} projectIds - Array of project IDs or names
 * @returns {Promise<string[]>} - Array of resolved project IDs
 */
export async function resolveProjectIds(projectIds) {
  const resolvedIds = [];

  for (const projectId of projectIds) {
    const resolvedId = await resolveProjectId(projectId);
    if (resolvedId) {
      resolvedIds.push(resolvedId);
    }
  }

  return resolvedIds;
}
