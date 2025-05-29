// Read Bot Logger Module
// Universal logging utility with configurable levels and formatting

// Create a global logger object
var logger = {};

// Log levels (higher number = more verbose)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Default configuration
let loggerConfig = {
  level: LOG_LEVELS.INFO,
  enableConsole: true,
  enableStorage: false,
  maxStorageEntries: 1000,
  timestampFormat: 'ISO', // 'ISO' or 'locale'
  modulePrefix: true,
  colorOutput: true
};

// Storage key for log entries
const LOG_STORAGE_KEY = 'readBotLogs';

// Color codes for different log levels
const LOG_COLORS = {
  ERROR: '#ff4444',
  WARN: '#ffaa00',
  INFO: '#4488ff',
  DEBUG: '#44ff44',
  TRACE: '#888888'
};

/**
 * Configure the logger
 * @param {Object} config Configuration object
 */
logger.configure = function(config) {
  loggerConfig = { ...loggerConfig, ...config };
}

/**
 * Get current logger configuration
 * @returns {Object} Current configuration
 */
logger.getConfig = function() {
  return { ...loggerConfig };
}

/**
 * Set log level
 * @param {string|number} level Log level name or number
 */
logger.setLevel = function(level) {
  if (typeof level === 'string') {
    level = LOG_LEVELS[level.toUpperCase()];
  }
  if (typeof level === 'number' && level >= 0 && level <= 4) {
    loggerConfig.level = level;
  }
}

/**
 * Get current log level
 * @returns {number} Current log level
 */
logger.getLevel = function() {
  return loggerConfig.level;
}

/**
 * Create a module-specific logger
 * @param {string} moduleName Name of the module
 * @returns {Object} Module logger with bound methods
 */
logger.createModuleLogger = function(moduleName) {
  return {
    error: (message, ...args) => logger.error(message, moduleName, ...args),
    warn: (message, ...args) => logger.warn(message, moduleName, ...args),
    info: (message, ...args) => logger.info(message, moduleName, ...args),
    debug: (message, ...args) => logger.debug(message, moduleName, ...args),
    trace: (message, ...args) => logger.trace(message, moduleName, ...args),
    group: (label) => logger.group(label, moduleName),
    groupEnd: () => logger.groupEnd(),
    time: (label) => logger.time(label, moduleName),
    timeEnd: (label) => logger.timeEnd(label, moduleName)
  };
}

/**
 * Log an error message
 * @param {string} message Log message
 * @param {string} module Module name (optional)
 * @param {...any} args Additional arguments
 */
logger.error = function(message, module, ...args) {
  _log('ERROR', message, module, ...args);
}

/**
 * Log a warning message
 * @param {string} message Log message
 * @param {string} module Module name (optional)
 * @param {...any} args Additional arguments
 */
logger.warn = function(message, module, ...args) {
  _log('WARN', message, module, ...args);
}

/**
 * Log an info message
 * @param {string} message Log message
 * @param {string} module Module name (optional)
 * @param {...any} args Additional arguments
 */
logger.info = function(message, module, ...args) {
  _log('INFO', message, module, ...args);
}

/**
 * Log a debug message
 * @param {string} message Log message
 * @param {string} module Module name (optional)
 * @param {...any} args Additional arguments
 */
logger.debug = function(message, module, ...args) {
  _log('DEBUG', message, module, ...args);
}

/**
 * Log a trace message
 * @param {string} message Log message
 * @param {string} module Module name (optional)
 * @param {...any} args Additional arguments
 */
logger.trace = function(message, module, ...args) {
  _log('TRACE', message, module, ...args);
}

/**
 * Create a console group
 * @param {string} label Group label
 * @param {string} module Module name (optional)
 */
logger.group = function(label, module) {
  if (!loggerConfig.enableConsole) return;
  
  const formattedLabel = _formatMessage('INFO', label, module);
  console.group(formattedLabel);
}

/**
 * End a console group
 */
logger.groupEnd = function() {
  if (!loggerConfig.enableConsole) return;
  console.groupEnd();
}

/**
 * Start a timer
 * @param {string} label Timer label
 * @param {string} module Module name (optional)
 */
logger.time = function(label, module) {
  if (!loggerConfig.enableConsole) return;
  
  const timerLabel = module ? `${module}: ${label}` : label;
  console.time(timerLabel);
}

/**
 * End a timer
 * @param {string} label Timer label
 * @param {string} module Module name (optional)
 */
logger.timeEnd = function(label, module) {
  if (!loggerConfig.enableConsole) return;
  
  const timerLabel = module ? `${module}: ${label}` : label;
  console.timeEnd(timerLabel);
}

/**
 * Get stored log entries
 * @param {number} limit Maximum number of entries to return
 * @returns {Promise<Array>} Array of log entries
 */
logger.getStoredLogs = async function(limit = 100) {
  if (!loggerConfig.enableStorage) return [];
  
  try {
    const result = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = result[LOG_STORAGE_KEY] || [];
    return logs.slice(-limit);
  } catch (error) {
    console.error('Error getting stored logs:', error);
    return [];
  }
}

/**
 * Clear stored log entries
 * @returns {Promise<boolean>} Success status
 */
logger.clearStoredLogs = async function() {
  if (!loggerConfig.enableStorage) return true;
  
  try {
    await chrome.storage.local.remove(LOG_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing stored logs:', error);
    return false;
  }
}

/**
 * Export logs as text
 * @param {number} limit Maximum number of entries to export
 * @returns {Promise<string>} Formatted log text
 */
logger.exportLogs = async function(limit = 1000) {
  const logs = await logger.getStoredLogs(limit);
  return logs.map(log => 
    `[${log.timestamp}] ${log.level} ${log.module ? `[${log.module}] ` : ''}${log.message}`
  ).join('\n');
}

// Internal logging function
function _log(level, message, module, ...args) {
  const levelNum = LOG_LEVELS[level];
  
  // Check if this log level should be output
  if (levelNum > loggerConfig.level) return;
  
  // Create log entry
  const logEntry = {
    timestamp: _getTimestamp(),
    level: level,
    module: typeof module === 'string' ? module : null,
    message: message,
    args: args.length > 0 ? args : null
  };
  
  // Output to console if enabled
  if (loggerConfig.enableConsole) {
    _outputToConsole(logEntry);
  }
  
  // Store log if enabled
  if (loggerConfig.enableStorage) {
    _storeLog(logEntry);
  }
}

// Format message for display
function _formatMessage(level, message, module) {
  const timestamp = _getTimestamp();
  const modulePrefix = module && loggerConfig.modulePrefix ? `[${module}] ` : '';
  return `[${timestamp}] ${level} ${modulePrefix}${message}`;
}

// Output log to console with appropriate method and styling
function _outputToConsole(logEntry) {
  const { level, message, module, args } = logEntry;
  const formattedMessage = _formatMessage(level, message, module);
  
  // Choose console method based on log level
  let consoleMethod;
  switch (level) {
    case 'ERROR':
      consoleMethod = console.error;
      break;
    case 'WARN':
      consoleMethod = console.warn;
      break;
    case 'DEBUG':
    case 'TRACE':
      consoleMethod = console.debug;
      break;
    default:
      consoleMethod = console.log;
  }
  
  // Apply color styling if enabled
  if (loggerConfig.colorOutput && LOG_COLORS[level]) {
    const style = `color: ${LOG_COLORS[level]}; font-weight: bold;`;
    consoleMethod(`%c${formattedMessage}`, style, ...(args || []));
  } else {
    consoleMethod(formattedMessage, ...(args || []));
  }
}

// Store log entry to chrome storage
async function _storeLog(logEntry) {
  try {
    const result = await chrome.storage.local.get(LOG_STORAGE_KEY);
    let logs = result[LOG_STORAGE_KEY] || [];
    
    // Add new log entry
    logs.push({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      module: logEntry.module,
      message: logEntry.message
    });
    
    // Trim logs if exceeding max entries
    if (logs.length > loggerConfig.maxStorageEntries) {
      logs = logs.slice(-loggerConfig.maxStorageEntries);
    }
    
    // Save back to storage
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
  } catch (error) {
    console.error('Error storing log entry:', error);
  }
}

// Get formatted timestamp
function _getTimestamp() {
  const now = new Date();
  
  if (loggerConfig.timestampFormat === 'locale') {
    return now.toLocaleString();
  } else {
    return now.toISOString();
  }
}

// Initialize logger with default configuration
logger.configure({}); 