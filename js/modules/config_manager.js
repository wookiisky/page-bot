// Read Bot Config Manager Module
// Handles configuration loading, saving, and default values

// Create a global configManager object
var configManager = {};

// Create module logger
const configLogger = logger.createModuleLogger('ConfigManager');

// Storage key for config
const STORAGE_KEY = 'readBotConfig';

// Get default configuration
configManager.getDefaultConfig = async function() {
  try {
    const response = await fetch('/options/default_options.json');
    if (!response.ok) {
      throw new Error(`Unable to load default settings: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    configLogger.error('Failed to load default settings file:', error.message);
    // Return hardcoded default values as fallback
    return {
      defaultExtractionMethod: 'readability',
      jinaApiKey: '',

      jinaResponseTemplate: '# {title}\n\n**URL:** {url}\n\n**Description:** {description}\n\n## Content\n\n{content}',
      llm: {
        defaultProvider: 'openai',
        providers: {
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com',
            model: 'gpt-3.5-turbo'
          },
          gemini: {
            apiKey: '',
            model: 'gemini-pro'
          }
        }
      },
      systemPrompt: 'You are a helpful assistant. The user is interacting with content from a webpage. The extracted content is provided below:\n{CONTENT}\n\nAnswer the user\'s questions based on this content and your general knowledge.',
      quickInputs: [
        { displayText: 'Summarize Content', sendText: 'Please summarize the following content:\n{CONTENT}' },
        { displayText: 'Extract Key Points', sendText: 'Extract key points from this content:\n{CONTENT}' }
      ],
      contentDisplayHeight: 300
    };
  }
}

// Initialize configuration if needed
configManager.initializeIfNeeded = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (!result[STORAGE_KEY]) {
      configLogger.info('Initializing default configuration');
      const defaultConfig = await configManager.getDefaultConfig();
      await configManager.saveConfig(defaultConfig);
    }
  } catch (error) {
    configLogger.error('Configuration initialization error:', error.message);
  }
}

// Get current configuration
configManager.getConfig = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (result[STORAGE_KEY]) {
      // Merge with default config to ensure all fields exist
      // (in case new fields were added in an update)
      const defaultConfig = await configManager.getDefaultConfig();
      const storedConfig = result[STORAGE_KEY];
      
      // Deep merge for nested objects like llm
      const mergedConfig = {
        ...defaultConfig,
        ...storedConfig,
        llm: {
          ...defaultConfig.llm,
          ...storedConfig.llm,
          providers: {
            ...defaultConfig.llm.providers,
            ...storedConfig.llm?.providers,
            openai: {
              ...defaultConfig.llm.providers.openai,
              ...storedConfig.llm?.providers?.openai
            },
            gemini: {
              ...defaultConfig.llm.providers.gemini,
              ...storedConfig.llm?.providers?.gemini
            }
          }
        }
      };
      
      return mergedConfig;
    } else {
      // No config found, initialize and return default
      const defaultConfig = await configManager.getDefaultConfig();
      await configManager.saveConfig(defaultConfig);
      configLogger.info('Using default configuration');
      return defaultConfig;
    }
  } catch (error) {
    configLogger.error('Get configuration error:', error.message);
    return await configManager.getDefaultConfig();
  }
}

// Save configuration
configManager.saveConfig = async function(newConfig) {
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: newConfig });
    configLogger.info('Configuration successfully saved to chrome.storage.sync');
    return true;
  } catch (error) {
    configLogger.error('Error saving configuration to chrome.storage.sync:', error.message);
    return false;
  }
}

// Reset configuration to defaults
configManager.resetConfig = async function() {
  try {
    const defaultConfig = await configManager.getDefaultConfig();
    await configManager.saveConfig(defaultConfig);
    configLogger.info('Configuration reset to default values');
    return true;
  } catch (error) {
    configLogger.error('Reset configuration error:', error.message);
    return false;
  }
} 