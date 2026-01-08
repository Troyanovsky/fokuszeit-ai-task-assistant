/**
 * Logging configuration helpers for debug/raw logging toggles.
 */

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

function readEnvValue(name) {
  if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined) {
    return process.env[name];
  }

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name] !== undefined) {
    return import.meta.env[name];
  }

  return undefined;
}

function isTruthy(value) {
  if (typeof value !== 'string') {
    return Boolean(value);
  }
  return TRUTHY_VALUES.has(value.trim().toLowerCase());
}

function resolveEnvFlag(primaryKey, fallbackKey) {
  const primaryValue = readEnvValue(primaryKey);
  if (primaryValue !== undefined) {
    return primaryValue;
  }
  return fallbackKey ? readEnvValue(fallbackKey) : undefined;
}

export function isDebugLoggingEnabled() {
  const flag = resolveEnvFlag('FOKUS_DEBUG_LOGGING', 'VITE_FOKUS_DEBUG_LOGGING');
  return isTruthy(flag);
}

export function getRawLoggingConfig() {
  const debugEnabled = isDebugLoggingEnabled();
  const rawEnabledFlag = resolveEnvFlag('FOKUS_RAW_LOGGING', 'VITE_FOKUS_RAW_LOGGING');
  const rawRequestId = resolveEnvFlag(
    'FOKUS_RAW_LOG_REQUEST_ID',
    'VITE_FOKUS_RAW_LOG_REQUEST_ID'
  );

  return {
    debugEnabled,
    rawEnabled: debugEnabled && isTruthy(rawEnabledFlag),
    rawRequestId: rawRequestId ? String(rawRequestId) : null
  };
}

export function shouldLogRaw(requestId) {
  const { rawEnabled, rawRequestId } = getRawLoggingConfig();
  if (!rawEnabled) {
    return false;
  }
  if (!rawRequestId) {
    return true;
  }
  return Boolean(requestId) && requestId === rawRequestId;
}
