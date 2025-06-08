/**
 * state-manager.js - 应用状态管理
 */

import { createLogger } from './utils.js';

const logger = createLogger('StateManager');

// 应用状态
const state = {
  currentUrl: '',
  extractedContent: '',
  currentExtractionMethod: 'readability',
  includePageContent: true,
  config: null
};

/**
 * 获取当前状态
 * @returns {Object} 当前状态对象
 */
const getState = () => {
  return { ...state };
};

/**
 * 更新状态
 * @param {Object} newState - 要更新的状态
 */
const updateState = (newState) => {
  Object.assign(state, newState);
  logger.info('State updated:', newState);
};

/**
 * 获取特定状态项
 * @param {string} key - 状态键名
 * @returns {any} 状态值
 */
const getStateItem = (key) => {
  return state[key];
};

/**
 * 更新特定状态项
 * @param {string} key - 状态键名
 * @param {any} value - 新状态值
 */
const updateStateItem = (key, value) => {
  state[key] = value;
  logger.info(`State item "${key}" updated`);
};

/**
 * 从后台获取配置
 * @returns {Promise<Object>} 配置对象
 */
const getConfig = async () => {
  try {
    logger.info('Requesting config from service worker...');
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONFIG'
    });
    
    if (response && response.type === 'CONFIG_LOADED' && response.config) {
      return response.config;
    } else {
      logger.error('Error loading config or config missing in response. Response:', response);
      return null;
    }
  } catch (error) {
    logger.error('Error requesting config via sendMessage:', error);
    return null;
  }
};

/**
 * 保存聊天历史
 * @deprecated 已由 DOM 方式管理聊天历史取代
 * @returns {Promise<boolean>} 是否成功保存
 */
const saveChatHistory = async () => {
  logger.warn('saveChatHistory() is deprecated, use direct DOM manipulation instead');
  return false;
};

/**
 * 清除URL数据
 * @param {boolean} clearContent - 是否清除内容
 * @param {boolean} clearChat - 是否清除聊天历史
 */
const clearUrlData = async (clearContent = false, clearChat = true) => {
  try {
    if (!state.currentUrl) {
      logger.warn('No URL available, cannot clear data');
      return false;
    }
    
    await chrome.runtime.sendMessage({
      type: 'CLEAR_URL_DATA',
      url: state.currentUrl,
      clearContent,
      clearChat
    });
    
    // 更新本地状态
    if (clearChat) {
      state.chatHistory = [];
    }
    
    if (clearContent) {
      state.extractedContent = '';
    }
    
    logger.info('URL data cleared. Content:', clearContent, 'Chat:', clearChat);
    return true;
  } catch (error) {
    logger.error('Error clearing URL data:', error);
    return false;
  }
};

/**
 * 切换是否包含页面内容
 * @returns {boolean} 切换后的状态
 */
const toggleIncludePageContent = () => {
  state.includePageContent = !state.includePageContent;
  logger.info(`Page content inclusion ${state.includePageContent ? 'enabled' : 'disabled'}`);
  return state.includePageContent;
};

export {
  getState,
  updateState,
  getStateItem,
  updateStateItem,
  getConfig,
  saveChatHistory,
  clearUrlData,
  toggleIncludePageContent
}; 