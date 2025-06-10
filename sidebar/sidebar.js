/**
 * sidebar.js - Main entry point for Page Bot sidebar
 * Integrates all modules and manages application logic flow
 */

// Import all modules
import { createLogger, isRestrictedPage, showCopyToast } from './modules/utils.js';
import * as StateManager from './modules/state-manager.js';
import * as UIManager from './modules/ui-manager.js';
import * as MessageHandler from './modules/message-handler.js';
import * as ContentExtractor from './modules/content-extractor.js';
import * as ChatManager from './modules/chat-manager.js';
import * as ResizeHandler from './modules/resize-handler.js';
import * as ImageHandler from './modules/image-handler.js';
import * as QuickInputs from './components/quick-inputs.js';
import * as ChatMessage from './components/chat-message.js';
import * as ChatHistory from './modules/chat-history.js';
import { ModelSelector } from './modules/model-selector.js';

// Create logger
const logger = createLogger('Sidebar');

// Global variables
let modelSelector = null;

// Global utility functions for other modules
window.showCopyToast = showCopyToast;
window.StateManager = StateManager;
window.MessageHandler = MessageHandler;

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
  await loadCurrentPageData();
  
  // Initialize model selector
  modelSelector = new ModelSelector();
  
  // Load quick input buttons
  loadQuickInputs();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up message buttons scroll effect
  setupMessageButtonsScroll();
  
  // Set initial button state
  elements.includePageContentBtn.setAttribute('data-enabled', StateManager.getStateItem('includePageContent') ? 'true' : 'false');
  
  // Initialize icon layout
  UIManager.updateIconsLayout(elements.userInput.offsetHeight);
  
  // Add default layout class
  elements.buttonGroup.classList.add('layout-row');
  
  logger.info('Sidebar initialization completed');
});

/**
 * Load current page data
 */
async function loadCurrentPageData() {
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
}

/**
 * Handle page data loaded
 * @param {Object} data - Page data
 */
async function handlePageDataLoaded(data) {
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
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  const elements = UIManager.getAllElements();
  
  // Send message button
  elements.sendBtn.addEventListener('click', sendUserMessage);
  
  // Send message when Enter key is pressed in input field
  elements.userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });
  
  // Export conversation
  elements.exportBtn.addEventListener('click', exportConversation);
  
  // Clear conversation and context
  elements.clearBtn.addEventListener('click', clearConversationAndContext);
  
  // Extraction method buttons
  elements.jinaExtractBtn.addEventListener('click', () => switchExtractionMethod('jina'));
  elements.readabilityExtractBtn.addEventListener('click', () => switchExtractionMethod('readability'));
  
  // Include page content button
  elements.includePageContentBtn.addEventListener('click', toggleIncludePageContent);
  
  // Initialize image processing
  ImageHandler.initImageHandler(
    elements.userInput,
    elements.imagePreviewContainer,
    elements.imagePreview,
    elements.removeImageBtn
  );
  
  // Copy extracted content
  elements.copyContentBtn.addEventListener('click', copyExtractedContent);
  
  // Retry extraction
  elements.retryExtractBtn.addEventListener('click', () => {
    // Check if button is disabled
    if (elements.retryExtractBtn.disabled || elements.retryExtractBtn.classList.contains('disabled')) {
      return;
    }
    logger.info(`Retry button clicked, current extraction method: ${StateManager.getStateItem('currentExtractionMethod')}`);
    reExtractContent(StateManager.getStateItem('currentExtractionMethod'));
  });
  
  // Initialize content resize processing
  ResizeHandler.initContentResize(
    elements.contentSection,
    elements.resizeHandle,
    (height) => ResizeHandler.saveContentSectionHeight(height)
  );
  
  // Input field resize processing
  ResizeHandler.initInputResize(
    elements.userInput,
    elements.inputResizeHandle,
    (height) => UIManager.updateIconsLayout(height)
  );
  
  // Set message listeners
  setupMessageListeners();
}

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
    
    onTabChanged: (url) => {
      // Tab changed, if URL is different, reload data
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Tab changed. New URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        loadCurrentPageData();
      }
    },
    
    onAutoLoadContent: async (url, data) => {
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
        
        handlePageDataLoaded(data);
      }
    },
    
    onAutoExtractContent: async (url, extractionMethod) => {
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
        loadCurrentPageData();
      }
    },
    
    onTabUpdated: (url) => {
      // Old-style fallback for tab update
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Tab updated. New URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        loadCurrentPageData();
      }
    }
  });
}

/**
 * Send user message
 */
async function sendUserMessage() {
  const elements = UIManager.getAllElements();
  // Preserve line breaks in user input, only trim leading/trailing spaces and tabs
  const userText = elements.userInput.value.replace(/^[ \t]+|[ \t]+$/g, '');
  const imageBase64 = ImageHandler.getCurrentImage();
  
  if (!userText && !imageBase64) {
    logger.warn('Attempted to send an empty message');
    return;
  }

  // Clear input and disable send button
  elements.userInput.value = '';
  elements.sendBtn.disabled = true;
  
  // Create message timestamp for DOM and message object
  const messageTimestamp = Date.now();
  
  // Optimistically add user message to UI, using same timestamp
  ChatManager.appendMessageToUI(elements.chatContainer, 'user', userText, imageBase64, false, messageTimestamp);
  
  // Get dialog history from DOM
  const chatHistory = ChatHistory.getChatHistoryFromDOM(elements.chatContainer);
  
  // Immediately save current dialog history to storage
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    });
    logger.info('Chat history saved after adding user message');
  } catch (error) {
    logger.error('Failed to save chat history after adding user message:', error);
  }
  
  // Prepare payload for service worker
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = StateManager.getStateItem('extractedContent'); // Always pass extractedContent
  const config = await StateManager.getConfig();

  // Default system prompt from config (usually contains {CONTENT})
  systemPromptTemplateForPayload = config.systemPrompt;

  if (StateManager.getStateItem('includePageContent')) {
    logger.info('Including page content in the message. Extracted content will be sent.');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nPage Content:\n' + pageContentForPayload; 
  } else {
    logger.info('Not including page content in the message. Only using for {CONTENT} replacement.');
  }
  
  // Show loading indicator in chat
  // Ensure this method is called before sending message to ensure UI is updated in time
  const loadingMsgId = ChatManager.appendMessageToUI(elements.chatContainer, 'assistant', '<div class="spinner"></div>', null, true);
  
  // If image was attached, send and remove
  if (imageBase64) {
    ImageHandler.removeAttachedImage(elements.imagePreviewContainer, elements.imagePreview);
  }

  try {
    // Get selected model
    const selectedModel = modelSelector ? modelSelector.getSelectedModel() : null;
    
    // Send message to background script for LLM processing
    await MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      imageBase64: imageBase64,
      currentUrl: StateManager.getStateItem('currentUrl'),
      extractionMethod: StateManager.getStateItem('currentExtractionMethod'),
      selectedModel: selectedModel
    });
  } catch (error) {
    logger.error('Error sending message to LLM via service worker:', error);
    ChatManager.handleLlmError(
      elements.chatContainer,
      'Failed to send message to the AI. Check service worker logs.',
      loadingMsgId,
      () => {
        // If error occurs, re-enable send button
        elements.sendBtn.disabled = false;
      }
    );
  }
}

/**
 * Handle quick input click
 * @param {string} displayText - Display text
 * @param {string} sendTextTemplate - Send text template
 */
async function handleQuickInputClick(displayText, sendTextTemplate) {
  const elements = UIManager.getAllElements();
  
  // Show loading status
  elements.sendBtn.disabled = true;
  
  // Create message timestamp for DOM and message object
  const messageTimestamp = Date.now();
  
  // Add user message to UI, using same timestamp
  ChatManager.appendMessageToUI(elements.chatContainer, 'user', displayText, null, false, messageTimestamp);
  
  // Show assistant response loading indicator
  const assistantLoadingMessage = ChatManager.appendMessageToUI(
    elements.chatContainer,
    'assistant',
    '<div class="spinner"></div>',
    null,
    true
  );
  
  // Get dialog history from DOM
  const chatHistory = ChatHistory.getChatHistoryFromDOM(elements.chatContainer);
  
  // Immediately save current dialog history to storage
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    });
    logger.info('Chat history saved after adding quick input message');
  } catch (error) {
    logger.error('Failed to save chat history after adding quick input message:', error);
  }
  
  // Prepare data
  const state = StateManager.getState();
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = state.extractedContent;
  const config = await StateManager.getConfig();

  // Get system prompt
  systemPromptTemplateForPayload = config.systemPrompt;

  if (state.includePageContent) {
    logger.info('Including page content in quick input message');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nPage Content:\n' + pageContentForPayload;
  } else {
    logger.info('Not including page content in quick input message');
  }

  try {
    // Get selected model
    const selectedModel = modelSelector ? modelSelector.getSelectedModel() : null;
    
    // Send message to background script for LLM processing
    await MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      currentUrl: state.currentUrl,
      extractionMethod: state.currentExtractionMethod,
      selectedModel: selectedModel
    });
  } catch (error) {
    logger.error('Error sending quick message:', error);
    // Pass loading message element to handleLlmError for updating it in case of failure
    ChatManager.handleLlmError(
      elements.chatContainer,
      'Failed to send message to LLM',
      assistantLoadingMessage,
      () => {
        elements.sendBtn.disabled = false;
      }
    ); 
  }
}

/**
 * Load quick input buttons
 */
async function loadQuickInputs() {
  try {
    const config = await StateManager.getConfig();
    logger.info('Loaded config in loadQuickInputs:', config);
    
    if (config && config.quickInputs && config.quickInputs.length > 0) {
      QuickInputs.initQuickInputs(
        UIManager.getElement('quickInputsContainer'),
        config.quickInputs,
        (displayText, sendText) => handleQuickInputClick(displayText, sendText)
      );
    }
  } catch (error) {
    logger.error('Error loading quick inputs:', error);
  }
}

/**
 * Switch extraction method
 * @param {string} method - Extraction method
 */
function switchExtractionMethod(method) {
  const elements = UIManager.getAllElements();
  const state = StateManager.getState();
  
  // Check if it's a restricted page
  if (isRestrictedPage(state.currentUrl)) {
    logger.info('Cannot switch extraction method on restricted page');
    return;
  }
  
  // Update active button styles
  elements.jinaExtractBtn.classList.toggle('active', method === 'jina');
  elements.readabilityExtractBtn.classList.toggle('active', method === 'readability');
  
  // Show loading status
  UIManager.showLoading(`Switching to ${method === 'jina' ? 'Jina AI' : 'Readability'} extraction...`);
  
  // Call content extractor switch method
  ContentExtractor.switchMethod(
    state.currentUrl,
    method,
    state.currentExtractionMethod,
    // Success callback
    (content, extractionMethod) => {
      StateManager.updateStateItem('extractedContent', content);
      StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
      UIManager.displayExtractedContent(content);
      UIManager.hideLoading();
    },
    // Error callback
    (error) => {
      UIManager.showExtractionError(error);
    }
  );
}

/**
 * Re-extract content
 * @param {string} method - Extraction method
 */
function reExtractContent(method) {
  const state = StateManager.getState();
  
  // Check if it's a restricted page
  if (isRestrictedPage(state.currentUrl)) {
    logger.info('Cannot re-extract content on restricted page');
    return;
  }
  
  // Show loading status
  UIManager.showLoading(`Re-extracting with ${method === 'jina' ? 'Jina AI' : 'Readability'}...`);
  
  // Call content extractor re-extract method
  ContentExtractor.reExtract(
    state.currentUrl,
    method,
    // Success callback
    (content, extractionMethod) => {
      StateManager.updateStateItem('extractedContent', content);
      StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
      UIManager.displayExtractedContent(content);
      UIManager.hideLoading();
    },
    // Error callback
    (error) => {
      UIManager.showExtractionError(error);
    }
  );
}

/**
 * Copy extracted content
 */
async function copyExtractedContent() {
  const elements = UIManager.getAllElements();
  
  // Check if button is disabled
  if (elements.copyContentBtn.disabled || elements.copyContentBtn.classList.contains('disabled')) {
    return;
  }
  
  const content = StateManager.getStateItem('extractedContent');
  const success = await ContentExtractor.copyExtractedContent(content);
  
  if (success) {
    showCopyToast('Content copied to clipboard');
  } else {
    showCopyToast('Failed to copy content');
  }
}

/**
 * Switch whether to include page content
 */
function toggleIncludePageContent() {
  const includePageContent = StateManager.toggleIncludePageContent();
  UIManager.updateIncludePageContentUI(includePageContent);
}

/**
 * Export conversation
 */
function exportConversation() {
  const state = StateManager.getState();
  ChatManager.exportConversation(
    state.currentUrl,
    state.extractedContent,
    state.chatHistory
  );
}

/**
 * Clear conversation and context
 */
async function clearConversationAndContext() {
  const elements = UIManager.getAllElements();
  
  // Clear UI
  ChatHistory.clearChatHistory(elements.chatContainer);
  
  // Clear from storage (if we have URL)
  await StateManager.clearUrlData(false, true);
  
  logger.info('Conversation cleared');
}

/**
 * Set up message buttons scroll effect - Completely rewritten
 */
function setupMessageButtonsScroll() {
  const chatContainer = document.getElementById('chatContainer');
  if (!chatContainer) return;

  // Track current hovered message and its buttons
  let currentHoveredMessage = null;
  let currentFloatingButtons = null;
  
  /**
   * Clear floating button state
   */
  function clearFloatingButtons() {
    if (currentFloatingButtons) {
      currentFloatingButtons.classList.remove('floating');
      currentFloatingButtons.style.position = '';
      currentFloatingButtons.style.top = '';
      currentFloatingButtons.style.right = '';
      currentFloatingButtons.style.transform = '';
      currentFloatingButtons = null;
    }
    currentHoveredMessage = null;
  }
  
  /**
   * Update button position
   */
  function updateButtonPosition(message, buttons) {
    const messageRect = message.getBoundingClientRect();
    const containerRect = chatContainer.getBoundingClientRect();
    
    // Check if message is fully visible in viewport
    const isFullyVisible = messageRect.top >= containerRect.top && 
                           messageRect.bottom <= containerRect.bottom;
    
    if (isFullyVisible) {
      // Message is fully visible, use regular positioning
      buttons.classList.remove('floating');
      buttons.style.position = '';
      buttons.style.top = '';
      buttons.style.right = '';
      buttons.style.transform = '';
    } else {
      // Message is partially clipped, use floating positioning
      buttons.classList.add('floating');
      
      // Calculate best position for buttons in viewport
      const visibleTop = Math.max(messageRect.top, containerRect.top);
      const visibleBottom = Math.min(messageRect.bottom, containerRect.bottom);
      const visibleCenter = (visibleTop + visibleBottom) / 2;
      
      // Set floating position
      buttons.style.position = 'fixed';
      buttons.style.top = `${visibleCenter}px`;
      buttons.style.right = `${window.innerWidth - containerRect.right + 12}px`;
      buttons.style.transform = 'translateY(-50%)';
    }
  }
  
  // Use event delegation to handle mouse entering message
  chatContainer.addEventListener('mouseover', function(event) {
    const message = event.target.closest('.chat-message');
    if (!message || message === currentHoveredMessage) return;
    
    // Clear previous state
    clearFloatingButtons();
    
    const buttons = message.querySelector('.message-buttons');
    if (!buttons) return;
    
    currentHoveredMessage = message;
    currentFloatingButtons = buttons;
    
    // Immediately update button position
    updateButtonPosition(message, buttons);
  });
  
  // Use event delegation to handle mouse leaving message
  chatContainer.addEventListener('mouseout', function(event) {
    const message = event.target.closest('.chat-message');
    if (!message || message !== currentHoveredMessage) return;
    
    // Check if mouse really left message area (not moved to sub-element)
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && message.contains(relatedTarget)) return;
    
    clearFloatingButtons();
  });
  
  // Update button position on scroll
  chatContainer.addEventListener('scroll', function() {
    if (currentHoveredMessage && currentFloatingButtons) {
      updateButtonPosition(currentHoveredMessage, currentFloatingButtons);
    }
  });
  
  // Update position on window size change
  window.addEventListener('resize', function() {
    if (currentHoveredMessage && currentFloatingButtons) {
      updateButtonPosition(currentHoveredMessage, currentFloatingButtons);
    }
  });
} 