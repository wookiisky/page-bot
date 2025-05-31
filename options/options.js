// Read Bot Options Page JavaScript
// Main entry point for the options page

// Import modules
import { domElements, domGroups } from './modules/dom-elements.js';
import { ConfigManager } from './modules/config-manager.js';
import { FormHandler } from './modules/form-handler.js';
import { QuickInputsManager } from './modules/quick-inputs.js';

// Import logger module
const logger = window.logger ? window.logger.createModuleLogger('Options') : console;

// Main Options Page Controller
class OptionsPage {
  
  constructor() {
    this.domElements = domElements;
    this.domGroups = domGroups;
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
      
      // Render quick inputs
      QuickInputsManager.renderQuickInputs(config.quickInputs || [], this.domElements);
      
      // Toggle appropriate settings based on current values
      FormHandler.toggleExtractionMethodSettings(this.domElements, this.domGroups);
      FormHandler.toggleLlmSettings(this.domElements, this.domGroups);
    }
  }
  
  // Set up all event listeners
  setupEventListeners() {
    // Default extraction method toggle
    this.domElements.defaultExtractionMethod.addEventListener('change', () => {
      FormHandler.toggleExtractionMethodSettings(this.domElements, this.domGroups);
    });
    
    // Default LLM provider toggle
    this.domElements.defaultLlmProvider.addEventListener('change', () => {
      FormHandler.toggleLlmSettings(this.domElements, this.domGroups);
    });
    
    // Save settings button
    this.domElements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Reset settings button
    this.domElements.resetBtn.addEventListener('click', () => {
      ConfigManager.resetSettings();
    });
    
    // Set up quick inputs event listeners
    QuickInputsManager.setupEventListeners(this.domElements);

    // Clear Pages Cache button
    this.domElements.clearPagesCacheBtn.addEventListener('click', () => {
      this.clearPagesCache();
    });

    // Clear Chats Cache button
    this.domElements.clearChatsCacheBtn.addEventListener('click', () => {
      this.clearChatsCache();
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
      for (const key in items) {
        if (Object.prototype.hasOwnProperty.call(items, key)) { // Check if key is own property
          // logger.debug(`Processing key: ${key}`); // Log each key being processed
          if (key.startsWith('readBotContent_')) {
            pageCacheCount++;
          } else if (key.startsWith('readBotChat_')) {
            chatHistoryCount++;
          }
        } // Closing brace for hasOwnProperty check
      }
      this.domElements.cachedPagesDisplay.textContent = pageCacheCount.toString();
      this.domElements.cachedChatsDisplay.textContent = chatHistoryCount.toString();
      logger.info(`Cache stats loaded: ${pageCacheCount} pages, ${chatHistoryCount} chats`);
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
        if (key.startsWith('readBotContent_') || key.startsWith('readBotChat_')) {
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
        if (key.startsWith('readBotContent_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        logger.info(`Removed ${keysToRemove.length} page items from cache.`);
        alert(`${keysToRemove.length} page cache items have been cleared.`);
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
  
  // Save settings to storage
  async saveSettings() {
    // Build config from form
    const config = ConfigManager.buildConfigFromForm(this.domElements);
    
    // Add quick inputs to config
    config.quickInputs = QuickInputsManager.getQuickInputs(this.domElements);
    
    // Save config
    const success = await ConfigManager.saveSettings(config);
    
    if (success) {
      FormHandler.showSaveNotification(this.domElements);
    }
  }
}

// Initialize the options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const optionsPage = new OptionsPage();
  optionsPage.init();
}); 