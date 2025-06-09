/**
 * chat-message.js - 聊天消息组件
 * 
 * Enhanced Edit Mode Features:
 * - Auto-save on blur (clicking outside the text area)
 * - Auto-resize textarea based on content
 * - Escape key to cancel editing
 * - Ctrl/Cmd+Enter to save manually
 * - Visual feedback with glow effect
 * - No save/cancel buttons needed
 */

import { createLogger, hasMarkdownElements } from '../modules/utils.js';
import { getChatHistoryFromDOM, editMessageInDOM, deleteMessagesAfter } from '../modules/chat-history.js';

const logger = createLogger('ChatMessage');

/**
 * 获取消息元素
 * @param {string} messageId - 消息ID
 * @returns {HTMLElement|null} 消息元素
 */
const getMessageElement = (messageId) => {
  return document.getElementById(messageId);
};

/**
 * 编辑消息
 * @param {HTMLElement} messageElement - 消息元素
 * @param {Function} saveCallback - 保存回调函数
 */
const editMessage = (messageElement, saveCallback) => {
  logger.info(`Editing message ${messageElement.id}`);
  
  // 找到消息内容元素
  const contentElement = messageElement.querySelector('.message-content');
  if (!contentElement) {
    logger.error('Cannot find content element in message div');
    return;
  }
  
  // 如果已经处于编辑模式，则忽略
  if (contentElement.classList.contains('edit-mode')) {
    logger.info('Message already in edit mode');
    return;
  }
  
  // 获取原始内容
  const originalContent = contentElement.getAttribute('data-raw-content') || contentElement.textContent;
  
  // 添加编辑模式类
  contentElement.classList.add('edit-mode');
  
  // 清除HTML内容并创建文本区域
  contentElement.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.value = originalContent;
  textarea.className = 'edit-textarea';
  textarea.placeholder = 'Edit your message... (ESC to cancel, Ctrl+Enter to save)';
  textarea.setAttribute('title', 'Auto-saves when you click outside. ESC to cancel, Ctrl+Enter to save.');
  contentElement.appendChild(textarea);
  
  // Auto-resize textarea function
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
  };
  
  // Auto-save function
  const autoSave = () => {
    const newContent = textarea.value.trim();
    if (newContent !== originalContent.trim()) {
      logger.info(`Auto-saving edited message ${messageElement.id}`);
      saveEditedMessage(messageElement.id, newContent, saveCallback);
    } else {
      // If content unchanged, just exit edit mode
      cancelEdit(messageElement.id, originalContent);
    }
  };
  
  // Set up event listeners
  textarea.addEventListener('input', autoResize);
  textarea.addEventListener('blur', autoSave);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Cancel edit on Escape
      cancelEdit(messageElement.id, originalContent);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Save on Ctrl+Enter or Cmd+Enter
      e.preventDefault();
      autoSave();
    }
  });
  
  // Initial resize and focus
  autoResize();
  textarea.focus();
  
  // Select all text for easy editing
  textarea.select();
  
  // Log editing instructions for user reference
  logger.info('Edit mode activated. Auto-saves on blur, ESC to cancel, Ctrl+Enter to save manually');
};

/**
 * 保存编辑后的消息
 * @param {string} messageId - 消息ID
 * @param {string} newContent - 新内容
 * @param {Function} saveCallback - 保存回调函数
 */
const saveEditedMessage = (messageId, newContent, saveCallback) => {
  logger.info(`Saving edited message ${messageId}`);
  
  // 更新DOM
  editMessageInDOM(messageId, newContent);
  
  // 移除编辑模式
  const messageElement = getMessageElement(messageId);
  if (messageElement) {
    const contentElement = messageElement.querySelector('.message-content');
    if (contentElement) {
      contentElement.classList.remove('edit-mode');
    }
  }
  
  // 调用回调
  if (typeof saveCallback === 'function') {
    saveCallback(messageId, newContent);
  }
  
  // 保存聊天历史
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    const chatHistory = getChatHistoryFromDOM(chatContainer);
    chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: window.StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    }).then(() => {
      logger.info('Chat history saved after editing message');
    }).catch(error => {
      logger.error('Failed to save chat history after editing message:', error);
    });
  }
};

/**
 * 取消编辑
 * @param {string} messageId - 消息ID
 * @param {string} originalContent - 原始内容
 */
const cancelEdit = (messageId, originalContent) => {
  logger.info(`Cancelling edit for message ${messageId}`);
  
  const messageElement = getMessageElement(messageId);
  if (!messageElement) return;
  
  const contentElement = messageElement.querySelector('.message-content');
  if (!contentElement) return;
  
  // 恢复原始内容
  // 检查是否为用户消息来决定如何渲染内容
  const isUserMessage = messageElement.classList.contains('user-message');
  
  if (isUserMessage) {
    // 用户消息使用textContent保留换行符
    contentElement.textContent = originalContent;
  } else {
    // 助手消息检查是否包含markdown
    const containsMarkdown = hasMarkdownElements(originalContent);
    
    // 首先移除可能存在的no-markdown类
    contentElement.classList.remove('no-markdown');
    
    if (containsMarkdown) {
      // 包含markdown，使用markdown渲染
      try {
        contentElement.innerHTML = window.marked.parse(originalContent);
      } catch (error) {
        contentElement.textContent = originalContent;
        contentElement.classList.add('no-markdown');
      }
    } else {
      // 不包含markdown，使用纯文本并保留换行
      contentElement.textContent = originalContent;
      contentElement.classList.add('no-markdown');
    }
  }
  
  // 移除编辑模式
  contentElement.classList.remove('edit-mode');
};

/**
 * 重试消息
 * @param {HTMLElement} messageElement - 消息元素
 * @param {Function} retryCallback - 重试回调函数
 */
const retryMessage = (messageElement, retryCallback) => {
  logger.info(`Retrying message ${messageElement.id}`);
  
  // 获取消息内容
  const contentElement = messageElement.querySelector('.message-content');
  if (!contentElement) {
    logger.error('Cannot find content element in message div');
    return;
  }
  
  const messageContent = contentElement.getAttribute('data-raw-content') || contentElement.textContent;
  
  // 调用回调函数
  if (typeof retryCallback === 'function') {
    retryCallback(messageElement.id, messageContent);
  }
  
  // 从DOM中获取对话历史
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    // 保存更新后的聊天历史
    const chatHistory = getChatHistoryFromDOM(chatContainer);
    chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: window.StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    }).then(() => {
      logger.info('Chat history saved after retrying message');
    }).catch(error => {
      logger.error('Failed to save chat history after retrying message:', error);
    });
    
    // 准备LLM请求
    const systemPrompt = window.StateManager.getConfig().systemPrompt || '';
    const extractedContent = window.StateManager.getStateItem('extractedContent') || '';
    const currentUrl = window.StateManager.getStateItem('currentUrl') || '';
    const extractionMethod = window.StateManager.getStateItem('currentExtractionMethod') || 'readability';
    const includePageContent = window.StateManager.getStateItem('includePageContent');
    
    // 构建系统提示
    let systemPromptWithContent = systemPrompt;
    if (includePageContent) {
      systemPromptWithContent += '\n\nPage Content:\n' + extractedContent;
    }
    
    // 发送LLM消息
    window.MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptWithContent,
      extractedPageContent: extractedContent,
      currentUrl: currentUrl,
      extractionMethod: extractionMethod
    }).catch(error => {
      logger.error('Error retrying message:', error);
      // 获取发送按钮并重新启用
      const sendBtn = document.getElementById('sendBtn');
      if (sendBtn) sendBtn.disabled = false;
    });
  }
};

export {
  getMessageElement,
  editMessage,
  saveEditedMessage,
  cancelEdit,
  retryMessage
}; 