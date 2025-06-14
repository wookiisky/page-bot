/**
 * sidebar.js - Main entry point for Page Bot sidebar
 * Integrates all modules and manages application logic flow
 */

// Import all modules
import { createLogger } from './modules/utils.js';
import * as StateManager from './modules/state-manager.js';
import * as UIManager from './modules/ui-manager.js';
import * as MessageHandler from './modules/message-handler.js';
import * as ChatManager from './modules/chat-manager.js';
import * as ResizeHandler from './modules/resize-handler.js';
import * as ImageHandler from './modules/image-handler.js';
import * as TabManager from './components/tab-manager.js';
import * as ChatHistory from './modules/chat-history.js';
import * as PageDataManager from './modules/page-data-manager.js';
import * as EventHandler from './modules/event-handler.js';
import { ModelSelector } from './modules/model-selector.js';

// Create logger
const logger = createLogger('Sidebar');

// Global variables
let modelSelector = null;

// Global utility functions for other modules
window.StateManager = StateManager;
window.MessageHandler = MessageHandler;
window.ChatHistory = ChatHistory;
window.ImageHandler = ImageHandler;
window.ChatManager = ChatManager;
window.TabManager = TabManager;

// Initialize when DOM elements are loaded
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Side panel loaded');
  
  // Initialize UI element references
  const elements = UIManager.initElements();
  
  // Apply configured panel size
  const config = await StateManager.getConfig();
  ResizeHandler.applyPanelSize(config);
  
  // Reset content section height to configured default
  await ResizeHandler.resetContentSectionHeight(elements.contentSection, config);
  
  // Load current page data
  await PageDataManager.loadCurrentPageData();
  
  // Initialize model selector
  modelSelector = new ModelSelector();
  
  // Load tabs with handler
  await TabManager.loadTabs(
    elements.tabContainer,
    elements.chatContainer,
    (displayText, sendTextTemplate, tabId, isAutoSend, forceIncludePageContent) => handleTabAction(displayText, sendTextTemplate, tabId, isAutoSend, forceIncludePageContent)
  );
  
  // Set up event listeners
  EventHandler.setupEventListeners(
    elements,
    modelSelector,
    (displayText, sendTextTemplate) => handleTabAction(displayText, sendTextTemplate, TabManager.getActiveTabId(), true, null)
  );
  
  // Set up message listeners
  setupMessageListeners();
  
  // Set up message buttons scroll effect
  EventHandler.setupMessageButtonsScroll(elements.chatContainer);
  
  // Set initial button state
  elements.includePageContentBtn.setAttribute('data-enabled', StateManager.getStateItem('includePageContent') ? 'true' : 'false');
  
  // Initialize icon layout
  UIManager.updateIconsLayout(elements.userInput.offsetHeight);
  
  // Add default layout class
  elements.buttonGroup.classList.add('layout-row');
  
  logger.info('Sidebar initialization completed');
});

/**
 * Handle tab action (switch or quick input)
 * @param {string} displayText - Display text
 * @param {string} sendTextTemplate - Send text template
 * @param {string} tabId - Tab ID
 * @param {boolean} isAutoSend - Whether this is an auto-send action
 * @param {boolean} forceIncludePageContent - Force include page content for first-time quick input
 */
const handleTabAction = async (displayText, sendTextTemplate, tabId, isAutoSend, forceIncludePageContent = null) => {
  const elements = UIManager.getAllElements();
  
  logger.info(`Tab action: ${tabId}, isAutoSend: ${isAutoSend}, displayText: ${displayText}, forceIncludePageContent: ${forceIncludePageContent}`);
  
  // If this is just a tab switch without auto-send, don't send message
  if (!isAutoSend || !sendTextTemplate) {
    logger.info('Tab switched without message sending');
    return;
  }
  
  // For first-time quick input, temporarily override include page content setting
  let originalIncludePageContent = null;
  if (forceIncludePageContent !== null) {
    originalIncludePageContent = StateManager.getStateItem('includePageContent');
    StateManager.updateStateItem('includePageContent', forceIncludePageContent);
    logger.info(`Temporarily set includePageContent to ${forceIncludePageContent} for first-time quick input`);
  }
  
  try {
    // Handle quick input auto-send
    await ChatManager.handleQuickInputClick(
      displayText,
      sendTextTemplate,
      elements.chatContainer,
      elements.sendBtn,
      modelSelector,
      async () => {
        // Save chat history for current tab
        const chatHistory = ChatHistory.getChatHistoryFromDOM(elements.chatContainer);
        await TabManager.saveCurrentTabChatHistory(chatHistory);
        logger.info('Tab chat history saved successfully');
      }
    );
  } finally {
    // Restore original include page content setting if it was overridden
    if (originalIncludePageContent !== null) {
      StateManager.updateStateItem('includePageContent', originalIncludePageContent);
      logger.info(`Restored includePageContent to ${originalIncludePageContent}`);
    }
  }
};

/**
 * Set message listeners
 */
function setupMessageListeners() {
  MessageHandler.setupMessageListeners({
    onStreamChunk: (chunk) => {
      logger.debug('Received LLM_STREAM_CHUNK:', chunk);
      ChatManager.handleStreamChunk(UIManager.getElement('chatContainer'), chunk);
    },
    
    onStreamEnd: (fullResponse) => {
      logger.debug('Received LLM_STREAM_END');
      ChatManager.handleStreamEnd(
        UIManager.getElement('chatContainer'),
        fullResponse,
        async (response) => {
          // Get updated dialog history from DOM
          const chatHistory = ChatHistory.getChatHistoryFromDOM(UIManager.getElement('chatContainer'));
          
          // Save updated chat history for current tab
          await TabManager.saveCurrentTabChatHistory(chatHistory);
          logger.info('Tab chat history saved after adding assistant response');
          
          // Re-enable send button
          UIManager.getElement('sendBtn').disabled = false;
        }
      );
    },
    
    onLlmError: (error) => {
      ChatManager.handleLlmError(
        UIManager.getElement('chatContainer'),
        error,
        null,
        () => {
          // Re-enable send button
          UIManager.getElement('sendBtn').disabled = false;
        }
      );
    },
    
    onTabChanged: PageDataManager.handleTabChanged,
    
    onAutoLoadContent: PageDataManager.handleAutoLoadContent,
    
    onAutoExtractContent: PageDataManager.handleAutoExtractContent,
    
    onTabUpdated: PageDataManager.handleTabUpdated
  });
} 