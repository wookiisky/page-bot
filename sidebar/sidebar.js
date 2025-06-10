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
import * as QuickInputs from './components/quick-inputs.js';
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
  
  // Load quick input buttons with handler
  await QuickInputs.loadQuickInputs(
    elements.quickInputsContainer,
    (displayText, sendTextTemplate) => handleQuickInputClick(displayText, sendTextTemplate)
  );
  
  // Set up event listeners
  EventHandler.setupEventListeners(
    elements,
    modelSelector,
    (displayText, sendTextTemplate) => handleQuickInputClick(displayText, sendTextTemplate)
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
 * Handle quick input click
 * @param {string} displayText - Display text
 * @param {string} sendTextTemplate - Send text template
 */
const handleQuickInputClick = async (displayText, sendTextTemplate) => {
  const elements = UIManager.getAllElements();
  
  await ChatManager.handleQuickInputClick(
    displayText,
    sendTextTemplate,
    elements.chatContainer,
    elements.sendBtn,
    modelSelector,
    () => logger.info('Quick input message saved successfully')
  );
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
        (response) => {
          // Get updated dialog history from DOM
          const chatHistory = ChatHistory.getChatHistoryFromDOM(UIManager.getElement('chatContainer'));
          
          // Save updated chat history
          chrome.runtime.sendMessage({
            type: 'SAVE_CHAT_HISTORY',
            url: StateManager.getStateItem('currentUrl'),
            chatHistory: chatHistory
          }).then(() => {
            logger.info('Chat history saved after adding assistant response');
          }).catch(error => {
            logger.error('Failed to save chat history after adding assistant response:', error);
          });
          
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