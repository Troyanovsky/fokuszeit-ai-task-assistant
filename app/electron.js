import { app, BrowserWindow, powerMonitor } from 'electron';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import databaseService from './electron-main/services/database.js';
import notificationService from './electron-main/services/notification.js';
import { setupIpcHandlers } from './electron-main/ipcHandlers.js';
import aiService from './electron-main/aiService.js';
import logger from './electron-main/logger.js';

// Set application name for notifications
app.setName('FokusZeit');

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

/**
 * Initialize power monitoring for notification rescheduling
 */
function initPowerMonitoring() {
  // Handle system resume from sleep
  powerMonitor.on('resume', () => {
    logger.info('System resumed from sleep, rescheduling notifications');
    notificationService.rescheduleAllPending();
  });

  // Handle system suspend (for potential future use)
  powerMonitor.on('suspend', () => {
    logger.info('System suspending, pending notifications will be rescheduled on resume');
  });

  // Handle shutdown (for potential future use)
  powerMonitor.on('shutdown', () => {
    logger.info('System shutting down');
  });

  logger.info('Power monitoring initialized');
}

/**
 * Initialize clock change detection
 */
function initClockMonitoring() {
  let lastCheckTime = Date.now();
  const CHECK_INTERVAL = 60000; // Check every minute
  const CLOCK_CHANGE_THRESHOLD_MS = 15000; // 15 seconds - accounts for timer jitter and NTP sync

  // Periodic check for clock changes
  const clockCheckInterval = setInterval(() => {
    const now = Date.now();
    const expectedTime = lastCheckTime + CHECK_INTERVAL;
    const actualDiff = now - expectedTime; // Can be negative (backward) or positive (forward)
    const timeDiff = Math.abs(actualDiff);

    // If clock changed by more than threshold in either direction
    if (timeDiff > CLOCK_CHANGE_THRESHOLD_MS) {
      const direction = actualDiff > 0 ? 'forward' : 'backward';
      logger.warn(`Clock change detected: ${direction} by ${timeDiff}ms`);
      notificationService.rescheduleAllPending();
    }

    lastCheckTime = now;
  }, CHECK_INTERVAL);

  // Clear interval on app quit
  app.on('before-quit', () => {
    clearInterval(clockCheckInterval);
  });

  logger.info('Clock monitoring initialized');
}

/**
 * Initialize the application services
 */
async function initServices() {
  try {
    // Initialize database
    await databaseService.init();
    logger.info('Database initialized');
    
    // Initialize notification service
    notificationService.init();
    logger.info('Notification service initialized');
  } catch (error) {
    logger.logError(error, 'Error initializing services');
  }
}

/**
 * Wait for a specified URL to be available
 */
function waitForUrl(urlString, timeout = 30000, interval = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const parsedUrl = new URL(urlString);
    
    const checkUrl = () => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'HEAD'
      };
      
      const request = http.request(options, (response) => {
        if (response.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      
      request.on('error', () => {
        retry();
      });
      
      request.end();
    };
    
    const retry = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${urlString}`));
        return;
      }
      setTimeout(checkUrl, interval);
    };
    
    checkUrl();
  });
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Set up IPC handlers after mainWindow is created
  setupIpcHandlers(mainWindow, aiService);

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    // In development mode, wait for dev server to be ready before loading URL
    const devServerUrl = 'http://localhost:5173';
    logger.info(`Waiting for dev server at ${devServerUrl}...`);
    
    waitForUrl(devServerUrl)
      .then(() => {
        logger.info('Dev server is ready, loading application...');
        mainWindow.loadURL(devServerUrl);
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
      })
      .catch((err) => {
        logger.error('Failed to connect to dev server:', err);
        // Fallback to loading directly
        logger.info('Attempting to load URL directly...');
        mainWindow.loadURL(devServerUrl);
      });
  } else {
    // Load from production build
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'dist', 'index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await initServices();
  initPowerMonitoring();
  initClockMonitoring();
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    // Close database connection
    databaseService.close();
    app.quit();
  }
});

app.on('activate', function() {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

// Listen for focus event to refresh tasks
app.on('browser-window-focus', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tasks:refresh');
  }
});

// Close database connection when app is about to quit
app.on('before-quit', () => {
  databaseService.close();
});