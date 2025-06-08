/**
 * chat-history.js - 对话历史管理模块
 * 基于DOM的对话历史管理实现
 */

import { createLogger } from './utils.js';

const logger = createLogger('ChatHistory');

/**
 * 从DOM中获取完整的对话历史
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @returns {Array} 对话历史数组
 */
const getChatHistoryFromDOM = (chatContainer) => {
  const messageElements = chatContainer.querySelectorAll('.chat-message');
  const chatHistory = [];

  messageElements.forEach(messageEl => {
    // 跳过正在流式传输的消息
    if (messageEl.hasAttribute('data-streaming')) {
      return;
    }

    const role = messageEl.classList.contains('user-message') ? 'user' : 'assistant';
    const contentEl = messageEl.querySelector('.message-content');
    const content = contentEl ? contentEl.getAttribute('data-raw-content') || contentEl.textContent : '';
    const timestamp = parseInt(messageEl.id.split('-')[1], 10) || Date.now();
    
    // 获取可能存在的图片数据
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
 * 从DOM中删除指定消息之后的所有消息
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {string} messageId - 消息ID
 * @returns {boolean} 是否成功删除
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

  // 删除该消息之后的所有消息
  for (let i = allMessages.length - 1; i > messageIndex; i--) {
    allMessages[i].remove();
  }

  logger.info(`Deleted ${allMessages.length - messageIndex - 1} messages after message ${messageId}.`);
  return true;
};

/**
 * 清除所有对话历史
 * @param {HTMLElement} chatContainer - 聊天容器元素
 */
const clearChatHistory = (chatContainer) => {
  chatContainer.innerHTML = '';
  logger.info('Chat history cleared.');
};

/**
 * 编辑DOM中的消息内容
 * @param {string} messageId - 消息ID
 * @param {string} newContent - 新的消息内容
 * @returns {boolean} 是否成功编辑
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
    // 保存原始内容用于导出
    contentEl.setAttribute('data-raw-content', newContent);
    
    // 检查是否为用户消息
    const isUserMessage = messageEl.classList.contains('user-message');
    
    if (isUserMessage) {
      // 用户消息使用textContent保留换行符
      contentEl.textContent = newContent;
      logger.info(`User message ${messageId} content edited with preserved line breaks.`);
    } else {
      // 助手消息使用markdown渲染
      contentEl.innerHTML = window.marked.parse(newContent);
      logger.info(`Assistant message ${messageId} content edited with markdown parsing.`);
    }
    return true;
  } catch (error) {
    logger.error(`Error updating message ${messageId} content:`, error);
    // 回退到纯文本
    contentEl.textContent = newContent;
    contentEl.setAttribute('data-raw-content', newContent);
    return true;
  }
};

/**
 * 显示聊天历史
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {Array} history - 聊天历史数组
 * @param {Function} appendMessageToUIFunc - 添加消息到UI的函数
 */
const displayChatHistory = (chatContainer, history, appendMessageToUIFunc) => {
  if (!chatContainer) {
    logger.error('Chat container is not defined.');
    return;
  }
  
  // 清空容器
  chatContainer.innerHTML = '';
  
  if (!history || history.length === 0) {
    logger.info('No chat history to display.');
    return;
  }
  
  logger.info(`Displaying chat history with ${history.length} messages.`);
  
  try {
    // 确保所有消息都有timestamp，并按时间戳排序
    const baseTime = Date.now() - history.length * 1000;
    const sortedHistory = history
      .map((msg, index) => ({
        ...msg,
        timestamp: msg.timestamp || (baseTime + index * 1000)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // 显示消息
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
    
    // 滚动到底部
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