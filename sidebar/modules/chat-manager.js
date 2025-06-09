/**
 * chat-manager.js - Chat functionality management
 */

import { createLogger, hasMarkdownElements } from './utils.js';
import { editMessage, retryMessage } from '../components/chat-message.js';
import { displayChatHistory as displayChatHistoryFromModule } from './chat-history.js';

const logger = createLogger('ChatManager');

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
        streamingMessageContentDiv.innerHTML = window.marked.parse(currentBuffer);
      } else {
        // If no markdown, display text and preserve line breaks
        streamingMessageContentDiv.textContent = currentBuffer;
        streamingMessageContentDiv.classList.add('no-markdown');
      }
    } catch (error) {
      logger.error('Error parsing markdown during stream:', error);
      // Fallback: display text
      streamingMessageContentDiv.textContent = currentBuffer;
      streamingMessageContentDiv.classList.add('no-markdown');
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
        contentDiv.innerHTML = window.marked.parse(fullResponse);
        logger.info('[handleStreamEnd] Markdown parsed and applied to contentDiv.');
      } else {
        // Use plain text with preserved line breaks for content without markdown
        contentDiv.textContent = fullResponse;
        contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
        logger.info('[handleStreamEnd] Applied fullResponse as plain text with preserved line breaks.');
      }
    } catch (markdownError) {
      logger.error('[handleStreamEnd] Error parsing Markdown:', markdownError);
      contentDiv.textContent = fullResponse; // Fallback to plain text
      contentDiv.classList.add('no-markdown'); // Add class for preserving line breaks
      logger.info('[handleStreamEnd] Applied fullResponse as plain text due to Markdown error.');
    }
        
    // Remove streaming flag
    streamingMessageContainer.removeAttribute('data-streaming');
    logger.info('[handleStreamEnd] Removed data-streaming attribute.');
    
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
    logger.warn('[handleStreamEnd] streamingMessageContainer not found! UI might be stuck or already updated.');
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
const exportConversation = (currentUrl, extractedContent, chatHistory) => {
  if (chatHistory.length === 0) {
    return;
  }
  
  let markdownContent = `# Page Bot Conversation\n\n`;
  markdownContent += `URL: ${currentUrl}\n\n`;
  markdownContent += `Extracted content summary:\n\`\`\`\n${extractedContent.substring(0, 300)}${extractedContent.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
  markdownContent += `## Conversation\n\n`;
  
  chatHistory.forEach(message => {
    markdownContent += `### ${message.role}\n\n`;
    markdownContent += `${message.content}\n\n`;
  });
  
  // Create blob and download
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `page-bot-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  
  URL.revokeObjectURL(url);
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
  fixExistingMessageLayouts
}; 