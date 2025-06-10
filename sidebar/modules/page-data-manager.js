/**
 * page-data-manager.js - Page data loading and management
 * Handles loading current page data and managing page state
 */

import { createLogger, isRestrictedPage } from './utils.js';
import * as StateManager from './state-manager.js';
import * as UIManager from './ui-manager.js';
import * as MessageHandler from './message-handler.js';
import * as ChatManager from './chat-manager.js';

const logger = createLogger('PageDataManager');

/**
 * Load current page data
 * @returns {Promise<void>}
 */
const loadCurrentPageData = async () => {
  // Get current tab URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const url = tabs[0].url;
    StateManager.updateStateItem('currentUrl', url);
    logger.info('Current URL:', url);
    
    // Check if it's a restricted page
    if (isRestrictedPage(url)) {
      UIManager.hideLoading();
      UIManager.showRestrictedPageMessage();
      return;
    }
    
    // Load page state first
    try {
      const pageState = await StateManager.loadPageState(url);
      if (pageState) {
        StateManager.applyPageState(pageState);
        // Update UI to reflect loaded state
        UIManager.updateIncludePageContentUI(StateManager.getStateItem('includePageContent'));
        logger.info('Page state loaded and applied');
      }
    } catch (error) {
      logger.warn('Failed to load page state, using defaults:', error);
    }
    
    // Show loading status
    UIManager.showLoading('Loading page data...');
    
    // Load page data from background script
    try {
      const response = await MessageHandler.getPageData(url);
      
      if (response.success) {
        // Data loaded successfully
        await handlePageDataLoaded(response.data);
      } else {
        // Load data error
        UIManager.showExtractionError(response.error);
      }
    } catch (error) {
      logger.error('Error requesting page data:', error);
      UIManager.showExtractionError('Failed to communicate with the background script. Details: ' + (error.message || 'Unknown error'));
    }
  } else {
    UIManager.showExtractionError('No active tab found');
  }
};

/**
 * Handle page data loaded
 * @param {Object} data - Page data
 * @returns {Promise<void>}
 */
const handlePageDataLoaded = async (data) => {
  const elements = UIManager.getAllElements();
  UIManager.hideLoading();
  
  // Re-enable buttons in case they were disabled on restricted page
  elements.jinaExtractBtn.disabled = false;
  elements.readabilityExtractBtn.disabled = false;
  elements.userInput.disabled = false;
  elements.sendBtn.disabled = false;
  
  // Update extracted content and display
  if (data && data.content) {
    StateManager.updateStateItem('extractedContent', data.content);
    await UIManager.displayExtractedContent(data.content);
    elements.copyContentBtn.classList.add('visible');
    elements.copyContentBtn.disabled = false;
  } else {
    StateManager.updateStateItem('extractedContent', '');
    UIManager.showExtractionError('No content could be extracted.');
    elements.copyContentBtn.classList.remove('visible');
    elements.copyContentBtn.disabled = true;
  }
  
  // Update extraction method UI based on actual method used
  if (data && data.extractionMethod) {
    StateManager.updateStateItem('currentExtractionMethod', data.extractionMethod);
    UIManager.updateExtractionButtonUI(data.extractionMethod);
    logger.info(`Content displayed using method: ${data.extractionMethod}`);
  }

  // Use service worker provided chat history
  if (data && data.chatHistory) {
    logger.info(`Received chat history with ${data.chatHistory.length} messages from service worker`);
    ChatManager.displayChatHistory(elements.chatContainer, data.chatHistory);
    
    // Fix existing message layouts
    setTimeout(() => {
      ChatManager.fixExistingMessageLayouts(elements.chatContainer);
    }, 100);
  } else {
    logger.info('No chat history received from service worker');
    elements.chatContainer.innerHTML = '';
  }
  
  // Enable or disable retry button based on success or failure
  elements.retryExtractBtn.disabled = !data.content;
  if (data.content) {
    elements.retryExtractBtn.classList.remove('disabled');
    elements.retryExtractBtn.classList.add('visible');
  } else {
    elements.retryExtractBtn.classList.add('disabled');
    // Keep visible to allow retry
  }
};

/**
 * Handle tab change with auto-loading
 * @param {string} url - New URL
 * @returns {Promise<void>}
 */
const handleTabChanged = async (url) => {
  // Tab changed, if URL is different, reload data
  if (url !== StateManager.getStateItem('currentUrl')) {
    logger.info(`Tab changed. New URL: ${url}`);
    StateManager.updateStateItem('currentUrl', url);
    await loadCurrentPageData();
  }
};

/**
 * Handle auto-load cached content
 * @param {string} url - URL
 * @param {Object} data - Page data
 * @returns {Promise<void>}
 */
const handleAutoLoadContent = async (url, data) => {
  // Auto-load cached content for new URL
  if (url !== StateManager.getStateItem('currentUrl')) {
    logger.info(`Auto-loading cached content for URL: ${url}`);
    StateManager.updateStateItem('currentUrl', url);
    
    // Load page state first
    try {
      const pageState = await StateManager.loadPageState(url);
      if (pageState) {
        StateManager.applyPageState(pageState);
        // Update UI to reflect loaded state
        UIManager.updateIncludePageContentUI(StateManager.getStateItem('includePageContent'));
        logger.info('Page state loaded and applied for auto-loaded content');
      }
    } catch (error) {
      logger.warn('Failed to load page state for auto-loaded content, using defaults:', error);
    }
    
    await handlePageDataLoaded(data);
  }
};

/**
 * Handle auto-extract content
 * @param {string} url - URL
 * @param {string} extractionMethod - Extraction method
 * @returns {Promise<void>}
 */
const handleAutoExtractContent = async (url, extractionMethod) => {
  // Auto-extract content for new URL
  if (url !== StateManager.getStateItem('currentUrl')) {
    logger.info(`Auto-extracting content for URL: ${url}`);
    StateManager.updateStateItem('currentUrl', url);
    StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
    
    // Check if it's a restricted page
    if (isRestrictedPage(url)) {
      UIManager.hideLoading();
      UIManager.showRestrictedPageMessage();
      return;
    }
    
    // Load page state first
    try {
      const pageState = await StateManager.loadPageState(url);
      if (pageState) {
        StateManager.applyPageState(pageState);
        // Update UI to reflect loaded state
        UIManager.updateIncludePageContentUI(StateManager.getStateItem('includePageContent'));
        logger.info('Page state loaded and applied for auto-extract content');
      }
    } catch (error) {
      logger.warn('Failed to load page state for auto-extract content, using defaults:', error);
    }
    
    // Show loading and extract content
    UIManager.showLoading('Extracting content...');
    await loadCurrentPageData();
  }
};

/**
 * Handle tab update (legacy support)
 * @param {string} url - New URL
 * @returns {Promise<void>}
 */
const handleTabUpdated = async (url) => {
  // Old-style fallback for tab update
  if (url !== StateManager.getStateItem('currentUrl')) {
    logger.info(`Tab updated. New URL: ${url}`);
    StateManager.updateStateItem('currentUrl', url);
    await loadCurrentPageData();
  }
};

export {
  loadCurrentPageData,
  handlePageDataLoaded,
  handleTabChanged,
  handleAutoLoadContent,
  handleAutoExtractContent,
  handleTabUpdated
}; 