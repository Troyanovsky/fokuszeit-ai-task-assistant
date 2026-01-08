import { describe, it, expect, vi, beforeEach } from 'vitest';
import databaseService from '../database.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import * as initialMigration from '../../../database/migrations/initial.js';

// Get a reference to the original insert method before any mocking
const originalInsert = databaseService.insert.bind(databaseService);
const originalQueryOne = databaseService.queryOne.bind(databaseService);

// Mock dependencies
vi.mock('better-sqlite3');
vi.mock('fs');
vi.mock('path');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));
vi.mock('../../../database/migrations/initial.js', () => ({
  up: vi.fn(),
}));

describe('DatabaseService', () => {
  const mockDirPath = '/mock/path';
  const mockDb = {
    pragma: vi.fn(),
    prepare: vi.fn(),
    close: vi.fn(),
    exec: vi.fn(),
    transaction: vi.fn(() => vi.fn()),
  };
  const mockStatement = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock path.join
    path.join.mockImplementation((...args) => args.join('/'));

    // Mock path.dirname
    path.dirname.mockReturnValue(mockDirPath);

    // Mock app.getPath
    app.getPath.mockReturnValue(mockDirPath);

    // Mock fs.existsSync
    fs.existsSync.mockReturnValue(false);

    // Mock fs.mkdirSync
    fs.mkdirSync.mockReturnValue(undefined);

    // Mock Database constructor
    Database.mockReturnValue(mockDb);

    // Mock prepare statement
    mockDb.prepare.mockReturnValue(mockStatement);

    // Reset the database service
    databaseService.db = null;
    databaseService.dbPath = '';
  });

  describe('init', () => {
    it('should initialize the database successfully', async () => {
      // Mock the migrations table query to return null (first run)
      databaseService.queryOne = vi.fn().mockReturnValue(null);
      databaseService.insert = vi.fn().mockReturnValue({ changes: 1 });
      // Mock pragma to return empty array (no columns exist initially)
      mockDb.pragma.mockReturnValue([]);

      const result = await databaseService.init();

      expect(app.getPath).toHaveBeenCalledWith('userData');
      expect(path.join).toHaveBeenCalledWith(mockDirPath, 'ai-task-assistant.db');
      expect(fs.existsSync).toHaveBeenCalledWith(mockDirPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockDirPath, { recursive: true });
      expect(Database).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
      expect(mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON');
      expect(result).toBe(true);
    });

    it('should not create directory if it already exists', async () => {
      // Mock the migrations table query to return null (first run)
      databaseService.queryOne = vi.fn().mockReturnValue(null);
      databaseService.insert = vi.fn().mockReturnValue({ changes: 1 });
      // Mock pragma to return empty array (no columns exist initially)
      mockDb.pragma.mockReturnValue([]);

      fs.existsSync.mockReturnValue(true);

      const result = await databaseService.init();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle initialization errors', async () => {
      Database.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await databaseService.init();

      expect(result).toBe(false);
    });
  });

  describe('runMigrations', () => {
    beforeEach(() => {
      // Restore original methods for these tests
      databaseService.queryOne = originalQueryOne;
      databaseService.insert = originalInsert;
    });

    it('should run migrations successfully', async () => {
      databaseService.db = mockDb;
      // Mock the migrations table query to return null (first run)
      databaseService.queryOne = vi.fn().mockReturnValue(null);
      databaseService.insert = vi.fn().mockReturnValue({ changes: 1 });
      // Mock db.exec to succeed
      mockDb.exec.mockReturnValue(undefined);
      // Mock pragma to return empty array (no columns exist initially)
      mockDb.pragma.mockReturnValue([]);
      // Mock initialMigration.up and notificationTrackingMigration.up to return true
      initialMigration.up.mockResolvedValue(true);

      const result = await databaseService.runMigrations();

      expect(result).toBe(true);
    });

    it('should handle migration errors', async () => {
      databaseService.db = mockDb;

      initialMigration.up.mockImplementation(() => {
        throw new Error('Migration error');
      });

      const result = await databaseService.runMigrations();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      databaseService.db = mockDb;

      databaseService.close();

      expect(mockDb.close).toHaveBeenCalled();
      expect(databaseService.db).toBeNull();
    });

    it('should do nothing if database is not initialized', () => {
      databaseService.db = null;

      databaseService.close();

      expect(mockDb.close).not.toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute a query successfully', () => {
      databaseService.db = mockDb;
      mockStatement.all.mockReturnValue([{ id: 1, name: 'Test' }]);

      const result = databaseService.query('SELECT * FROM test');

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM test');
      expect(mockStatement.all).toHaveBeenCalledWith({});
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should execute a query with parameters', () => {
      databaseService.db = mockDb;
      mockStatement.all.mockReturnValue([{ id: 1, name: 'Test' }]);

      const result = databaseService.query('SELECT * FROM test WHERE id = ?', [1]);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?');
      expect(mockStatement.all).toHaveBeenCalledWith([1]);
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should handle query errors', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Query error');
      });

      expect(() => {
        databaseService.query('SELECT * FROM test');
      }).toThrow(Error);
      expect(() => {
        databaseService.query('SELECT * FROM test');
      }).toThrow('Query error');
    });

    it('should handle query errors with specific error message', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Specific query error');
      });

      expect(() => {
        databaseService.query('SELECT * FROM test');
      }).toThrow(Error);
      expect(() => {
        databaseService.query('SELECT * FROM test');
      }).toThrow('Specific query error');
    });
  });

  describe('queryOne', () => {
    it('should execute a query and return the first result', () => {
      databaseService.db = mockDb;
      mockStatement.get.mockReturnValue({ id: 1, name: 'Test' });

      const result = databaseService.queryOne('SELECT * FROM test WHERE id = ?', [1]);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?');
      expect(mockStatement.get).toHaveBeenCalledWith([1]);
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should handle query errors', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Query error');
      });

      expect(() => {
        databaseService.queryOne('SELECT * FROM test WHERE id = ?', [1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.queryOne('SELECT * FROM test WHERE id = ?', [1]);
      }).toThrow('Query error');
    });

    it('should handle queryOne errors with specific error message', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Specific query error');
      });

      expect(() => {
        databaseService.queryOne('SELECT * FROM test WHERE id = ?', [1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.queryOne('SELECT * FROM test WHERE id = ?', [1]);
      }).toThrow('Specific query error');
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Restore the original insert method for these tests
      databaseService.insert = originalInsert;
    });

    it('should execute an insert query successfully', () => {
      databaseService.db = mockDb;
      mockStatement.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = databaseService.insert('INSERT INTO test (name) VALUES (?)', ['Test']);

      expect(mockDb.prepare).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)');
      expect(mockStatement.run).toHaveBeenCalledWith(['Test']);
      expect(result).toEqual({ changes: 1, lastInsertRowid: 1 });
    });

    it('should handle insert errors', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Insert error');
      });

      expect(() => {
        databaseService.insert('INSERT INTO test (name) VALUES (?)', ['Test']);
      }).toThrow(Error);
      expect(() => {
        databaseService.insert('INSERT INTO test (name) VALUES (?)', ['Test']);
      }).toThrow('Insert error');
    });

    it('should handle insert errors with specific error message', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Specific insert error');
      });

      expect(() => {
        databaseService.insert('INSERT INTO test (name) VALUES (?)', ['Test']);
      }).toThrow(Error);
      expect(() => {
        databaseService.insert('INSERT INTO test (name) VALUES (?)', ['Test']);
      }).toThrow('Specific insert error');
    });
  });

  describe('update', () => {
    it('should execute an update query successfully', () => {
      databaseService.db = mockDb;
      mockStatement.run.mockReturnValue({ changes: 1 });

      const result = databaseService.update('UPDATE test SET name = ? WHERE id = ?', [
        'New Name',
        1,
      ]);

      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE test SET name = ? WHERE id = ?');
      expect(mockStatement.run).toHaveBeenCalledWith(['New Name', 1]);
      expect(result).toEqual({ changes: 1 });
    });

    it('should handle update errors', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Update error');
      });

      expect(() => {
        databaseService.update('UPDATE test SET name = ? WHERE id = ?', ['New Name', 1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.update('UPDATE test SET name = ? WHERE id = ?', ['New Name', 1]);
      }).toThrow('Update error');
    });

    it('should handle update errors with specific error message', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Specific update error');
      });

      expect(() => {
        databaseService.update('UPDATE test SET name = ? WHERE id = ?', ['New Name', 1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.update('UPDATE test SET name = ? WHERE id = ?', ['New Name', 1]);
      }).toThrow('Specific update error');
    });
  });

  describe('delete', () => {
    it('should execute a delete query successfully', () => {
      databaseService.db = mockDb;
      mockStatement.run.mockReturnValue({ changes: 1 });

      const result = databaseService.delete('DELETE FROM test WHERE id = ?', [1]);

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM test WHERE id = ?');
      expect(mockStatement.run).toHaveBeenCalledWith([1]);
      expect(result).toEqual({ changes: 1 });
    });

    it('should handle delete errors', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Delete error');
      });

      expect(() => {
        databaseService.delete('DELETE FROM test WHERE id = ?', [1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.delete('DELETE FROM test WHERE id = ?', [1]);
      }).toThrow('Delete error');
    });

    it('should handle delete errors with specific error message', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Specific delete error');
      });

      expect(() => {
        databaseService.delete('DELETE FROM test WHERE id = ?', [1]);
      }).toThrow(Error);
      expect(() => {
        databaseService.delete('DELETE FROM test WHERE id = ?', [1]);
      }).toThrow('Specific delete error');
    });
  });

  describe('beginTransaction', () => {
    it('should begin a transaction', () => {
      databaseService.db = mockDb;

      const result = databaseService.beginTransaction();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(typeof result).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries', () => {
      databaseService.db = mockDb;
      mockStatement.all.mockReturnValue([]);

      const result = databaseService.query('');

      expect(mockDb.prepare).toHaveBeenCalledWith('');
      expect(mockStatement.all).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });

    it('should handle invalid SQL syntax', () => {
      databaseService.db = mockDb;
      mockDb.prepare.mockImplementation(() => {
        throw new Error('SQLITE_SYNTAX_ERROR');
      });

      expect(() => {
        databaseService.query('SELECT * FROM invalid_table');
      }).toThrow(Error);
      expect(() => {
        databaseService.query('SELECT * FROM invalid_table');
      }).toThrow('SQLITE_SYNTAX_ERROR');
    });

    it('should handle large data sets', () => {
      databaseService.db = mockDb;
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      mockStatement.all.mockReturnValue(largeDataSet);

      const result = databaseService.query('SELECT * FROM test');

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM test');
      expect(mockStatement.all).toHaveBeenCalledWith({});
      expect(result).toEqual(largeDataSet);
    });
  });
});
