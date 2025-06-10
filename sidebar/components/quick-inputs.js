/**
 * quick-inputs.js - 快速输入按钮组件
 */

import { createLogger } from '../modules/utils.js';

const logger = createLogger('QuickInputs');

/**
 * 初始化快速输入按钮
 * @param {HTMLElement} container - 按钮容器元素
 * @param {Array} quickInputs - 快速输入配置数组
 * @param {Function} onQuickInputClick - 点击回调函数
 */
const initQuickInputs = (container, quickInputs, onQuickInputClick) => {
  if (!container) {
    logger.error('Quick inputs container not found');
    return;
  }
  
  if (!Array.isArray(quickInputs) || quickInputs.length === 0) {
    logger.warn('No quick inputs defined in config');
    container.innerHTML = '';
    return;
  }
  
  // 清空现有内容
  container.innerHTML = '';
  
  // 为每个快速输入创建按钮
  quickInputs.forEach((quickInput, index) => {
    const button = document.createElement('button');
    button.className = 'btn-base quick-input-btn';
    button.textContent = quickInput.displayText;
    button.dataset.index = index;
    button.dataset.sendText = quickInput.sendText;
    
    // 添加点击事件处理
    button.addEventListener('click', () => {
      if (typeof onQuickInputClick === 'function') {
        onQuickInputClick(quickInput.displayText, quickInput.sendText);
      } else {
        logger.warn('No click handler provided for quick input');
      }
    });
    
    container.appendChild(button);
  });
  
  logger.info(`Initialized ${quickInputs.length} quick input buttons`);
};

/**
 * Load quick input buttons from config
 * @param {HTMLElement} container - Quick inputs container
 * @param {Function} onQuickInputClick - Click handler function
 * @returns {Promise<void>}
 */
const loadQuickInputs = async (container, onQuickInputClick) => {
  try {
    const config = await window.StateManager.getConfig();
    logger.info('Loaded config in loadQuickInputs:', config);
    
    if (config && config.quickInputs && config.quickInputs.length > 0) {
      initQuickInputs(
        container,
        config.quickInputs,
        onQuickInputClick
      );
    }
  } catch (error) {
    logger.error('Error loading quick inputs:', error);
  }
};

/**
 * 处理快速输入按钮点击
 * @param {string} displayText - 按钮显示文本
 * @param {string} sendTextTemplate - 发送的文本模板
 * @param {string} extractedContent - 提取的页面内容
 * @param {boolean} includePageContent - 是否包含页面内容
 * @param {Function} onSendMessage - 发送消息的回调函数
 */
const handleQuickInputClick = (displayText, sendTextTemplate, extractedContent, includePageContent, onSendMessage) => {
  if (!sendTextTemplate) {
    logger.warn('No send text template provided for quick input');
    return;
  }
  
  // 替换{CONTENT}占位符
  let userText = sendTextTemplate;
  if (sendTextTemplate.includes('{CONTENT}')) {
    if (includePageContent && extractedContent) {
      userText = sendTextTemplate.replace('{CONTENT}', extractedContent);
    } else {
      userText = sendTextTemplate.replace('{CONTENT}', '');
      logger.info('No page content included in quick input or extraction not enabled');
    }
  }
  
  // 调用发送消息回调
  if (typeof onSendMessage === 'function') {
    onSendMessage(displayText, userText);
  } else {
    logger.error('No send message callback provided');
  }
  
  logger.info(`Quick input clicked: ${displayText}`);
};

export {
  initQuickInputs,
  loadQuickInputs,
  handleQuickInputClick
}; 