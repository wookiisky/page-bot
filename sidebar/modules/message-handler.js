/**
 * message-handler.js - 消息处理和通信
 */

import { createLogger } from './utils.js';

const logger = createLogger('MessageHandler');

/**
 * 从后台获取当前页面数据
 * @param {string} url - 页面URL
 * @returns {Promise<Object>} 页面数据
 */
const getPageData = async (url) => {
  try {
    logger.info('Requesting page data for URL:', url);
    
    // 添加小延迟以允许service worker初始化
    await new Promise(resolve => setTimeout(resolve, 100)); 
    
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PAGE_DATA',
      url: url
    });
    
    logger.info('Received response for GET_PAGE_DATA:', response);
    
    if (response.type === 'PAGE_DATA_LOADED') {
      return {
        success: true,
        data: response.data
      };
    } else if (response.type === 'PAGE_DATA_ERROR') {
      return {
        success: false,
        error: response.error
      };
    } else {
      return {
        success: false,
        error: 'Unexpected response from background script'
      };
    }
  } catch (error) {
    logger.error('Error requesting page data:', error);
    return {
      success: false,
      error: `Failed to communicate with the background script. Details: ${error.message || 'Unknown error'}`
    };
  }
};

/**
 * 切换内容提取方法
 * @param {string} url - 页面URL
 * @param {string} method - 提取方法(readability或jina)
 * @returns {Promise<Object>} 操作结果
 */
const switchExtractionMethod = async (url, method) => {
  try {
    logger.info(`Sending SWITCH_EXTRACTION_METHOD message for method: ${method}`);
    const response = await chrome.runtime.sendMessage({
      type: 'SWITCH_EXTRACTION_METHOD',
      url: url,
      method: method
    });
    
    logger.info(`Received response for SWITCH_EXTRACTION_METHOD:`, response);
    
    if (response.type === 'CONTENT_UPDATED') {
      return {
        success: true,
        content: response.content,
        extractionMethod: response.extractionMethod || method
      };
    } else if (response.type === 'CONTENT_UPDATE_ERROR') {
      return {
        success: false,
        error: response.error
      };
    } else {
      return {
        success: false,
        error: 'Unexpected response from background script'
      };
    }
  } catch (error) {
    logger.error('Error switching extraction method:', error);
    return {
      success: false,
      error: 'Failed to communicate with the background script'
    };
  }
};

/**
 * 重新提取内容
 * @param {string} url - 页面URL
 * @param {string} method - 提取方法
 * @returns {Promise<Object>} 操作结果
 */
const reExtractContent = async (url, method) => {
  try {
    logger.info(`Sending RE_EXTRACT_CONTENT message for method: ${method}`);
    const response = await chrome.runtime.sendMessage({
      type: 'RE_EXTRACT_CONTENT',
      url: url,
      method: method
    });
    
    logger.info(`Received response for RE_EXTRACT_CONTENT:`, response);
    
    if (response.type === 'CONTENT_UPDATED') {
      return {
        success: true,
        content: response.content,
        extractionMethod: response.extractionMethod || method
      };
    } else if (response.type === 'CONTENT_UPDATE_ERROR') {
      return {
        success: false,
        error: response.error
      };
    } else {
      return {
        success: false,
        error: 'Unexpected response from background script'
      };
    }
  } catch (error) {
    logger.error('Error re-extracting content:', error);
    return {
      success: false,
      error: 'Failed to communicate with the background script'
    };
  }
};

/**
 * 发送消息到LLM
 * @param {Object} payload - 消息负载
 * @returns {Promise<Object>} 操作结果
 */
const sendLlmMessage = async (payload) => {
  try {
    logger.info('Sending message to LLM via service worker');
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE',
      payload
    });
    
    // 由于LLM响应是通过流式传输发送的，所以这里不返回具体响应
    // 流式响应将通过消息监听器接收
    return { success: true };
  } catch (error) {
    logger.error('Error sending message to LLM via service worker:', error);
    return {
      success: false,
      error: 'Failed to send message to the AI. Check service worker logs.'
    };
  }
};

/**
 * 消息事件监听器设置
 * @param {Object} handlers - 消息处理函数对象
 */
const setupMessageListeners = (handlers) => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.info('Received message:', message.type);
    
    switch (message.type) {
      case 'LLM_STREAM_CHUNK':
        if (handlers.onStreamChunk) {
          handlers.onStreamChunk(message.chunk);
        }
        break;
        
      case 'LLM_STREAM_END':
        if (handlers.onStreamEnd) {
          handlers.onStreamEnd(message.fullResponse);
        }
        break;
        
      case 'LLM_ERROR':
        if (handlers.onLlmError) {
          handlers.onLlmError(message.error);
        }
        break;
        
      case 'TAB_CHANGED':
        if (handlers.onTabChanged) {
          handlers.onTabChanged(message.url);
        }
        break;
        
      case 'AUTO_LOAD_CONTENT':
        if (handlers.onAutoLoadContent) {
          handlers.onAutoLoadContent(message.url, message.data);
        }
        break;
        
      case 'AUTO_EXTRACT_CONTENT':
        if (handlers.onAutoExtractContent) {
          handlers.onAutoExtractContent(message.url, message.extractionMethod);
        }
        break;
        
      case 'TAB_UPDATED':
        if (handlers.onTabUpdated) {
          handlers.onTabUpdated(message.url);
        }
        break;
    }
  });
  
  logger.info('Message listeners set up');
};

export {
  getPageData,
  switchExtractionMethod,
  reExtractContent,
  sendLlmMessage,
  setupMessageListeners
}; 