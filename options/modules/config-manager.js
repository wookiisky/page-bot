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

  // Export configuration to JSON file
  static async exportConfiguration(domElements, modelManager) {
    try {
      logger.info('Exporting configuration to JSON file');
      
      // Build complete config including quick inputs
      const config = this.buildConfigFromForm(domElements, modelManager);
      
      // Add quick inputs to config
      const quickInputs = [];
      const quickInputItems = domElements.quickInputsContainer.querySelectorAll('.quick-input-item');
      quickInputItems.forEach(item => {
        const displayText = item.querySelector('.quick-input-display').value.trim();
        const sendText = item.querySelector('.quick-input-send').value.trim();
        if (displayText && sendText) {
          quickInputs.push({ displayText, sendText });
        }
      });
      config.quickInputs = quickInputs;

      // Add metadata
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        config: config
      };
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                       new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `pagebot_config_${timestamp}.json`;
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logger.info(`Configuration exported successfully as ${filename}`);
      return true;
    } catch (error) {
      logger.error('Error exporting configuration:', error);
      alert('Failed to export configuration. Please check the console for details.');
      return false;
    }
  }

  // Import configuration from JSON file
  static async importConfiguration(file, domElements, modelManager) {
    try {
      logger.info('Importing configuration from JSON file');
      
      if (!file || file.type !== 'application/json') {
        throw new Error('Please select a valid JSON file');
      }
      
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data structure
      if (!importData.config) {
        throw new Error('Invalid configuration file format');
      }
      
      const config = importData.config;
      
      // Validate required fields
      if (!config.defaultExtractionMethod) {
        throw new Error('Configuration missing required field: defaultExtractionMethod');
      }
      
      // Confirm import
      const confirmMessage = `Are you sure you want to import this configuration?\n\n` +
                           `Export Date: ${importData.exportedAt || 'Unknown'}\n` +
                           `Version: ${importData.version || 'Unknown'}\n\n` +
                           `This will replace your current settings.`;
      
      if (!confirm(confirmMessage)) {
        logger.info('Configuration import cancelled by user');
        return false;
      }
      
      // Save imported config
      const success = await this.saveSettings(config);
      
      if (success) {
        logger.info('Configuration imported successfully, reloading page');
        alert('Configuration imported successfully! The page will reload to apply changes.');
        location.reload();
        return true;
      } else {
        throw new Error('Failed to save imported configuration');
      }
      
    } catch (error) {
      logger.error('Error importing configuration:', error);
      alert(`Failed to import configuration: ${error.message}`);
      return false;
    }
  }
} 