/**
 * chat-message.js - 聊天消息组件
 */

import { createLogger } from '../modules/utils.js';
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
  textarea.style.width = '100%';
  textarea.style.minHeight = '60px';
  textarea.rows = 3;
  contentElement.appendChild(textarea);
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'edit-buttons';
  buttonContainer.style.marginTop = '8px';
  buttonContainer.style.textAlign = 'right';
  
  // 保存按钮
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.className = 'btn-primary';
  saveButton.onclick = () => saveEditedMessage(messageElement.id, textarea.value, saveCallback);
  
  // 取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'btn-secondary';
  cancelButton.style.marginRight = '8px';
  cancelButton.onclick = () => cancelEdit(messageElement.id, originalContent);
  
  // 添加按钮到容器
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(saveButton);
  contentElement.appendChild(buttonContainer);
  
  // 聚焦到文本区域
  textarea.focus();
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
  try {
    contentElement.innerHTML = window.marked.parse(originalContent);
  } catch (error) {
    contentElement.textContent = originalContent;
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