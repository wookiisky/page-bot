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
 * Load current page data and restore loading state if needed
 */
const loadCurrentPageData = async () => {
  // Get current tab URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const tab = tabs[0];
    const url = tab.url;
    StateManager.updateStateItem('currentUrl', url);
    StateManager.updateStateItem('currentTabId', tab.id.toString());
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
    
    // After loading page data, check and restore loading state for current active tab
    await checkAndRestoreCurrentTabLoadingState();
    
  } else {
    UIManager.showExtractionError('No active tab found');
  }
};

/**
 * Check and restore loading state for current active tab
 */
const checkAndRestoreCurrentTabLoadingState = async () => {
  try {
    const currentUrl = window.StateManager.getStateItem('currentUrl');
    const currentTabId = window.StateManager.getStateItem('currentTabId');
    
    if (!currentUrl || !currentTabId) {
      logger.warn('Missing current URL or tab ID, cannot check loading state');
      return;
    }
    
    // Get active tab ID from TabManager
    const activeTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
    
    logger.info(`Checking loading state for URL: ${currentUrl}, TabId: ${currentTabId}, ActiveTab: ${activeTabId}`);
    
    // Use TabManager's loading state restoration if available
    if (window.TabManager && window.TabManager.checkAndRestoreLoadingState) {
      const chatContainer = document.getElementById('chatContainer');
      if (chatContainer) {
        await window.TabManager.checkAndRestoreLoadingState(currentUrl, activeTabId, chatContainer);
        logger.info('Loading state restoration completed via TabManager');
      }
    } else {
      // Fallback: direct loading state check
      await directLoadingStateCheck(currentUrl, activeTabId);
    }
    
  } catch (error) {
    logger.error('Error checking and restoring loading state:', error);
  }
};

/**
 * Direct loading state check (fallback method)
 */
const directLoadingStateCheck = async (currentUrl, tabId) => {
  try {
    // Request loading state from background script
    const loadingStateResponse = await chrome.runtime.sendMessage({
      type: 'GET_LOADING_STATE',
      url: currentUrl,
      tabId: tabId
    });
    
    if (loadingStateResponse && loadingStateResponse.loadingState) {
      const loadingState = loadingStateResponse.loadingState;
      logger.info(`Found cached loading state for current tab:`, loadingState.status);
      
      const chatContainer = document.getElementById('chatContainer');
      if (!chatContainer || !window.ChatManager) {
        logger.warn('ChatContainer or ChatManager not available for loading state restoration');
        return;
      }
      
      if (loadingState.status === 'loading') {
        // Show loading indicator
        window.ChatManager.appendMessageToUI(
          chatContainer,
          'assistant',
          '<div class="spinner"></div>',
          null,
          true
        );
        logger.info('Restored loading UI for current tab');
        
        // Set up reconnection listener for ongoing LLM stream
        setupStreamReconnection(currentUrl, tabId);
        
      } else if (loadingState.status === 'timeout') {
        // Show timeout message
        window.ChatManager.appendMessageToUI(
          chatContainer,
          'assistant',
          '<span style="color: var(--error-color);">Request timed out after 10 minutes. Please try again.</span>'
        );
        logger.info('Restored timeout message for current tab');
        
      } else if (loadingState.status === 'error' && loadingState.error) {
        // Show error message
        window.ChatManager.appendMessageToUI(
          chatContainer,
          'assistant',
          `<span style="color: var(--error-color);">${loadingState.error}</span>`
        );
        logger.info('Restored error message for current tab');
        
      } else if (loadingState.status === 'completed') {
        // For completed status, the result should already be in chat history
        logger.info('Loading state is completed, AI response should be in chat history');
      }
    }
  } catch (error) {
    logger.error('Error in direct loading state check:', error);
  }
};

/**
 * Set up stream reconnection for ongoing LLM requests
 */
const setupStreamReconnection = (currentUrl, tabId) => {
  logger.info(`Setting up stream reconnection for ${currentUrl}#${tabId}`);
  
  // The stream should continue automatically via the existing message listeners
  // No additional setup needed as the background service worker continues processing
  // and will send stream chunks/completion messages when available
  
  // Optional: Set up a periodic check to verify the loading state hasn't timed out
  const checkInterval = setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LOADING_STATE',
        url: currentUrl,
        tabId: tabId
      });
      
      if (response && response.loadingState) {
        const status = response.loadingState.status;
        if (status !== 'loading') {
          // Loading is no longer active, stop checking
          clearInterval(checkInterval);
          logger.info(`Stream reconnection check stopped, status: ${status}`);
        }
      } else {
        // No loading state found, stop checking
        clearInterval(checkInterval);
        logger.info('Stream reconnection check stopped, no loading state found');
      }
    } catch (error) {
      logger.error('Error during stream reconnection check:', error);
      clearInterval(checkInterval);
    }
  }, 5000); // Check every 5 seconds
  
  // Auto-cleanup after 15 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
    logger.info('Stream reconnection check auto-cleanup after 15 minutes');
  }, 15 * 60 * 1000);
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

  // Load chat history for current tab
  if (window.TabManager && window.TabManager.loadTabChatHistory && window.TabManager.getActiveTabId) {
    const activeTabId = window.TabManager.getActiveTabId();
    await window.TabManager.loadTabChatHistory(activeTabId);
    logger.info(`Loaded chat history for active tab: ${activeTabId}`);
    
    // Fix existing message layouts
    setTimeout(() => {
      ChatManager.fixExistingMessageLayouts(elements.chatContainer);
    }, 100);
  } else {
    // Fallback to original method if TabManager not available
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
  checkAndRestoreCurrentTabLoadingState,
  directLoadingStateCheck,
  setupStreamReconnection,
  handlePageDataLoaded,
  handleTabChanged,
  handleAutoLoadContent,
  handleAutoExtractContent,
  handleTabUpdated
}; 