/**
 * tab-manager.js - Tab-based Quick Input management
 * Manages multiple conversation tabs with independent chat histories
 */

import { createLogger } from '../modules/utils.js';

const logger = createLogger('TabManager');

// Version identifier for debugging
logger.info('TabManager v1.2 loaded - Enhanced error handling');

// Tab state management
let tabs = [];
let activeTabId = 'chat'; // Default chat tab
let onTabClickHandler = null;

/**
 * Check if all required dependencies are available
 * @returns {boolean} Whether dependencies are available
 */
const checkDependencies = () => {
  const missing = [];
  
  if (!window.StateManager) missing.push('StateManager');
  if (!window.ChatHistory) missing.push('ChatHistory');
  if (!window.ChatManager) missing.push('ChatManager');
  if (!chrome || !chrome.runtime) missing.push('chrome.runtime');
  
  if (missing.length > 0) {
    logger.error('Tab Manager missing dependencies:', missing);
    return false;
  }
  
  return true;
};

/**
 * Initialize tab manager
 * @param {HTMLElement} container - Tab container element  
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {Function} onTabClick - Tab click handler function
 */
const initTabManager = (container, chatContainer, onTabClick) => {
  if (!container) {
    logger.error('Tab container not found');
    return;
  }
  
  onTabClickHandler = onTabClick;
  
  // Initialize with default chat tab
  tabs = [{
    id: 'chat',
    displayText: 'Chat',
    isDefault: true,
    isActive: true,
    hasInitialized: true,
    quickInputId: null
  }];
  
  renderTabs(container);
  logger.info('Tab manager initialized with default chat tab');
};

/**
 * Load tabs from configuration
 * @param {HTMLElement} container - Tab container element
 * @param {HTMLElement} chatContainer - Chat container element  
 * @param {Function} onTabClick - Tab click handler function
 */
const loadTabs = async (container, chatContainer, onTabClick) => {
  try {
    const config = await window.StateManager.getConfig();
    
    if (!config || !config.quickInputs || config.quickInputs.length === 0) {
      logger.info('No quick inputs configured, using default chat only');
      initTabManager(container, chatContainer, onTabClick);
      return;
    }
    
    onTabClickHandler = onTabClick;
    
    // Create tabs array starting with default chat tab
    tabs = [{
      id: 'chat',
      displayText: 'Chat', 
      isDefault: true,
      isActive: true,
      hasInitialized: true,
      quickInputId: null
    }];
    
    // Add quick input tabs
    config.quickInputs.forEach((quickInput, index) => {
      const tabId = quickInput.id || `quick-${index}`;
      tabs.push({
        id: tabId,
        displayText: quickInput.displayText,
        sendText: quickInput.sendText,
        isDefault: false,
        isActive: false,
        hasInitialized: false,
        quickInputId: tabId
      });
    });
    
    activeTabId = 'chat';
    renderTabs(container);
    
    logger.info(`Loaded ${tabs.length} tabs (1 default + ${config.quickInputs.length} quick inputs)`);
  } catch (error) {
    logger.error('Error loading tabs:', error);
    // Fallback to default chat only
    initTabManager(container, chatContainer, onTabClick);
  }
};

/**
 * Render tabs in the container
 * @param {HTMLElement} container - Tab container element
 */
const renderTabs = (container) => {
  if (!container) return;
  
  container.innerHTML = '';
  container.className = 'tab-container';
  
  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab ${tab.isActive ? 'active' : ''}`;
    tabElement.dataset.tabId = tab.id;
    tabElement.textContent = tab.displayText;
    
    // Add click handler
    tabElement.addEventListener('click', () => handleTabClick(tab.id));
    
    container.appendChild(tabElement);
  });
};

/**
 * Handle tab click
 * @param {string} tabId - Tab ID to activate
 */
const handleTabClick = async (tabId) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) {
    logger.error(`Tab not found: ${tabId}`);
    return;
  }
  
  // Update active tab
  tabs.forEach(t => t.isActive = false);
  tab.isActive = true;
  activeTabId = tabId;
  
  // Re-render tabs to update active state
  const container = document.querySelector('.tab-container');
  if (container) {
    renderTabs(container);
  }
  
  // Load chat history for this tab and get the result
  const chatHistory = await loadTabChatHistory(tabId);
  
  // Handle quick input auto-send logic
  if (!tab.isDefault && tab.sendText) {
    // Check if this tab has existing chat history
    const hasExistingHistory = chatHistory && chatHistory.length > 0;
    
    if (!hasExistingHistory && !tab.hasInitialized) {
      // Only auto-send if no existing history and not yet initialized
      tab.hasInitialized = true;
      
      // For Quick Input auto-send, always force include page content (but don't change UI state)
      const forceIncludePageContent = true;
      
      // Auto-send the quick input message with forced include page content
      if (onTabClickHandler) {
        logger.info(`Auto-sending Quick Input for tab ${tabId} (no existing history) with forced page content inclusion`);
        onTabClickHandler(tab.displayText, tab.sendText, tabId, true, forceIncludePageContent);
      }
    } else {
      // Tab has existing history or already initialized, just switch without auto-send
      if (hasExistingHistory) {
        logger.info(`Tab ${tabId} has existing chat history (${chatHistory.length} messages), skipping auto-send`);
      } else {
        logger.info(`Tab ${tabId} already initialized, skipping auto-send`);
      }
      
      if (onTabClickHandler) {
        // Normal tab switch without auto-send
        onTabClickHandler(null, null, tabId, false);
      }
    }
  } else if (onTabClickHandler) {
    // Default chat tab or tab without sendText - normal switch
    onTabClickHandler(null, null, tabId, false);
  }
  
  logger.info(`Switched to tab: ${tabId}`);
};

/**
 * Load chat history for a specific tab and restore loading state
 * @param {string} tabId - Tab ID
 * @returns {Promise<Array>} Chat history array
 */
const loadTabChatHistory = async (tabId) => {
  try {
    const currentUrl = window.StateManager.getStateItem('currentUrl');
    if (!currentUrl) {
      logger.warn('No current URL, cannot load tab chat history');
      return [];
    }
    
    const cacheKey = `${currentUrl}#${tabId}`;
    logger.info(`Loading chat history for tab ${tabId} from key: ${cacheKey}`);
    
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CHAT_HISTORY',
      url: cacheKey
    });
    
    const chatContainer = document.getElementById('chatContainer');
    
    if (response && response.type === 'CHAT_HISTORY_LOADED') {
      // Handle both empty and non-empty chat history
      const chatHistory = response.chatHistory || [];
      
      // Display the history in chat container
      if (chatContainer && window.ChatHistory && window.ChatManager) {
        window.ChatHistory.displayChatHistory(
          chatContainer, 
          chatHistory,
          window.ChatManager.appendMessageToUI
        );
        logger.info(`Successfully loaded and displayed chat history for tab ${tabId}: ${chatHistory.length} messages`);
      } else {
        logger.warn(`Cannot display chat history for tab ${tabId}: missing required components`);
      }
      
      // Check for cached loading state and restore if needed
      await checkAndRestoreLoadingState(currentUrl, tabId, chatContainer);
      
      // Return the chat history for caller to use
      return chatHistory;
    } else {
      // Clear chat container for new tab
      if (chatContainer) {
        chatContainer.innerHTML = '';
      }
      
      // Check for cached loading state even if no chat history
      await checkAndRestoreLoadingState(currentUrl, tabId, chatContainer);
      
      // Improved response logging
      const responseInfo = response ? {
        type: response.type || 'unknown',
        hasHistory: !!response.chatHistory,
        historyLength: response.chatHistory ? response.chatHistory.length : 0
      } : 'null response';
      
      logger.info(`No chat history found for tab ${tabId}. Response:`, responseInfo);
      return [];
    }
  } catch (error) {
    // Enhanced error logging
    const errorInfo = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      tabId: tabId,
      currentUrl: window.StateManager ? window.StateManager.getStateItem('currentUrl') : 'unknown'
    };
    
    logger.error('Exception while loading tab chat history:', errorInfo);
    return [];
  }
};

/**
 * Check and restore loading state for a tab
 * @param {string} currentUrl - Current page URL
 * @param {string} tabId - Tab ID
 * @param {HTMLElement} chatContainer - Chat container element
 */
const checkAndRestoreLoadingState = async (currentUrl, tabId, chatContainer) => {
  try {
    // Request loading state from background script
    const loadingStateResponse = await chrome.runtime.sendMessage({
      type: 'GET_LOADING_STATE',
      url: currentUrl,
      tabId: tabId
    });
    
         if (loadingStateResponse && loadingStateResponse.loadingState) {
       const loadingState = loadingStateResponse.loadingState;
       logger.info(`Found cached loading state for tab ${tabId}:`, loadingState.status);
       
       if (loadingState.status === 'loading') {
         // Show loading indicator
         if (chatContainer && window.ChatManager) {
           window.ChatManager.appendMessageToUI(
             chatContainer,
             'assistant',
             '<div class="spinner"></div>',
             null,
             true
           );
           logger.info(`Restored loading UI for tab ${tabId}`);
         }
       } else if (loadingState.status === 'timeout') {
         // Show timeout message
         if (chatContainer && window.ChatManager) {
           window.ChatManager.appendMessageToUI(
             chatContainer,
             'assistant',
             '<span style="color: var(--error-color);">Request timed out after 10 minutes. Please try again.</span>'
           );
           logger.info(`Restored timeout message for tab ${tabId}`);
         }
       } else if (loadingState.status === 'error' && loadingState.error) {
         // Show error message
         if (chatContainer && window.ChatManager) {
           window.ChatManager.appendMessageToUI(
             chatContainer,
             'assistant',
             `<span style="color: var(--error-color);">${loadingState.error}</span>`
           );
           logger.info(`Restored error message for tab ${tabId}`);
         }
       } else if (loadingState.status === 'completed') {
         // For completed status, the result should already be in chat history
         // No additional UI elements needed, just log for debugging
         logger.info(`Loading state is completed for tab ${tabId}, AI response should be in chat history`);
       }
       // Note: 'completed' status doesn't need special handling as the result 
       // should already be in chat history
     }
  } catch (error) {
    logger.error('Error checking loading state:', { currentUrl, tabId, error: error.message });
  }
};

/**
 * Save chat history for current active tab
 * @param {Array} chatHistory - Chat history array
 */
const saveCurrentTabChatHistory = async (chatHistory) => {
  logger.debug('saveCurrentTabChatHistory v1.2 called with enhanced error handling');
  
  // Check dependencies first
  if (!checkDependencies()) {
    logger.error('Cannot save tab chat history: missing dependencies');
    return false;
  }
  
  try {
    const currentUrl = window.StateManager.getStateItem('currentUrl');
    if (!currentUrl) {
      logger.warn('No current URL, cannot save tab chat history');
      return false;
    }
    
    // Validate chatHistory parameter
    if (!Array.isArray(chatHistory)) {
      logger.error('Invalid chat history provided for saving:', typeof chatHistory);
      return false;
    }
    
    const cacheKey = `${currentUrl}#${activeTabId}`;
    logger.info(`Attempting to save chat history for tab ${activeTabId} with ${chatHistory.length} messages to key: ${cacheKey}`);
    
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: cacheKey,
      chatHistory: chatHistory
    });
    
    logger.info(`Received response for tab ${activeTabId} save operation:`, response);
    
    if (response && response.type === 'CHAT_HISTORY_SAVED') {
      logger.info(`Successfully saved chat history for tab ${activeTabId}: ${chatHistory.length} messages`);
      return true;
    } else if (response && response.success === true) {
      // Handle case where backend reports success but with different response format
      logger.info(`Chat history saved successfully for tab ${activeTabId} (alternative success format): ${chatHistory.length} messages`);
      return true;
    } else {
      // Improved error logging with detailed response information
      const responseInfo = response ? {
        type: response.type || 'unknown',
        error: response.error || 'no error message',
        success: response.success || false,
        keys: Object.keys(response),
        fullResponse: JSON.stringify(response)
      } : 'null response';
      
      logger.error(`Failed to save tab chat history for ${activeTabId}. Response details:`, responseInfo);
      return false;
    }
  } catch (error) {
    // Enhanced error logging with more context
    const errorInfo = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      stack: error.stack || 'No stack trace',
      activeTabId: activeTabId,
      chatHistoryLength: Array.isArray(chatHistory) ? chatHistory.length : 'invalid'
    };
    
    logger.error('Exception while saving tab chat history:', errorInfo);
    return false;
  }
};

/**
 * Get current active tab
 * @returns {Object|null} Active tab object
 */
const getActiveTab = () => {
  return tabs.find(t => t.isActive) || null;
};

/**
 * Get current active tab ID
 * @returns {string} Active tab ID
 */
const getActiveTabId = () => {
  return activeTabId;
};

/**
 * Clear chat history for a specific tab
 * @param {string} tabId - Tab ID (optional, defaults to active tab)
 */
const clearTabChatHistory = async (tabId = null) => {
  const targetTabId = tabId || activeTabId;
  
  try {
    const currentUrl = window.StateManager.getStateItem('currentUrl');
    if (!currentUrl) {
      logger.warn('No current URL, cannot clear tab chat history');
      return false;
    }
    
    const cacheKey = `${currentUrl}#${targetTabId}`;
    logger.info(`Clearing chat history for tab ${targetTabId} with key: ${cacheKey}`);
    
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_URL_DATA',
      url: cacheKey,
      clearContent: false,
      clearChat: true
    });
    
    // Check response for success
    if (response && response.success !== false) {
      // If clearing active tab, also clear UI
      if (targetTabId === activeTabId) {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
          chatContainer.innerHTML = '';
        }
      }
      
      logger.info(`Successfully cleared chat history for tab ${targetTabId}`);
      return true;
    } else {
      // Log response details for debugging
      const responseInfo = response ? {
        type: response.type || 'unknown',
        success: response.success,
        error: response.error || 'no error message'
      } : 'null response';
      
      logger.error(`Failed to clear chat history for tab ${targetTabId}. Response:`, responseInfo);
      return false;
    }
  } catch (error) {
    // Enhanced error logging
    const errorInfo = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      targetTabId: targetTabId,
      activeTabId: activeTabId,
      currentUrl: window.StateManager ? window.StateManager.getStateItem('currentUrl') : 'unknown'
    };
    
    logger.error('Exception while clearing tab chat history:', errorInfo);
    return false;
  }
};

/**
 * Remove tab when quick input is deleted
 * @param {string} quickInputId - Quick input ID to remove
 */
const removeQuickInputTab = async (quickInputId) => {
  const tabIndex = tabs.findIndex(t => t.quickInputId === quickInputId);
  if (tabIndex === -1) {
    logger.warn(`Tab with quick input ID ${quickInputId} not found`);
    return;
  }
  
  const tab = tabs[tabIndex];
  
  // Clear chat history for this tab
  await clearTabChatHistory(tab.id);
  
  // Remove tab from array
  tabs.splice(tabIndex, 1);
  
  // If this was the active tab, switch to default chat tab
  if (tab.isActive) {
    await handleTabClick('chat');
  }
  
  // Re-render tabs
  const container = document.querySelector('.tab-container');
  if (container) {
    renderTabs(container);
  }
  
  logger.info(`Removed tab for quick input ${quickInputId}`);
};

export {
  initTabManager,
  loadTabs,
  handleTabClick,
  loadTabChatHistory,
  saveCurrentTabChatHistory,
  getActiveTab,
  getActiveTabId,
  clearTabChatHistory,
  removeQuickInputTab
}; 