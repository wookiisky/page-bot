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