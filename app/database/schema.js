/**
 * Database schema for AI Task Assistant
 */

const schema = {
  projects: `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  
  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      duration INTEGER,
      due_date TEXT,
      planned_time TEXT,
      project_id TEXT NOT NULL,
      dependencies TEXT,
      status TEXT NOT NULL,
      labels TEXT,
      priority TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
  `,
  
  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    )
  `,
  
  recurrence_rules: `
    CREATE TABLE IF NOT EXISTS recurrence_rules (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      frequency TEXT NOT NULL,
      interval INTEGER NOT NULL,
      end_date TEXT,
      count INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    )
  `
};

export default schema;