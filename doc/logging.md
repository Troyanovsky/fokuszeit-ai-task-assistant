# Logging System Documentation

## Overview

FokusZeit uses `electron-log` for centralized logging across both the main Electron process and the renderer processes. This logging system allows for consistent error tracking and debugging throughout the application.

## Log File Locations

Log files are automatically stored in platform-specific locations:

- **Windows**: `%USERPROFILE%\AppData\Roaming\FokusZeit\logs\{process type}.log`
- **macOS**: `~/Library/Logs/FokusZeit/{process type}.log`
- **Linux**: `~/.config/FokusZeit/logs/{process type}.log`

## Usage

### In Main Process

In the Electron main process, import the logger from the main process logger module:

```javascript
import logger from './electron-main/logger.js';

// Use different log levels
logger.info('Application started');
logger.warn('Something unusual happened');
logger.error('An error occurred');

// Log errors with stack traces
try {
  // Some code that might throw
} catch (error) {
  logger.logError(error, 'Failed during startup');
}
```

### In Renderer Process

In Vue components or other renderer process files, import the logger from the services directory:

```javascript
import logger from './services/logger.js';

// Use different log levels
logger.info('Component mounted');
logger.warn('Validation warning');
logger.error('API request failed');

// Log errors with stack traces
try {
  // Some code that might throw
} catch (error) {
  logger.logError(error, 'Error in component');
}
```

## Log Levels

The logger supports the following levels (in order of decreasing severity):

1. **error** - Critical errors that require immediate attention
2. **warn** - Warning conditions that should be reviewed
3. **info** - Informational messages about normal operation
4. **verbose** - More detailed informational messages
5. **debug** - Debugging information (only in development)
6. **silly** - Extremely detailed debugging information

## Configuration

The logging system is configured in two main files:

- `app/electron-main/logger.js` - For the main process
- `app/src/services/logger.js` - For the renderer process

Both files configure log rotation (5MB max file size) and formatting.

## Best Practices

1. Choose the appropriate log level for your message
2. Include relevant context in log messages
3. Use `logger.logError()` for error objects to capture stack traces
4. Log objects by passing them as additional arguments
5. Replace all `console.log()` calls with the appropriate logger method 