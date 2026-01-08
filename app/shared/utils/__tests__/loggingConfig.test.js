/**
 * Tests for logging configuration helpers.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { getRawLoggingConfig, isDebugLoggingEnabled, shouldLogRaw } from '../loggingConfig.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('loggingConfig', () => {
  it('enables debug logging when flag is set', () => {
    process.env.FOKUS_DEBUG_LOGGING = '1';
    expect(isDebugLoggingEnabled()).toBe(true);
  });

  it('disables raw logging when debug is off', () => {
    process.env.FOKUS_RAW_LOGGING = '1';
    const config = getRawLoggingConfig();
    expect(config.debugEnabled).toBe(false);
    expect(config.rawEnabled).toBe(false);
  });

  it('allows raw logging when debug and raw flags are set', () => {
    process.env.FOKUS_DEBUG_LOGGING = '1';
    process.env.FOKUS_RAW_LOGGING = '1';
    expect(shouldLogRaw()).toBe(true);
  });

  it('scopes raw logging to a request id when configured', () => {
    process.env.FOKUS_DEBUG_LOGGING = '1';
    process.env.FOKUS_RAW_LOGGING = '1';
    process.env.FOKUS_RAW_LOG_REQUEST_ID = 'request-123';

    expect(shouldLogRaw('request-123')).toBe(true);
    expect(shouldLogRaw('other-request')).toBe(false);
  });
});
