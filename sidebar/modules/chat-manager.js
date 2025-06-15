/**
 * chat-manager.js - Chat functionality management
 */

import { createLogger, hasMarkdownElements } from './utils.js';
import { editMessage, retryMessage } from '../components/chat-message.js';
import { displayChatHistory as displayChatHistoryFromModule } from './chat-history.js';

const logger = createLogger('ChatManager');

/**
 * Update tab loading state when message UI changes
 * @param {string} tabId - Tab ID
 * @param {boolean} isLoading - Loading state
 */
const updateTabLoadingState = async (tabId, isLoading) => {
  try {
    if (window.TabManager && window.TabManager.updateTabLoadingState) {
      await window.TabManager.updateTabLoadingState(tabId, isLoading);
      logger.info(`Updated tab ${tabId} loading state to: ${isLoading}`);
    }
  } catch (error) {
    logger.warn('Error updating tab loading state:', error);
  }
};

/**
 * Append message to chat UI
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {string} content - Message content
 * @param {string|null} imageBase64 - Optional image data
 * @param {boolean} isStreaming - Whether this is a streaming message
 * @param {number|null} customTimestamp - Optional custom timestamp
 * @returns {HTMLElement} Created message element
 */
const appendMessageToUI = (chatContainer, role, content, imageBase64 = null, isStreaming = false, messageTimestamp = Date.now()) => {
  logger.info(`[appendMessageToUI] Appending ${role} message, isStreaming=${isStreaming}, timestamp=${messageTimestamp}`);
  
  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message`;
  messageDiv.id = `message-${messageTimestamp}`;
  
  // If there's an image, save it to element attributes
  if (imageBase64) {
    messageDiv.setAttribute('data-image', imageBase64);
  }
  
  // Create role element - Remove role text display
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  // No longer display role identifier
  // roleDiv.textContent = role === 'user' ? 'You' : 'AI';
  
  // Create content element
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // Save original content for editing and export
  contentDiv.setAttribute('data-raw-content', content);
  
  if (role === 'assistant' && isStreaming) {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Condition for streaming assistant placeholder met.`);
    try {
      // Streaming placeholder content is already HTML with spinner
      contentDiv.innerHTML = content; 
      logger.info(`[appendMessageToUI ${messageTimestamp}] Applied raw HTML content for streaming placeholder.`);
    } catch (error) {
      logger.error(`[appendMessageToUI ${messageTimestamp}] Error setting innerHTML for streaming placeholder:`, error);
      contentDiv.textContent = content; // Fallback handling
    }
    messageDiv.dataset.streaming = 'true';
    logger.info(`[appendMessageToUI ${messageTimestamp}] Set data-streaming=true on messageDiv (ID: ${messageDiv.id}). Element:`, messageDiv);
    
    // Update tab loading state when loading spinner is added
    if (content.includes('<div class="spinner"></div>')) {
      const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
      updateTabLoadingState(currentTabId, true).catch(error => 
        logger.warn('Error updating tab loading state:', error)
      );
    }
  } else {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Not a streaming assistant placeholder. Role: ${role}, Streaming: ${isStreaming}`);
    
    // For user messages, preserve line breaks by using textContent instead of markdown parsing
    if (role === 'user') {
      contentDiv.textContent = content;
      logger.info(`[appendMessageToUI ${messageTimestamp}] Used textContent for user message to preserve line breaks.`);
    } else {
      // For assistant messages, check if content contains markdown
      const containsMarkdown = hasMarkdownElements(content);
      
      if (containsMarkdown) {
        // Use markdown parsing for content with markdown elements
        try {
          contentDiv.innerHTML = window.marked.parse(content);
          logger.info(`[appendMessageToUI ${messageTimestamp}] Parsed Markdown for assistant message.`);
        } catch (error) {
          logger.error(`[appendMessageToUI ${messageTimestamp}] Error parsing markdown for assistant message:`, error);
          contentDiv.textContent = content; // Fallback to plain text
          contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
        }
      } else {
        // Use plain text with preserved line breaks for content without markdown
        contentDiv.textContent = content;
        contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
        logger.info(`[appendMessageToUI ${messageTimestamp}] Used textContent for assistant message without markdown to preserve line breaks.`);
      }
    }
  }
  
  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  
  // Operation buttons for user messages
  if (role === 'user' && !isStreaming) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'btn-base message-action-btn';
    editButton.innerHTML = '<i class="material-icons">edit</i>';
    editButton.title = 'Edit Message';
    editButton.onclick = () => editMessage(messageDiv, (messageId, newContent) => {
      // Modify DOM
      const contentDiv = messageDiv.querySelector('.message-content');
      contentDiv.setAttribute('data-raw-content', newContent);
      // For user messages, preserve line breaks by using textContent
      if (role === 'user') {
        contentDiv.textContent = newContent;
      } else {
        try {
          contentDiv.innerHTML = window.marked.parse(newContent);
        } catch (error) {
          contentDiv.textContent = newContent;
        }
      }
    });
    
    // Copy text button
    const copyButton = document.createElement('button');
    copyButton.className = 'btn-base message-action-btn';
    copyButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyButton.title = 'Copy Text';
    copyButton.onclick = () => copyMessageText(content);
    
    // Copy markdown button
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content);
    
    // Retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'btn-base message-action-btn';
    retryButton.innerHTML = '<i class="material-icons">refresh</i>';
    retryButton.title = 'Retry';
    retryButton.onclick = () => retryMessage(messageDiv, (messageId, messageContent) => {
      // Simply remove all subsequent messages
      const allMessages = Array.from(chatContainer.querySelectorAll('.chat-message'));
      const messageElementIndex = allMessages.findIndex(el => el.id === messageDiv.id);
      
      if (messageElementIndex !== -1) {
        // Remove subsequent messages
        for (let i = allMessages.length - 1; i > messageElementIndex; i--) {
          allMessages[i].remove();
        }
      }
      
      // Add new assistant placeholder message
      appendMessageToUI(
        chatContainer,
        'assistant',
        '<div class="spinner"></div>',
        null,
        true
      );
      
      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    
    const buttons = [editButton, retryButton, copyButton, copyMarkdownButton];
    
    // Dynamic button layout
    layoutMessageButtons(buttonContainer, buttons, messageDiv);
    messageDiv.appendChild(buttonContainer);
  }
  // Operation buttons for assistant messages (non-streaming)
  else if (role === 'assistant' && !isStreaming) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // Copy text button
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'btn-base message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.onclick = () => copyMessageText(content);
    
    // Copy markdown button
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content);
    
    const buttons = [copyTextButton, copyMarkdownButton];
    
    // Dynamic button layout
    layoutMessageButtons(buttonContainer, buttons, messageDiv);
    messageDiv.appendChild(buttonContainer);
  }
  
  // Add to chat container
  chatContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Display image (if any)
  if (imageBase64 && !isStreaming) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'message-image-container';
    const image = document.createElement('img');
    image.src = imageBase64;
    image.className = 'message-image';
    image.alt = 'Attached image';
    imageContainer.appendChild(image);
    
    // Add image after content
    contentDiv.appendChild(imageContainer);
  }
  
  return messageDiv;
};

/**
 * Handle streaming chunk response
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {string} chunk - Received text chunk
 */
const handleStreamChunk = (chatContainer, chunk) => {
  // Find currently streaming message
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    const streamingMessageContentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!streamingMessageContentDiv) return;

    // Remove spinner (if exists, should only be on first chunk)
    const spinner = streamingMessageContentDiv.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }
    
    // Append new chunk to buffer
    let currentBuffer = streamingMessageContainer.dataset.markdownBuffer || '';
    currentBuffer += chunk;
    streamingMessageContainer.dataset.markdownBuffer = currentBuffer;
    
    // Save original content
    streamingMessageContentDiv.setAttribute('data-raw-content', currentBuffer);
    
    // Detect if content contains markdown elements to decide how to display
    const containsMarkdown = hasMarkdownElements(currentBuffer);
    
    try {
      if (containsMarkdown) {
        // If contains markdown, try to parse it
        streamingMessageContentDiv.classList.remove('no-markdown');
        streamingMessageContentDiv.innerHTML = window.marked.parse(currentBuffer);
        logger.info('[handleStreamChunk] Parsed markdown content during streaming');
      } else {
        // If no markdown, display text and preserve line breaks
        streamingMessageContentDiv.classList.add('no-markdown');
        streamingMessageContentDiv.textContent = currentBuffer;
        logger.info('[handleStreamChunk] Applied no-markdown class for plain text streaming');
      }
    } catch (error) {
      logger.error('Error parsing markdown during stream:', error);
      // Fallback: display text
      streamingMessageContentDiv.classList.add('no-markdown');
      streamingMessageContentDiv.textContent = currentBuffer;
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

/**
 * Handle streaming transmission end
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {string} fullResponse - Full response text
 * @param {Function} onComplete - Callback function after completion
 */
const handleStreamEnd = (chatContainer, fullResponse, onComplete) => {
  logger.info('[handleStreamEnd] Received fullResponse:', fullResponse ? fullResponse.substring(0, 100) + '...' : 'empty_or_null');
  // Find currently streaming message
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    logger.info('[handleStreamEnd] Found streamingMessageContainer:', streamingMessageContainer);
    // Use full response to update content
    const contentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!contentDiv) {
      logger.error('[handleStreamEnd] streamingMessageContainer found, but .message-content child is missing!');
      // Try to clear streaming attribute to prevent multiple stuck loaders
      streamingMessageContainer.removeAttribute('data-streaming');
      return;
    }
    logger.info('[handleStreamEnd] Found contentDiv:', contentDiv);
    
    // Check if content contains markdown elements
    const containsMarkdown = hasMarkdownElements(fullResponse);
    
    try {
      // Save original content
      contentDiv.setAttribute('data-raw-content', fullResponse);
      
      if (containsMarkdown) {
        logger.info('[handleStreamEnd] Attempting to parse Markdown...');
        contentDiv.classList.remove('no-markdown');
        contentDiv.innerHTML = window.marked.parse(fullResponse);
        logger.info('[handleStreamEnd] Markdown parsed and applied to contentDiv.');
      } else {
        // Use plain text with preserved line breaks for content without markdown
        contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
        contentDiv.textContent = fullResponse;
        logger.info('[handleStreamEnd] Applied fullResponse as plain text with preserved line breaks.');
      }
    } catch (markdownError) {
      logger.error('[handleStreamEnd] Error parsing Markdown:', markdownError);
      contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
      contentDiv.textContent = fullResponse; // Fallback to plain text
      logger.info('[handleStreamEnd] Applied fullResponse as plain text due to Markdown error.');
    }
        
    // Remove streaming flag
    streamingMessageContainer.removeAttribute('data-streaming');
    logger.info('[handleStreamEnd] Removed data-streaming attribute.');
    
    // Update tab loading state when streaming ends
    const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
    updateTabLoadingState(currentTabId, false).catch(error => 
      logger.warn('Error updating tab loading state:', error)
    );
    
    // Add operation buttons for assistant messages
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // Copy text button
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'btn-base message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.onclick = () => copyMessageText(fullResponse);
    
    // Copy markdown button
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(fullResponse);
    
    const buttons = [copyTextButton, copyMarkdownButton];
    
    // Dynamic button layout
    layoutMessageButtons(buttonContainer, buttons, streamingMessageContainer);
    
    // Ensure buttons are added to correct position
    streamingMessageContainer.appendChild(buttonContainer);
    logger.info('[handleStreamEnd] Action buttons added.');
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    logger.info('[handleStreamEnd] Scrolled to bottom.');
    
    // Call completion callback
    if (typeof onComplete === 'function') {
      onComplete(fullResponse);
    }
  } else {
    logger.debug('[handleStreamEnd] streamingMessageContainer not found, stream may have already completed.');
    // Even if no streaming message container is found, call completion callback
    if (typeof onComplete === 'function') {
      onComplete(fullResponse);
    }
  }
};

/**
 * Handle LLM error
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {string|Error} error - Error information
 * @param {HTMLElement} streamingMessageElement - Optional streaming message element
 * @param {Function} onComplete - Callback function after completion
 */
const handleLlmError = (chatContainer, error, streamingMessageElement = null, onComplete = null) => {
  logger.error('LLM Error:', error);
  
  // Update tab loading state when error occurs
  const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
  updateTabLoadingState(currentTabId, false).catch(error => 
    logger.warn('Error updating tab loading state:', error)
  );
  
  // Try to find streaming message (if not passed)
  const messageElement = streamingMessageElement || chatContainer.querySelector('[data-streaming="true"]');
  
  if (messageElement) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.innerHTML = `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`;
    }
    messageElement.removeAttribute('data-streaming'); // Ensure remove streaming flag
  } else {
    // If no streaming message (e.g., error occurred before creation or already handled)
    // Add new error message
    appendMessageToUI(
      chatContainer,
      'assistant', 
      `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`
    );
  }
  
  // Call completion callback
  if (typeof onComplete === 'function') {
    onComplete(error);
  }
};

/**
 * Copy message text
 * @param {string} content - Message content
 */
const copyMessageText = (content) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.marked.parse(content);
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  navigator.clipboard.writeText(textContent)
    .then(() => window.showCopyToast('Text copied to clipboard'))
    .catch(err => logger.error('Failed to copy text:', err));
};

/**
 * Copy message Markdown
 * @param {string} content - Message content
 */
const copyMessageMarkdown = (content) => {
  navigator.clipboard.writeText(content)
    .then(() => window.showCopyToast('Markdown copied to clipboard'))
    .catch(err => {
      logger.error('Error copying markdown to clipboard:', err);
      window.showCopyToast('Error copying markdown');
    });
};

/**
 * Display chat history in chat UI
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {Array} history - Chat history array
 */
const displayChatHistory = (chatContainer, history) => {
  displayChatHistoryFromModule(chatContainer, history, appendMessageToUI);
};

/**
 * Export conversation as Markdown
 * @param {string} currentUrl - Current page URL
 * @param {string} extractedContent - Extracted content
 * @param {Array} chatHistory - Chat history
 */
const exportConversation = async (currentUrl, extractedContent, chatHistory) => {
  // Validate parameters with proper error handling
  if (!chatHistory || !Array.isArray(chatHistory)) {
    logger.warn('Invalid chat history provided for export:', chatHistory);
    return;
  }
  
  if (chatHistory.length === 0) {
    logger.info('No chat messages to export');
    return;
  }
  
  // Get page title
  let pageTitle = 'Unknown';
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].title) {
      // Sanitize filename and limit length
      pageTitle = tabs[0].title
        .replace(/[<>:"/\\|?*'，。！？；：""''（）【】《》]/g, '_') // Remove invalid filename characters and Chinese punctuation
        .replace(/_{2,}/g, '_') // Replace multiple consecutive underscores with single underscore
        .replace(/^_+|_+$/g, '') // Remove leading and trailing underscores
        .substring(0, 100); // Limit to 100 characters
    }
  } catch (error) {
    logger.warn('Failed to get page title:', error);
  }

  // Generate markdown content
  let markdownContent = `# ${pageTitle}\n\n`;
  markdownContent += `URL: ${currentUrl || 'Unknown'}\n\n`;
  markdownContent += `## Conversation\n\n`;
  
  chatHistory.forEach((message, index) => {
    if (message && typeof message === 'object') {
      const role = message.role || 'Unknown';
      const content = message.content || '';
      markdownContent += `## ------${role}------\n\n`;
      markdownContent += `${content}\n\n`;
    } else {
      logger.warn(`Invalid message format at index ${index}:`, message);
    }
  });
  
  // Create blob and download
  try {
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp and page title
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hour}${minute}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${timestamp}_${pageTitle}.md`;
    a.click();
    
    URL.revokeObjectURL(url);
    logger.info(`Successfully exported conversation with ${chatHistory.length} messages`);
  } catch (error) {
    logger.error('Failed to export conversation:', error);
  }
};

/**
 * Dynamic button layout, choose best layout based on message height and button count
 * @param {HTMLElement} container - Button container
 * @param {HTMLElement[]} buttons - Button array
 * @param {HTMLElement} messageElement - Message element, used to get height
 */
const layoutMessageButtons = (container, buttons, messageElement = null) => {
  const buttonCount = buttons.length;
  
  function applyLayout() {
    // Clear container
    container.innerHTML = '';
    
    let messageHeight = 0;
    let layoutType = '';
    
    if (messageElement) {
      messageHeight = messageElement.offsetHeight;
    }
    
    // Decide layout based on message height and button count
    if (messageElement && messageHeight > 75) {
      // Use single column layout if message height is sufficient
      container.className = 'message-buttons layout-column';
      layoutType = 'column';
      buttons.forEach(button => container.appendChild(button));
    } else if (messageElement && messageHeight > 35) {
      if (buttonCount <= 2) {
        container.className = 'message-buttons layout-column';
      layoutType = 'column';
      buttons.forEach(button => container.appendChild(button));
    }else{
      container.className = 'message-buttons layout-2rows';
      layoutType = '2rows';
      
      const buttonsPerRow = Math.ceil(buttonCount / 2);
      for (let i = 0; i < buttonCount; i += buttonsPerRow) {
        const row = document.createElement('div');
        row.className = 'button-row';
        
        for (let j = i; j < Math.min(i + buttonsPerRow, buttonCount); j++) {
          row.appendChild(buttons[j]);
        }
        
        container.appendChild(row);
      }
    }

    } else if (buttonCount <= 4) {
      // Single row layout
      container.className = 'message-buttons layout-row';
      layoutType = 'row';
      buttons.forEach(button => container.appendChild(button));
    } else {
      // 5 or more buttons: Single column layout
      container.className = 'message-buttons layout-column';
      layoutType = 'column';
      buttons.forEach(button => container.appendChild(button));
    }
    
    // Add corresponding layout class name to message container for CSS adjustment message content width
    if (messageElement && layoutType) {
      // Remove previous layout class name
      messageElement.classList.remove('buttons-layout-row', 'buttons-layout-2rows', 'buttons-layout-column');
      // Add new layout class name
      messageElement.classList.add(`buttons-layout-${layoutType}`);
      logger.debug(`Applied layout class: buttons-layout-${layoutType} to message ${messageElement.id}`);
    }
  }
  
  // First apply default layout based on button count
  applyLayout();
  
  // If message element is passed, re-check height and adjust layout after DOM rendering is complete
  if (messageElement) {
    // Use requestAnimationFrame to ensure DOM has finished rendering
    requestAnimationFrame(() => {
      applyLayout();
    });
  }
};

/**
 * Check and fix existing message layout class names
 * @param {HTMLElement} chatContainer - Chat container
 */
const fixExistingMessageLayouts = (chatContainer) => {
  if (!chatContainer) return;
  
  const messages = chatContainer.querySelectorAll('.chat-message');
  messages.forEach(messageElement => {
    const buttonContainer = messageElement.querySelector('.message-buttons');
    if (buttonContainer) {
      const buttons = Array.from(buttonContainer.querySelectorAll('.message-action-btn'));
      if (buttons.length > 0) {
        // Re-apply layout
        layoutMessageButtons(buttonContainer, buttons, messageElement);
        logger.debug(`Fixed layout for message ${messageElement.id}`);
      }
    }
  });
};

/**
 * Send user message to LLM
 * @param {string} userText - User input text
 * @param {string} imageBase64 - Optional image data
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {HTMLElement} userInput - User input element
 * @param {HTMLElement} sendBtn - Send button element
 * @param {Object} modelSelector - Model selector instance
 * @param {Function} onMessageSaved - Callback after message is saved
 * @returns {Promise<void>}
 */
const sendUserMessage = async (userText, imageBase64, chatContainer, userInput, sendBtn, modelSelector, onMessageSaved) => {
  if (!userText && !imageBase64) {
    logger.warn('Attempted to send an empty message');
    return;
  }

  // Clear input and disable send button
  userInput.value = '';
  sendBtn.disabled = true;
  
  // Create message timestamp for DOM and message object
  const messageTimestamp = Date.now();
  
  // Optimistically add user message to UI, using same timestamp
  appendMessageToUI(chatContainer, 'user', userText, imageBase64, false, messageTimestamp);
  
  // Get dialog history from DOM
  const chatHistory = window.ChatHistory.getChatHistoryFromDOM(chatContainer);
  
  // Immediately save current dialog history to storage for current tab
  try {
    if (window.TabManager && window.TabManager.saveCurrentTabChatHistory) {
      await window.TabManager.saveCurrentTabChatHistory(chatHistory);
      logger.info('Tab chat history saved after adding user message');
    } else {
      // Fallback to original method
      await chrome.runtime.sendMessage({
        type: 'SAVE_CHAT_HISTORY',
        url: window.StateManager.getStateItem('currentUrl'),
        chatHistory: chatHistory
      });
      logger.info('Chat history saved after adding user message');
    }
    if (onMessageSaved) onMessageSaved();
  } catch (error) {
    logger.error('Failed to save chat history after adding user message:', error);
  }
  
  // Prepare payload for service worker
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = window.StateManager.getStateItem('extractedContent'); // Always pass extractedContent
  const config = await window.StateManager.getConfig();

  // Default system prompt from config (usually contains {CONTENT})
  systemPromptTemplateForPayload = config.systemPrompt;

  if (window.StateManager.getStateItem('includePageContent')) {
    logger.info('Including page content in the message. Extracted content will be sent.');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nPage Content:\n' + pageContentForPayload; 
  } else {
    logger.info('Not including page content in the message. Only using for {CONTENT} replacement.');
  }
  
  // Show loading indicator in chat
  // Ensure this method is called before sending message to ensure UI is updated in time
  const loadingMsgId = appendMessageToUI(chatContainer, 'assistant', '<div class="spinner"></div>', null, true);
  
  // If image was attached, send and remove
  if (imageBase64) {
    const imageHandler = window.ImageHandler;
    if (imageHandler && imageHandler.removeAttachedImage) {
      const imagePreviewContainer = document.getElementById('imagePreviewContainer');
      const imagePreview = document.getElementById('imagePreview');
      imageHandler.removeAttachedImage(imagePreviewContainer, imagePreview);
    }
  }

  try {
    // Get selected model
    const selectedModel = modelSelector ? modelSelector.getSelectedModel() : null;
    
    // Get current tab ID for loading state tracking
    const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
    
    // Send message to background script for LLM processing
    await window.MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      imageBase64: imageBase64,
      currentUrl: window.StateManager.getStateItem('currentUrl'),
      extractionMethod: window.StateManager.getStateItem('currentExtractionMethod'),
      selectedModel: selectedModel,
      tabId: currentTabId
    });
  } catch (error) {
    logger.error('Error sending message to LLM via service worker:', error);
    handleLlmError(
      chatContainer,
      'Failed to send message to the AI. Check service worker logs.',
      loadingMsgId,
      () => {
        // If error occurs, re-enable send button
        sendBtn.disabled = false;
      }
    );
  }
};

/**
 * Handle quick input click
 * @param {string} displayText - Display text
 * @param {string} sendTextTemplate - Send text template
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {HTMLElement} sendBtn - Send button element
 * @param {Object} modelSelector - Model selector instance
 * @param {Function} onMessageSaved - Callback after message is saved
 * @returns {Promise<void>}
 */
const handleQuickInputClick = async (displayText, sendTextTemplate, chatContainer, sendBtn, modelSelector, onMessageSaved) => {
  // Show loading status
  sendBtn.disabled = true;
  
  // Create message timestamp for DOM and message object
  const messageTimestamp = Date.now();
  
  // Process sendTextTemplate to get actual content to send
  let actualMessageContent = sendTextTemplate;
  const currentState = window.StateManager.getState();
  
  // Replace {CONTENT} placeholder if present
  if (sendTextTemplate.includes('{CONTENT}')) {
    if (currentState.includePageContent && currentState.extractedContent) {
      actualMessageContent = sendTextTemplate.replace('{CONTENT}', currentState.extractedContent);
      logger.info('Replaced {CONTENT} placeholder in quick input message');
    } else {
      actualMessageContent = sendTextTemplate.replace('{CONTENT}', '');
      logger.info('Removed {CONTENT} placeholder from quick input message (no page content)');
    }
  }
  
  // Add user message to UI - show displayText but store actualMessageContent as raw content
  const messageElement = appendMessageToUI(chatContainer, 'user', displayText, null, false, messageTimestamp);
  
  // Store the actual send content in data-raw-content for editing purposes
  const contentElement = messageElement.querySelector('.message-content');
  if (contentElement) {
    contentElement.setAttribute('data-raw-content', actualMessageContent);
    // Mark this as a quick input message and store display text
    contentElement.setAttribute('data-quick-input', 'true');
    contentElement.setAttribute('data-display-text', displayText);
    logger.info('Stored actual send content in data-raw-content for editing');
  }
  
  // Show assistant response loading indicator
  const assistantLoadingMessage = appendMessageToUI(
    chatContainer,
    'assistant',
    '<div class="spinner"></div>',
    null,
    true
  );
  
  // Get dialog history from DOM
  const chatHistory = window.ChatHistory.getChatHistoryFromDOM(chatContainer);
  
  // Immediately save current dialog history to storage for current tab
  try {
    if (window.TabManager && window.TabManager.saveCurrentTabChatHistory) {
      await window.TabManager.saveCurrentTabChatHistory(chatHistory);
      logger.info('Tab chat history saved after adding quick input message');
    } else {
      // Fallback to original method
      await chrome.runtime.sendMessage({
        type: 'SAVE_CHAT_HISTORY',
        url: window.StateManager.getStateItem('currentUrl'),
        chatHistory: chatHistory
      });
      logger.info('Chat history saved after adding quick input message');
    }
    if (onMessageSaved) onMessageSaved();
  } catch (error) {
    logger.error('Failed to save chat history after adding quick input message:', error);
  }
  
  // Prepare data
  const state = currentState;
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = state.extractedContent;
  const config = await window.StateManager.getConfig();

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
    
    // Get current tab ID for loading state tracking
    const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
    
    // Send message to background script for LLM processing
    await window.MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      currentUrl: state.currentUrl,
      extractionMethod: state.currentExtractionMethod,
      selectedModel: selectedModel,
      tabId: currentTabId
    });
  } catch (error) {
    logger.error('Error sending quick message:', error);
    // Pass loading message element to handleLlmError for updating it in case of failure
    handleLlmError(
      chatContainer,
      'Failed to send message to LLM',
      assistantLoadingMessage,
      () => {
        sendBtn.disabled = false;
      }
    ); 
  }
};

/**
 * Clear conversation and context
 * @param {HTMLElement} chatContainer - Chat container element
 * @returns {Promise<void>}
 */
const clearConversationAndContext = async (chatContainer) => {
  // Clear UI
  window.ChatHistory.clearChatHistory(chatContainer);
  
  // Clear from storage for current tab
  if (window.TabManager && window.TabManager.clearTabChatHistory) {
    await window.TabManager.clearTabChatHistory();
  } else {
    // Fallback to original method if TabManager not available
    await window.StateManager.clearUrlData(false, true);
  }
  
  // Clear loading state cache for current tab
  try {
    const currentUrl = window.StateManager.getStateItem('currentUrl');
    const currentTabId = window.TabManager ? window.TabManager.getActiveTabId() : 'chat';
    
    if (currentUrl && currentTabId) {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_LOADING_STATE',
        url: currentUrl,
        tabId: currentTabId
      });
      logger.info('Loading state cleared for current tab');
    }
  } catch (error) {
    logger.error('Error clearing loading state:', error);
  }
  
  logger.info('Conversation cleared for current tab');
};

export {
  appendMessageToUI,
  handleStreamChunk,
  handleStreamEnd,
  handleLlmError,
  copyMessageText,
  copyMessageMarkdown,
  displayChatHistory,
  exportConversation,
  layoutMessageButtons,
  fixExistingMessageLayouts,
  sendUserMessage,
  handleQuickInputClick,
  clearConversationAndContext
}; 