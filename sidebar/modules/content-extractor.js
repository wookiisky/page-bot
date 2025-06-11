/**
 * content-extractor.js - Content extraction functionality
 */

import { createLogger } from './utils.js';
import { switchExtractionMethod, reExtractContent } from './message-handler.js';

const logger = createLogger('ContentExtractor');

/**
 * Switch extraction method
 * @param {string} url - Page URL
 * @param {string} method - Extraction method (readability or jina)
 * @param {string} currentMethod - Current extraction method
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 */
const switchMethod = async (url, method, currentMethod, onSuccess, onError) => {
  logger.info(`=== SWITCH EXTRACTION METHOD START ===`);
  logger.info(`Switching to method: ${method}`);
  logger.info(`Current URL: ${url}`);
  logger.info(`Current extraction method before: ${currentMethod}`);
  
  // If already using this method, call success callback to ensure UI state is correctly updated
  if (currentMethod === method) {
    logger.info(`Already using method: ${method}, calling success callback to maintain UI consistency`);
    
    // Try to get current content and call success callback
    try {
      // Get current extracted content from state manager
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
    // Call message handler method to switch extraction method
    const result = await switchExtractionMethod(url, method);
    
    if (result.success) {
      logger.info(`Content updated successfully with method: ${result.extractionMethod || method}`);
      
      // Call success callback
      if (typeof onSuccess === 'function') {
        onSuccess(result.content, result.extractionMethod || method);
      }
      
      logger.info(`=== SWITCH EXTRACTION METHOD SUCCESS ===`);
    } else {
      logger.info(`Content update error: ${result.error}`);
      
      // Call error callback
      if (typeof onError === 'function') {
        onError(result.error);
      }
      
      logger.info(`=== SWITCH EXTRACTION METHOD ERROR ===`);
    }
  } catch (error) {
    logger.error('Error switching extraction method:', error);
    
    // Call error callback
    if (typeof onError === 'function') {
      onError('Failed to communicate with the background script');
    }
    
    logger.info(`=== SWITCH EXTRACTION METHOD EXCEPTION ===`);
  }
};

/**
 * Re-extract content
 * @param {string} url - Page URL
 * @param {string} method - Extraction method
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 */
const reExtract = async (url, method, onSuccess, onError) => {
  logger.info(`=== RE-EXTRACT START ===`);
  logger.info(`Re-extracting with method: ${method}`);
  logger.info(`Current URL: ${url}`);
  
  try {
    const result = await reExtractContent(url, method);
    
    if (result.success) {
      logger.info(`Content updated successfully with method: ${result.extractionMethod || method}`);
      
      // Call success callback
      if (typeof onSuccess === 'function') {
        onSuccess(result.content, result.extractionMethod || method);
      }
      
      logger.info(`=== RE-EXTRACT SUCCESS ===`);
    } else {
      logger.info(`Content update error: ${result.error}`);
      
      // Call error callback
      if (typeof onError === 'function') {
        onError(result.error);
      }
      
      logger.info(`=== RE-EXTRACT ERROR ===`);
    }
  } catch (error) {
    logger.error('Error re-extracting content:', error);
    
    // Call error callback
    if (typeof onError === 'function') {
      onError('Failed to communicate with the background script');
    }
    
    logger.info(`=== RE-EXTRACT EXCEPTION ===`);
  }
};

/**
 * Copy extracted content to clipboard
 * @param {string} content - Extracted content
 * @returns {Promise<boolean>} Whether copy was successful
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