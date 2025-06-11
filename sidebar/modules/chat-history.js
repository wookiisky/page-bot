/**
 * chat-history.js - Chat history management module
 * DOM-based chat history management implementation
 */

import { createLogger, hasMarkdownElements } from './utils.js';

const logger = createLogger('ChatHistory');

/**
 * Get complete chat history from DOM
 * @param {HTMLElement} chatContainer - Chat container element
 * @returns {Array} Chat history array
 */
const getChatHistoryFromDOM = (chatContainer) => {
  const messageElements = chatContainer.querySelectorAll('.chat-message');
  const chatHistory = [];

  messageElements.forEach(messageEl => {
    // Skip messages that are currently streaming
    if (messageEl.hasAttribute('data-streaming')) {
      return;
    }

    const role = messageEl.classList.contains('user-message') ? 'user' : 'assistant';
    const contentEl = messageEl.querySelector('.message-content');
    const content = contentEl ? contentEl.getAttribute('data-raw-content') || contentEl.textContent : '';
    const timestamp = parseInt(messageEl.id.split('-')[1], 10) || Date.now();
    
    // Get image data if it exists
    const imageBase64 = messageEl.getAttribute('data-image');
    
    chatHistory.push({
      role,
      content,
      timestamp,
      ...(imageBase64 ? { imageBase64 } : {})
    });
  });

  return chatHistory;
};

/**
 * Delete all messages after a specified message from DOM
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {string} messageId - Message ID
 * @returns {boolean} Whether deletion was successful
 */
const deleteMessagesAfter = (chatContainer, messageId) => {
  const messageEl = document.getElementById(messageId);
  if (!messageEl) {
    logger.warn(`Message with ID ${messageId} not found.`);
    return false;
  }

  const allMessages = Array.from(chatContainer.querySelectorAll('.chat-message'));
  const messageIndex = allMessages.findIndex(el => el.id === messageId);
  
  if (messageIndex === -1) {
    logger.warn(`Message with ID ${messageId} not found in message list.`);
    return false;
  }

  // Delete all messages after this message
  for (let i = allMessages.length - 1; i > messageIndex; i--) {
    allMessages[i].remove();
  }

  logger.info(`Deleted ${allMessages.length - messageIndex - 1} messages after message ${messageId}.`);
  return true;
};

/**
 * Clear all chat history
 * @param {HTMLElement} chatContainer - Chat container element
 */
const clearChatHistory = (chatContainer) => {
  chatContainer.innerHTML = '';
  logger.info('Chat history cleared.');
};

/**
 * Edit message content in DOM
 * @param {string} messageId - Message ID
 * @param {string} newContent - New message content
 * @returns {boolean} Whether edit was successful
 */
const editMessageInDOM = (messageId, newContent) => {
  const messageEl = document.getElementById(messageId);
  if (!messageEl) {
    logger.warn(`Message with ID ${messageId} not found.`);
    return false;
  }

  const contentEl = messageEl.querySelector('.message-content');
  if (!contentEl) {
    logger.warn(`Message content element not found for message ${messageId}.`);
    return false;
  }

  try {
    // Save original content for export
    contentEl.setAttribute('data-raw-content', newContent);
    
    // Check if it's a user message
    const isUserMessage = messageEl.classList.contains('user-message');
    
    if (isUserMessage) {
      // User messages use textContent to preserve line breaks
      contentEl.textContent = newContent;
      logger.info(`User message ${messageId} content edited with preserved line breaks.`);
    } else {
      // Check if assistant message contains markdown
      const containsMarkdown = hasMarkdownElements(newContent);
      
      // First remove any existing no-markdown class
      contentEl.classList.remove('no-markdown');
      
      if (containsMarkdown) {
        // Contains markdown, use markdown rendering
        contentEl.innerHTML = window.marked.parse(newContent);
        logger.info(`Assistant message ${messageId} content edited with markdown parsing.`);
      } else {
        // No markdown, use plain text and preserve line breaks
        contentEl.textContent = newContent;
        contentEl.classList.add('no-markdown');
        logger.info(`Assistant message ${messageId} content edited as plain text with preserved line breaks.`);
      }
    }
    return true;
  } catch (error) {
    logger.error(`Error updating message ${messageId} content:`, error);
    // Fallback to plain text
    contentEl.textContent = newContent;
    contentEl.setAttribute('data-raw-content', newContent);
    return true;
  }
};

/**
 * Display chat history
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {Array} history - Chat history array
 * @param {Function} appendMessageToUIFunc - Function to append message to UI
 */
const displayChatHistory = (chatContainer, history, appendMessageToUIFunc) => {
  if (!chatContainer) {
    logger.error('Chat container is not defined.');
    return;
  }
  
  // Clear container
  chatContainer.innerHTML = '';
  
  if (!history || history.length === 0) {
    logger.info('No chat history to display.');
    return;
  }
  
  logger.info(`Displaying chat history with ${history.length} messages.`);
  
  try {
    // Ensure all messages have timestamp and sort by timestamp
    const baseTime = Date.now() - history.length * 1000;
    const sortedHistory = history
      .map((msg, index) => ({
        ...msg,
        timestamp: msg.timestamp || (baseTime + index * 1000)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Display messages
    sortedHistory.forEach(message => {
      if (!message || !message.role || !message.content) {
        logger.warn('Invalid message:', message);
        return;
      }
      
      appendMessageToUIFunc(
        chatContainer,
        message.role,
        message.content,
        message.imageBase64 || null,
        false,
        message.timestamp
      );
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    logger.info('Chat history display complete.');
  } catch (error) {
    logger.error('Error displaying chat history:', error);
  }
};

export {
  getChatHistoryFromDOM,
  deleteMessagesAfter,
  clearChatHistory,
  editMessageInDOM,
  displayChatHistory
}; 