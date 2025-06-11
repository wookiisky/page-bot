// Page Bot Config Manager Module
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
        defaultModelId: 'gemini-pro',
        models: [
          {
            id: 'gemini-pro',
            name: 'Google Gemini Pro',
            provider: 'gemini',
            apiKey: '',
            model: 'gemini-2.5-pro-preview-05-06',
            enabled: true
          },
          {
            id: 'openai-gpt35',
            name: 'OpenAI GPT-3.5',
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com',
            model: 'gpt-3.5-turbo',
            enabled: true
          }
        ]
      },
      systemPrompt: 'Output in Chinese',
      quickInputs: [
        { displayText: 'Summarize', sendText: 'Provide a concise summary of the following article:\n\n{CONTENT}' },
        { displayText: 'Extract Key Points', sendText: 'Extract key points from this content:\n{CONTENT}' }
      ],
      contentDisplayHeight: 100
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
          ...storedConfig.llm
        }
      };
      
      // Handle legacy configuration format migration
      if (storedConfig.llm?.providers && !storedConfig.llm?.models) {
        configLogger.info('Migrating legacy LLM configuration format');
        const legacyProviders = storedConfig.llm.providers;
        const defaultProvider = storedConfig.llm.defaultProvider || 'openai';
        
        mergedConfig.llm.models = [];
        mergedConfig.llm.defaultModelId = null;
        
        // Convert OpenAI provider to model
        if (legacyProviders.openai) {
          const openaiModel = {
            id: 'openai-legacy',
            name: 'OpenAI (Legacy)',
            provider: 'openai',
            apiKey: legacyProviders.openai.apiKey || '',
            baseUrl: legacyProviders.openai.baseUrl || 'https://api.openai.com',
            model: legacyProviders.openai.model || 'gpt-3.5-turbo',
            enabled: true
          };
          mergedConfig.llm.models.push(openaiModel);
          
          if (defaultProvider === 'openai') {
            mergedConfig.llm.defaultModelId = 'openai-legacy';
          }
        }
        
        // Convert Gemini provider to model
        if (legacyProviders.gemini) {
          const geminiModel = {
            id: 'gemini-legacy',
            name: 'Gemini (Legacy)',
            provider: 'gemini',
            apiKey: legacyProviders.gemini.apiKey || '',
            model: legacyProviders.gemini.model || 'gemini-pro',
            enabled: true
          };
          mergedConfig.llm.models.push(geminiModel);
          
          if (defaultProvider === 'gemini') {
            mergedConfig.llm.defaultModelId = 'gemini-legacy';
          }
        }
        
        // Set default if not set
        if (!mergedConfig.llm.defaultModelId && mergedConfig.llm.models.length > 0) {
          mergedConfig.llm.defaultModelId = mergedConfig.llm.models[0].id;
        }
        
        // Remove legacy fields
        delete mergedConfig.llm.providers;
        delete mergedConfig.llm.defaultProvider;
        
        // Save migrated configuration
        await configManager.saveConfig(mergedConfig);
        configLogger.info('Legacy configuration migrated successfully');
      }
      
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