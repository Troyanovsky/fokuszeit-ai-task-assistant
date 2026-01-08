/**
 * Project Model
 */

import { v4 as uuidv4 } from 'uuid';

class Project {
  /**
   * Create a new Project instance
   * @param {Object} data - Project data
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.description = data.description || '';
    this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
    this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
  }

  /**
   * Validate the project data
   * @returns {boolean} - Validation result
   */
  validate() {
    if (!this.name || this.name.trim() === '') {
      return false;
    }
    return true;
  }

  /**
   * Convert the project instance to a database-ready object
   * @returns {Object} - Database object
   */
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    };
  }

  /**
   * Create a Project instance from a database object
   * @param {Object} data - Database object
   * @returns {Project} - Project instance
   */
  static fromDatabase(data) {
    return new Project(data);
  }

  /**
   * Update project properties
   * @param {Object} data - Updated data
   */
  update(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    this.updatedAt = new Date();
  }
}

export default Project;
