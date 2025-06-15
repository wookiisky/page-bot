// Page Bot Config Manager Module
// Handles configuration loading, saving, and default values

// Create a global configManager object
var configManager = {};

// Create module logger
const configLogger = logger.createModuleLogger('ConfigManager');

// Storage keys for different config sections to avoid quota limits
const MAIN_CONFIG_KEY = 'readBotConfig';
const QUICK_INPUTS_INDEX_KEY = 'readBotQuickInputsIndex';
const QUICK_INPUT_PREFIX = 'readBotQuickInput_';
const SYSTEM_PROMPT_KEY = 'readBotSystemPrompt';

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

// Get default system prompt
configManager.getDefaultSystemPrompt = function() {
  return 'Output in Chinese';
}

// Get default quick inputs
configManager.getDefaultQuickInputs = function() {
  return [
    { displayText: 'Summarize', sendText: 'Provide a concise summary of the following article:\n\n{CONTENT}' },
    { displayText: 'Extract Key Points', sendText: 'Extract key points from this content:\n{CONTENT}' }
  ];
}

// Generate unique ID for quick input
configManager.generateQuickInputId = function() {
  return 'qi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save individual quick input
configManager.saveQuickInput = async function(quickInput) {
  try {
    // Ensure quick input has an ID
    if (!quickInput.id) {
      quickInput.id = configManager.generateQuickInputId();
    }
    
    const key = QUICK_INPUT_PREFIX + quickInput.id;
    await chrome.storage.sync.set({ [key]: quickInput });
    configLogger.info(`Quick input saved: ${quickInput.id}`);
    return quickInput.id;
  } catch (error) {
    configLogger.error(`Error saving quick input ${quickInput.id}:`, error.message);
    throw error;
  }
}

// Load individual quick input
configManager.loadQuickInput = async function(id) {
  try {
    const key = QUICK_INPUT_PREFIX + id;
    const result = await chrome.storage.sync.get(key);
    return result[key] || null;
  } catch (error) {
    configLogger.error(`Error loading quick input ${id}:`, error.message);
    return null;
  }
}

// Delete individual quick input
configManager.deleteQuickInput = async function(id) {
  try {
    const key = QUICK_INPUT_PREFIX + id;
    await chrome.storage.sync.remove(key);
    configLogger.info(`Quick input deleted: ${id}`);
    return true;
  } catch (error) {
    configLogger.error(`Error deleting quick input ${id}:`, error.message);
    return false;
  }
}

// Save quick inputs index
configManager.saveQuickInputsIndex = async function(quickInputIds) {
  try {
    await chrome.storage.sync.set({ [QUICK_INPUTS_INDEX_KEY]: quickInputIds });
    configLogger.info(`Quick inputs index saved with ${quickInputIds.length} items`);
    return true;
  } catch (error) {
    configLogger.error('Error saving quick inputs index:', error.message);
    throw error;
  }
}

// Load quick inputs index
configManager.loadQuickInputsIndex = async function() {
  try {
    const result = await chrome.storage.sync.get(QUICK_INPUTS_INDEX_KEY);
    const index = result[QUICK_INPUTS_INDEX_KEY] || [];
    configLogger.info(`Quick inputs index loaded with ${index.length} items`);
    return index;
  } catch (error) {
    configLogger.error('Error loading quick inputs index:', error.message);
    return [];
  }
}

// Load all quick inputs
configManager.loadAllQuickInputs = async function() {
  try {
    const quickInputIds = await configManager.loadQuickInputsIndex();
    
    if (quickInputIds.length === 0) {
      configLogger.info('No quick inputs found, returning defaults');
      return configManager.getDefaultQuickInputs();
    }
    
    // Load all quick inputs in parallel
    const quickInputPromises = quickInputIds.map(id => configManager.loadQuickInput(id));
    const quickInputs = await Promise.all(quickInputPromises);
    
    // Filter out null values (deleted or corrupted items)
    const validQuickInputs = quickInputs.filter(qi => qi !== null);
    
    // If some items were filtered out, update the index
    if (validQuickInputs.length !== quickInputIds.length) {
      const validIds = validQuickInputs.map(qi => qi.id);
      await configManager.saveQuickInputsIndex(validIds);
      configLogger.info(`Cleaned up quick inputs index, removed ${quickInputIds.length - validQuickInputs.length} invalid items`);
    }
    
    configLogger.info(`Loaded ${validQuickInputs.length} quick inputs`);
    return validQuickInputs;
  } catch (error) {
    configLogger.error('Error loading all quick inputs:', error.message);
    return configManager.getDefaultQuickInputs();
  }
}

// Save all quick inputs (completely replace existing ones)
configManager.saveAllQuickInputs = async function(quickInputs) {
  try {
    configLogger.info(`Saving ${quickInputs.length} quick inputs`);
    
    // Get current index to know which items to delete
    const currentIndex = await configManager.loadQuickInputsIndex();
    
    // Assign IDs to new quick inputs and save them
    const newIds = [];
    const savePromises = [];
    
    for (const quickInput of quickInputs) {
      // Assign ID if not present
      if (!quickInput.id) {
        quickInput.id = configManager.generateQuickInputId();
      }
      
      newIds.push(quickInput.id);
      savePromises.push(configManager.saveQuickInput(quickInput));
    }
    
    // Save all quick inputs in parallel
    await Promise.all(savePromises);
    
    // Save new index
    await configManager.saveQuickInputsIndex(newIds);
    
    // Clean up old quick inputs that are no longer needed
    const idsToDelete = currentIndex.filter(id => !newIds.includes(id));
    if (idsToDelete.length > 0) {
      configLogger.info(`Cleaning up ${idsToDelete.length} old quick inputs`);
      const deletePromises = idsToDelete.map(id => configManager.deleteQuickInput(id));
      await Promise.all(deletePromises);
    }
    
    configLogger.info(`Successfully saved ${quickInputs.length} quick inputs`);
    return true;
  } catch (error) {
    configLogger.error('Error saving all quick inputs:', error.message);
    throw error;
  }
}

// Initialize configuration if needed
configManager.initializeIfNeeded = async function() {
  try {
    // Check main config
    const mainResult = await chrome.storage.sync.get(MAIN_CONFIG_KEY);
    
    if (!mainResult[MAIN_CONFIG_KEY]) {
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
    // Get main config and system prompt in parallel
    const [mainResult, systemPromptResult] = await Promise.all([
      chrome.storage.sync.get(MAIN_CONFIG_KEY),
      chrome.storage.sync.get(SYSTEM_PROMPT_KEY)
    ]);
    
    // Get default config for merging
    const defaultConfig = await configManager.getDefaultConfig();
    
    if (mainResult[MAIN_CONFIG_KEY]) {
      const storedMainConfig = mainResult[MAIN_CONFIG_KEY];
      
      // Start with main config merged with defaults
      const mergedConfig = {
        ...defaultConfig,
        ...storedMainConfig,
        llm: {
          ...defaultConfig.llm,
          ...storedMainConfig.llm
        }
      };
      
      // Add quick inputs (loaded separately)
      mergedConfig.quickInputs = await configManager.loadAllQuickInputs();
      
      // Add system prompt (from separate storage or default)
      if (systemPromptResult[SYSTEM_PROMPT_KEY]) {
        mergedConfig.systemPrompt = systemPromptResult[SYSTEM_PROMPT_KEY];
      } else {
        mergedConfig.systemPrompt = configManager.getDefaultSystemPrompt();
      }
      
      // Handle legacy configuration format migration
      if (storedMainConfig.llm?.providers && !storedMainConfig.llm?.models) {
        configLogger.info('Migrating legacy LLM configuration format');
        const legacyProviders = storedMainConfig.llm.providers;
        const defaultProvider = storedMainConfig.llm.defaultProvider || 'openai';
        
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

// Save configuration with split storage to avoid quota limits
configManager.saveConfig = async function(newConfig) {
  try {
    configLogger.info('Saving configuration with individual quick input storage');
    
    // Extract main config (without quick inputs and system prompt)
    const mainConfig = {
      defaultExtractionMethod: newConfig.defaultExtractionMethod,
      jinaApiKey: newConfig.jinaApiKey,
      jinaResponseTemplate: newConfig.jinaResponseTemplate,
      llm: newConfig.llm,
      contentDisplayHeight: newConfig.contentDisplayHeight
    };
    
    // Extract quick inputs
    const quickInputs = newConfig.quickInputs || configManager.getDefaultQuickInputs();
    
    // Extract system prompt
    const systemPrompt = newConfig.systemPrompt || configManager.getDefaultSystemPrompt();
    
    // Save all parts with error handling
    const savePromises = [
      chrome.storage.sync.set({ [MAIN_CONFIG_KEY]: mainConfig }).catch(error => {
        configLogger.error('Error saving main config:', error.message);
        throw new Error(`Main config save failed: ${error.message}`);
      }),
      configManager.saveAllQuickInputs(quickInputs).catch(error => {
        configLogger.error('Error saving quick inputs:', error.message);
        throw new Error(`Quick inputs save failed: ${error.message}`);
      }),
      chrome.storage.sync.set({ [SYSTEM_PROMPT_KEY]: systemPrompt }).catch(error => {
        configLogger.error('Error saving system prompt:', error.message);
        throw new Error(`System prompt save failed: ${error.message}`);
      })
    ];
    
    await Promise.all(savePromises);
    
    configLogger.info('Configuration successfully saved with individual quick input storage');
    return true;
  } catch (error) {
    configLogger.error('Error saving configuration:', error.message);
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

// Migrate existing unified config to split config
configManager.migrateToSplitConfig = async function() {
  try {
    configLogger.info('Checking for unified config migration to individual quick input storage');
    
    // Check if old unified config exists or if quick inputs need migration
    const [mainResult, quickInputsIndexResult, systemPromptResult] = await Promise.all([
      chrome.storage.sync.get(MAIN_CONFIG_KEY),
      chrome.storage.sync.get(QUICK_INPUTS_INDEX_KEY),
      chrome.storage.sync.get(SYSTEM_PROMPT_KEY)
    ]);
    
    // Check for legacy quick inputs stored as array
    const legacyQuickInputsKey = 'readBotQuickInputs';
    const legacyQuickInputsResult = await chrome.storage.sync.get(legacyQuickInputsKey);
    
    let needsMigration = false;
    
    // If main config exists but has quickInputs or systemPrompt, migrate
    if (mainResult[MAIN_CONFIG_KEY] && 
        (mainResult[MAIN_CONFIG_KEY].quickInputs || mainResult[MAIN_CONFIG_KEY].systemPrompt)) {
      needsMigration = true;
      configLogger.info('Found unified config with quickInputs/systemPrompt, migrating');
    }
    
    // If legacy quick inputs array exists, migrate
    if (legacyQuickInputsResult[legacyQuickInputsKey] && !quickInputsIndexResult[QUICK_INPUTS_INDEX_KEY]) {
      needsMigration = true;
      configLogger.info('Found legacy quick inputs array, migrating to individual storage');
    }
    
    if (needsMigration) {
      let config = mainResult[MAIN_CONFIG_KEY] || await configManager.getDefaultConfig();
      
      // Use legacy quick inputs if available
      if (legacyQuickInputsResult[legacyQuickInputsKey]) {
        config.quickInputs = legacyQuickInputsResult[legacyQuickInputsKey];
      }
      
      // Save the config using the new split method
      await configManager.saveConfig(config);
      
      // Clean up legacy quick inputs storage
      if (legacyQuickInputsResult[legacyQuickInputsKey]) {
        await chrome.storage.sync.remove(legacyQuickInputsKey);
        configLogger.info('Removed legacy quick inputs array storage');
      }
      
      configLogger.info('Successfully migrated config to individual quick input storage');
    }
  } catch (error) {
    configLogger.error('Error during config migration:', error.message);
  }
}

// Check storage usage and warn if approaching limits
configManager.checkStorageUsage = async function() {
  try {
    const storageInfo = await chrome.storage.sync.getBytesInUse(null);
    const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
    const maxBytesPerItem = chrome.storage.sync.QUOTA_BYTES_PER_ITEM || 8192; // 8KB default
    
    configLogger.info(`Storage usage: ${storageInfo}/${maxBytes} bytes (${Math.round(storageInfo/maxBytes*100)}%)`);
    
    // Check individual items
    const [mainUsage, quickInputsIndexUsage, systemPromptUsage] = await Promise.all([
      chrome.storage.sync.getBytesInUse(MAIN_CONFIG_KEY),
      chrome.storage.sync.getBytesInUse(QUICK_INPUTS_INDEX_KEY),
      chrome.storage.sync.getBytesInUse(SYSTEM_PROMPT_KEY)
    ]);
    
    // Calculate quick inputs total usage
    const quickInputIds = await configManager.loadQuickInputsIndex();
    let quickInputsTotalUsage = quickInputsIndexUsage;
    
    if (quickInputIds.length > 0) {
      const quickInputKeys = quickInputIds.map(id => QUICK_INPUT_PREFIX + id);
      const quickInputUsages = await Promise.all(
        quickInputKeys.map(key => chrome.storage.sync.getBytesInUse(key))
      );
      quickInputsTotalUsage += quickInputUsages.reduce((sum, usage) => sum + usage, 0);
    }
    
    configLogger.info(`Config sizes - Main: ${mainUsage}B, QuickInputs: ${quickInputsTotalUsage}B (${quickInputIds.length} items), SystemPrompt: ${systemPromptUsage}B`);
    
    // Warn if any item is approaching the per-item limit
    const warnThreshold = maxBytesPerItem * 0.8; // 80% of limit
    if (mainUsage > warnThreshold) {
      configLogger.warn(`Main config approaching size limit: ${mainUsage}/${maxBytesPerItem} bytes`);
    }
    if (systemPromptUsage > warnThreshold) {
      configLogger.warn(`System prompt approaching size limit: ${systemPromptUsage}/${maxBytesPerItem} bytes`);
    }
    
    return {
      total: storageInfo,
      maxTotal: maxBytes,
      main: mainUsage,
      quickInputs: quickInputsTotalUsage,
      quickInputsCount: quickInputIds.length,
      systemPrompt: systemPromptUsage,
      maxPerItem: maxBytesPerItem
    };
  } catch (error) {
    configLogger.error('Error checking storage usage:', error.message);
    return null;
  }
}

// Clean up legacy storage keys if they exist
configManager.cleanupLegacyStorage = async function() {
  try {
    configLogger.info('Checking for legacy storage cleanup');
    
    // Check if old unified config exists alongside new split config
    const [mainResult, legacyResult] = await Promise.all([
      chrome.storage.sync.get(MAIN_CONFIG_KEY),
      chrome.storage.sync.get('readBotConfig_legacy') // Check for old key
    ]);
    
    if (mainResult[MAIN_CONFIG_KEY] && legacyResult['readBotConfig_legacy']) {
      configLogger.info('Removing legacy unified config key');
      await chrome.storage.sync.remove('readBotConfig_legacy');
    }
  } catch (error) {
    configLogger.error('Error during legacy storage cleanup:', error.message);
  }
} 