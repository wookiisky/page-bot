// Read Bot Options Page JavaScript
// Main entry point for the options page

// Import modules
import { domElements, domGroups } from './modules/dom-elements.js';
import { ConfigManager } from './modules/config-manager.js';
import { FormHandler } from './modules/form-handler.js';
import { QuickInputsManager } from './modules/quick-inputs.js';
import { ModelManager } from './modules/model-manager.js';

// Import logger module
const logger = window.logger ? window.logger.createModuleLogger('Options') : console;

// Main Options Page Controller
class OptionsPage {
  
  constructor() {
    this.domElements = domElements;
    this.domGroups = domGroups;
    this.hasUnsavedChanges = false;
    // Initialize ModelManager with change notification callback
    this.modelManager = new ModelManager(domElements, () => this.markAsChanged());
  }
  
  // Initialize the options page
  async init() {
    logger.info('Initializing options page');
    
    // Load current settings
    await this.loadSettings();
    
    // Load cache statistics
    await this.loadCacheStats();
    
    // Set up event listeners
    this.setupEventListeners();
    
    logger.info('Options page initialization completed');
  }
  
  // Load settings from storage and populate form
  async loadSettings() {
    const config = await ConfigManager.loadSettings();
    if (config) {
      // Populate form with loaded config
      FormHandler.populateForm(config, this.domElements);
      
      // Initialize model manager with config and change notification callback
      this.modelManager.init(config, () => this.markAsChanged());
      
      // Render quick inputs
      QuickInputsManager.renderQuickInputs(config.quickInputs || [], this.domElements);
      
      // Toggle appropriate settings based on current values
      FormHandler.toggleExtractionMethodSettings(this.domElements, this.domGroups);
      
      // Check and display configuration health
      this.checkConfigurationHealth();
    }
  }

  // Check configuration health and display storage usage
  async checkConfigurationHealth() {
    try {
      logger.info('Checking configuration health');
      const healthInfo = await ConfigManager.checkConfigurationHealth();
      
      if (healthInfo) {
        ConfigManager.displayStorageUsage(healthInfo, this.domElements);
        
        // Log warnings if approaching limits
        const usagePercent = Math.round((healthInfo.total / healthInfo.maxTotal) * 100);
        if (usagePercent > 80) {
          logger.warn(`Storage usage is high: ${usagePercent}%. Consider reducing configuration size.`);
        }
        
        // Check individual items
        const itemWarnThreshold = healthInfo.maxPerItem * 0.8;
        if (healthInfo.main > itemWarnThreshold) {
          logger.warn(`Main config size is approaching limit: ${healthInfo.main}/${healthInfo.maxPerItem}B`);
        }
        // Commented out quick inputs warning as it's not needed
        // if (healthInfo.quickInputs > itemWarnThreshold) {
        //   logger.warn(`Quick inputs size is approaching limit: ${healthInfo.quickInputs}/${healthInfo.maxPerItem}B`);
        // }
        if (healthInfo.systemPrompt > itemWarnThreshold) {
          logger.warn(`System prompt size is approaching limit: ${healthInfo.systemPrompt}/${healthInfo.maxPerItem}B`);
        }
      }
    } catch (error) {
      logger.error('Error checking configuration health:', error);
    }
  }
  
  // Mark form as changed (has unsaved changes)
  markAsChanged() {
    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
  }
  
  // Update save button visual state
  updateSaveButtonState() {
    const saveBtn = this.domElements.saveBtn;
    if (!saveBtn) return;
    
    if (this.hasUnsavedChanges) {
      saveBtn.classList.remove('saved');
      saveBtn.classList.remove('error');
    }
  }
  
  // Manual save settings with validation and visual feedback
  async saveSettings() {
    const saveBtn = this.domElements.saveBtn;
    if (!saveBtn) return;
    
    logger.info('Performing manual save');
    
    // Show saving state
    saveBtn.classList.add('saving');
    saveBtn.querySelector('span').textContent = 'Saving...';
    
    try {
      // Build config from form
      const config = ConfigManager.buildConfigFromForm(this.domElements, this.modelManager);
      
      // Get quick inputs and validate them
      const quickInputs = QuickInputsManager.getQuickInputs(this.domElements);
      config.quickInputs = quickInputs;
      
      // Save config
      const success = await ConfigManager.saveSettings(config);
      
      if (success) {
        logger.info('Settings saved successfully');
        this.hasUnsavedChanges = false;
        
        // Show success state
        saveBtn.classList.remove('saving');
        saveBtn.classList.add('saved');
        saveBtn.querySelector('span').textContent = 'Saved!';
        
        // Update storage usage display after save
        this.checkConfigurationHealth();
        
        // Reset button state after 2 seconds
        setTimeout(() => {
          if (saveBtn.classList.contains('saved')) {
            saveBtn.classList.remove('saved');
            saveBtn.querySelector('span').textContent = 'Save';
          }
        }, 2000);
        
      } else {
        logger.error('Failed to save settings');
        this.showSaveError(saveBtn);
      }
    } catch (error) {
      logger.error('Error during save:', error);
      this.showSaveError(saveBtn);
    }
  }
  
  // Show error state on save button
  showSaveError(saveBtn) {
    saveBtn.classList.remove('saving');
    saveBtn.classList.add('error');
    saveBtn.querySelector('span').textContent = 'Error';
    
    // Reset button state after 3 seconds
    setTimeout(() => {
      saveBtn.classList.remove('error');
      saveBtn.querySelector('span').textContent = 'Save';
    }, 3000);
  }
  
  // Set up all event listeners
  setupEventListeners() {
    // Default extraction method toggle
    this.domElements.defaultExtractionMethod.addEventListener('change', () => {
      FormHandler.toggleExtractionMethodSettings(this.domElements, this.domGroups);
      this.markAsChanged();
    });
    
    // Set up change listeners for form inputs
    this.setupChangeListeners();
    
    // Save button click handler
    this.domElements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Model manager will handle its own event listeners and change notifications
    
    // Reset settings button
    this.domElements.resetBtn.addEventListener('click', () => {
      ConfigManager.resetSettings();
    });
    
    // Set up quick inputs event listeners
    QuickInputsManager.setupEventListeners(this.domElements, () => {
      this.markAsChanged();
    });

    // Clear Pages Cache button
    this.domElements.clearPagesCacheBtn.addEventListener('click', () => {
      this.clearPagesCache();
    });

    // Clear Chats Cache button
    this.domElements.clearChatsCacheBtn.addEventListener('click', () => {
      this.clearChatsCache();
    });

    // Export configuration button
    this.domElements.exportConfigBtn.addEventListener('click', () => {
      this.exportConfiguration();
    });

    // Import configuration button
    this.domElements.importConfigBtn.addEventListener('click', () => {
      this.domElements.importConfigFile.click();
    });

    // Import configuration file input
    this.domElements.importConfigFile.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this.importConfiguration(file);
        // Reset file input
        event.target.value = '';
      }
    });
  }
  
  // Setup change listeners for form inputs
  setupChangeListeners() {
    const inputs = [
      this.domElements.jinaApiKey,
      this.domElements.jinaResponseTemplate,
      this.domElements.contentDisplayHeight,
      this.domElements.systemPrompt,
      this.domElements.defaultModelSelect
    ];
    
    inputs.forEach(input => {
      if (input) {
        const eventType = input.type === 'textarea' ? 'input' : 'change';
        input.addEventListener(eventType, () => {
          this.markAsChanged();
        });
      }
    });
  }
  
  // Load cache statistics and update the UI
  async loadCacheStats() {
    logger.info('Loading cache statistics');
    try {
      const items = await chrome.storage.local.get(null);
      // logger.debug('Retrieved items from chrome.storage.local:', JSON.stringify(items)); // Detailed log of all items
      let pageCacheCount = 0;
      let chatHistoryCount = 0;
      let pageStateCount = 0;
      for (const key in items) {
        if (Object.prototype.hasOwnProperty.call(items, key)) { // Check if key is own property
          // logger.debug(`Processing key: ${key}`); // Log each key being processed
          if (key.startsWith('readBotContent_')) {
            pageCacheCount++;
          } else if (key.startsWith('readBotChat_')) {
            chatHistoryCount++;
          } else if (key.startsWith('readBotPageState_')) {
            pageStateCount++;
          }
        } // Closing brace for hasOwnProperty check
      }
      this.domElements.cachedPagesDisplay.textContent = `${pageCacheCount} (${pageStateCount} states)`;
      this.domElements.cachedChatsDisplay.textContent = chatHistoryCount.toString();
      logger.info(`Cache stats loaded: ${pageCacheCount} pages, ${chatHistoryCount} chats, ${pageStateCount} page states`);
    } catch (error) {
      logger.error('Error loading cache statistics:', error);
      this.domElements.cachedPagesDisplay.textContent = 'Error';
      this.domElements.cachedChatsDisplay.textContent = 'Error';
    }
  }

  // Clear all page and chat history cache
  async clearAllCache() {
    logger.info('Clearing all cache');
    try {
      const items = await chrome.storage.local.get(null);
      const keysToRemove = [];
      for (const key in items) {
        if (key.startsWith('readBotContent_') || key.startsWith('readBotChat_') || key.startsWith('readBotPageState_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        logger.info(`Removed ${keysToRemove.length} items from cache.`);
      } else {
        logger.info('No cache items to remove.');
      }
      
      // Reload cache stats to update UI
      await this.loadCacheStats();
      
      // Optionally, show a notification
      // FormHandler.showNotification('Cache cleared successfully!', this.domElements); // Assuming a generic notification handler
      alert('All cache has been cleared.'); // Simple alert for now
    } catch (error) {
      logger.error('Error clearing cache:', error);
      alert('Error clearing cache. See console for details.');
    }
  }

  // Clear only page content cache
  async clearPagesCache() {
    logger.info('Clearing page content cache');
    try {
      const items = await chrome.storage.local.get(null);
      const keysToRemove = [];
      for (const key in items) {
        if (key.startsWith('readBotContent_') || key.startsWith('readBotPageState_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        logger.info(`Removed ${keysToRemove.length} page items from cache.`);
        alert(`${keysToRemove.length} page cache items (including page states) have been cleared.`);
      } else {
        logger.info('No page cache items to remove.');
        alert('No page cache items to remove.');
      }
      await this.loadCacheStats();
    } catch (error) {
      logger.error('Error clearing page cache:', error);
      alert('Error clearing page cache. See console for details.');
    }
  }

  // Clear only chat history cache
  async clearChatsCache() {
    logger.info('Clearing chat history cache');
    try {
      const items = await chrome.storage.local.get(null);
      const keysToRemove = [];
      for (const key in items) {
        if (key.startsWith('readBotChat_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        logger.info(`Removed ${keysToRemove.length} chat items from cache.`);
        alert(`${keysToRemove.length} chat cache items have been cleared.`);
      } else {
        logger.info('No chat cache items to remove.');
        alert('No chat cache items to remove.');
      }
      await this.loadCacheStats();
    } catch (error) {
      logger.error('Error clearing chat cache:', error);
      alert('Error clearing chat cache. See console for details.');
    }
  }

  // Export configuration to JSON file
  async exportConfiguration() {
    logger.info('Exporting configuration');
    try {
      await ConfigManager.exportConfiguration(this.domElements, this.modelManager);
    } catch (error) {
      logger.error('Error in export configuration:', error);
      alert('Failed to export configuration. Please check the console for details.');
    }
  }

  // Import configuration from JSON file
  async importConfiguration(file) {
    logger.info('Importing configuration');
    try {
      await ConfigManager.importConfiguration(file, this.domElements, this.modelManager);
    } catch (error) {
      logger.error('Error in import configuration:', error);
      alert('Failed to import configuration. Please check the console for details.');
    }
  }
}

// Initialize the options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const optionsPage = new OptionsPage();
  optionsPage.init();
}); 