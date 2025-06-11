// Configuration Manager
// Handles loading, saving, and resetting configuration

// Import logger module
const logger = window.logger ? window.logger.createModuleLogger('ConfigManager') : console;

export class ConfigManager {
  
  // Load settings from storage
  static async loadSettings() {
    try {
      logger.info('Loading settings from storage');
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CONFIG'
      });
      
      if (response && response.type === 'CONFIG_LOADED') {
        logger.info('Settings loaded successfully');
        return response.config;
      } else {
        logger.error('Failed to load configuration from storage');
        return null;
      }
    } catch (error) {
      logger.error('Error loading settings', error);
      return null;
    }
  }
  
  // Save settings to storage
  static async saveSettings(config) {
    try {
      logger.info('Saving settings to storage');
      
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config: config
      });
      
      if (response && response.type === 'CONFIG_SAVED') {
        logger.info('Settings saved successfully');
        return true;
      } else {
        logger.error('Failed to save configuration');
        return false;
      }
    } catch (error) {
      logger.error('Error saving settings', error);
      return false;
    }
  }
  
  // Reset settings to defaults
  static async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return false;
    }
    
    try {
      logger.info('Resetting settings to defaults');
      
      const response = await chrome.runtime.sendMessage({
        type: 'RESET_CONFIG'
      });
      
      if (response && response.type === 'CONFIG_RESET') {
        logger.info('Settings reset successfully, reloading page');
        location.reload();
        return true;
      } else {
        logger.error('Failed to reset configuration');
        return false;
      }
    } catch (error) {
      logger.error('Error resetting settings', error);
      return false;
    }
  }
  
  // Build config object from form values
  static buildConfigFromForm(domElements, modelManager) {
    return {
      defaultExtractionMethod: domElements.defaultExtractionMethod.value,
      jinaApiKey: domElements.jinaApiKey.value,
      jinaResponseTemplate: domElements.jinaResponseTemplate.value,
      
      llm: {
        defaultModelId: modelManager.getDefaultModelId(),
        models: modelManager.getCompleteModels() // Only save complete models
      },
      systemPrompt: domElements.systemPrompt.value,
      contentDisplayHeight: parseInt(domElements.contentDisplayHeight.value) || 300
    };
  }
} 