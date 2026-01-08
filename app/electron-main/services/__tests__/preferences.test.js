import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import preferencesService from '../preferences';

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: class Store {
      constructor() {
        this.store = {};
        this.defaults = {
          workingHours: {
            startTime: '10:00',
            endTime: '19:00',
          },
          bufferTime: 10,
        };
      }

      get(key) {
        const keys = key.split('.');
        let value = this.store;

        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            // Return from defaults if not found
            const defaultValue = this._getDefault(key);
            return defaultValue;
          }
        }

        return value;
      }

      set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let obj = this.store;

        for (const k of keys) {
          if (!(k in obj)) {
            obj[k] = {};
          }
          obj = obj[k];
        }

        obj[lastKey] = value;
      }

      _getDefault(key) {
        const keys = key.split('.');
        let value = this.defaults;

        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            return undefined;
          }
        }

        return value;
      }
    },
  };
});

// Mock logger
vi.mock('../../logger.js', () => ({
  default: {
    logError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Preferences Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return default preferences when not set', () => {
      const preferences = preferencesService.getPreferences();

      expect(preferences).toEqual({
        workingHours: {
          startTime: '10:00',
          endTime: '19:00',
        },
        bufferTime: 10,
      });
    });
  });

  describe('updateWorkingHours', () => {
    it('should update working hours with valid data', () => {
      const workingHours = {
        startTime: '09:00',
        endTime: '17:00',
      };

      const result = preferencesService.updateWorkingHours(workingHours);

      expect(result).toBe(true);

      // Verify the preferences were updated
      const preferences = preferencesService.getPreferences();
      expect(preferences.workingHours).toEqual(workingHours);
    });

    it('should reject invalid time format', () => {
      const workingHours = {
        startTime: 'invalid',
        endTime: '17:00',
      };

      const result = preferencesService.updateWorkingHours(workingHours);

      expect(result).toBe(false);
    });

    it('should reject invalid object format', () => {
      const result = preferencesService.updateWorkingHours('not an object');

      expect(result).toBe(false);
    });
  });

  describe('updateBufferTime', () => {
    it('should update buffer time with valid value', () => {
      const result = preferencesService.updateBufferTime(15);

      expect(result).toBe(true);

      // Verify the preferences were updated
      const preferences = preferencesService.getPreferences();
      expect(preferences.bufferTime).toBe(15);
    });

    it('should accept minimum value (0)', () => {
      const result = preferencesService.updateBufferTime(0);

      expect(result).toBe(true);

      const preferences = preferencesService.getPreferences();
      expect(preferences.bufferTime).toBe(0);
    });

    it('should accept maximum value (120)', () => {
      const result = preferencesService.updateBufferTime(120);

      expect(result).toBe(true);

      const preferences = preferencesService.getPreferences();
      expect(preferences.bufferTime).toBe(120);
    });

    it('should reject negative values', () => {
      const result = preferencesService.updateBufferTime(-5);

      expect(result).toBe(false);
    });

    it('should reject values over 120', () => {
      const result = preferencesService.updateBufferTime(150);

      expect(result).toBe(false);
    });

    it('should reject non-number values', () => {
      const result = preferencesService.updateBufferTime('not a number');

      expect(result).toBe(false);
    });
  });
});
