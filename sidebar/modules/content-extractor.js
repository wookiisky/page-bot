/**
 * content-extractor.js - 内容提取功能
 */

import { createLogger } from './utils.js';
import { switchExtractionMethod, reExtractContent } from './message-handler.js';

const logger = createLogger('ContentExtractor');

/**
 * 切换提取方法
 * @param {string} url - 页面URL
 * @param {string} method - 提取方法(readability或jina)
 * @param {string} currentMethod - 当前提取方法
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onError - 错误回调
 */
const switchMethod = async (url, method, currentMethod, onSuccess, onError) => {
  logger.info(`=== SWITCH EXTRACTION METHOD START ===`);
  logger.info(`Switching to method: ${method}`);
  logger.info(`Current URL: ${url}`);
  logger.info(`Current extraction method before: ${currentMethod}`);
  
  // 如果已经使用此方法，调用成功回调以确保UI状态正确更新
  if (currentMethod === method) {
    logger.info(`Already using method: ${method}, calling success callback to maintain UI consistency`);
    
    // 尝试获取当前内容并调用成功回调
    try {
      // 从状态管理器获取当前提取的内容
      const currentContent = window.StateManager ? window.StateManager.getStateItem('extractedContent') : null;
      
      if (currentContent && typeof onSuccess === 'function') {
        logger.info(`Calling success callback with existing content (length: ${currentContent.length})`);
        onSuccess(currentContent, method);
      } else if (typeof onSuccess === 'function') {
        logger.info(`No existing content found, calling success callback with empty content`);
        onSuccess('', method);
      }
    } catch (error) {
      logger.error('Error handling same method click:', error);
      if (typeof onError === 'function') {
        onError('Error accessing current content');
      }
    }
    
    logger.info(`=== SWITCH EXTRACTION METHOD SAME METHOD HANDLED ===`);
    return;
  }
  
  try {
    // 调用消息处理器的方法切换提取方法
    const result = await switchExtractionMethod(url, method);
    
    if (result.success) {
      logger.info(`Content updated successfully with method: ${result.extractionMethod || method}`);
      
      // 调用成功回调
      if (typeof onSuccess === 'function') {
        onSuccess(result.content, result.extractionMethod || method);
      }
      
      logger.info(`=== SWITCH EXTRACTION METHOD SUCCESS ===`);
    } else {
      logger.info(`Content update error: ${result.error}`);
      
      // 调用错误回调
      if (typeof onError === 'function') {
        onError(result.error);
      }
      
      logger.info(`=== SWITCH EXTRACTION METHOD ERROR ===`);
    }
  } catch (error) {
    logger.error('Error switching extraction method:', error);
    
    // 调用错误回调
    if (typeof onError === 'function') {
      onError('Failed to communicate with the background script');
    }
    
    logger.info(`=== SWITCH EXTRACTION METHOD EXCEPTION ===`);
  }
};

/**
 * 重新提取内容
 * @param {string} url - 页面URL
 * @param {string} method - 提取方法
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onError - 错误回调
 */
const reExtract = async (url, method, onSuccess, onError) => {
  logger.info(`=== RE-EXTRACT START ===`);
  logger.info(`Re-extracting with method: ${method}`);
  logger.info(`Current URL: ${url}`);
  
  try {
    const result = await reExtractContent(url, method);
    
    if (result.success) {
      logger.info(`Content updated successfully with method: ${result.extractionMethod || method}`);
      
      // 调用成功回调
      if (typeof onSuccess === 'function') {
        onSuccess(result.content, result.extractionMethod || method);
      }
      
      logger.info(`=== RE-EXTRACT SUCCESS ===`);
    } else {
      logger.info(`Content update error: ${result.error}`);
      
      // 调用错误回调
      if (typeof onError === 'function') {
        onError(result.error);
      }
      
      logger.info(`=== RE-EXTRACT ERROR ===`);
    }
  } catch (error) {
    logger.error('Error re-extracting content:', error);
    
    // 调用错误回调
    if (typeof onError === 'function') {
      onError('Failed to communicate with the background script');
    }
    
    logger.info(`=== RE-EXTRACT EXCEPTION ===`);
  }
};

/**
 * 复制提取的内容到剪贴板
 * @param {string} content - 提取的内容
 * @returns {Promise<boolean>} 是否成功复制
 */
const copyExtractedContent = async (content) => {
  if (!content) {
    logger.warn('No content to copy');
    return false;
  }
  
  try {
    await navigator.clipboard.writeText(content);
    logger.info('Content copied to clipboard');
    return true;
  } catch (err) {
    logger.error('Failed to copy content:', err);
    return false;
  }
};

/**
 * Test function for debugging same-method switching
 * @param {string} method - Method to test
 * @param {string} currentMethod - Current method
 */
const testSameMethodSwitch = (method, currentMethod) => {
  logger.info('=== TESTING SAME METHOD SWITCH ===');
  logger.info(`Testing method: ${method}, current: ${currentMethod}`);
  
  const mockOnSuccess = (content, extractionMethod) => {
    logger.info(`Mock success callback called with method: ${extractionMethod}, content length: ${content ? content.length : 0}`);
  };
  
  const mockOnError = (error) => {
    logger.error(`Mock error callback called with: ${error}`);
  };
  
  switchMethod('test-url', method, currentMethod, mockOnSuccess, mockOnError);
  logger.info('=== TEST COMPLETED ===');
};

export {
  switchMethod,
  reExtract,
  copyExtractedContent,
  testSameMethodSwitch
}; 