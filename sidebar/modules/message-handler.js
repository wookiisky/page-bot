/**
 * message-handler.js - Message handling and communication
 */

import { createLogger } from './utils.js';

const logger = createLogger('MessageHandler');

/**
 * Get current page data from background
 * @param {string} url - Page URL
 * @returns {Promise<Object>} Page data
 */
const getPageData = async (url) => {
  try {
    logger.info('Requesting page data for URL:', url);
    
    // Add small delay to allow service worker initialization
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
 * Switch content extraction method
 * @param {string} url - Page URL
 * @param {string} method - Extraction method (readability or jina)
 * @returns {Promise<Object>} Operation result
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
 * Re-extract content
 * @param {string} url - Page URL
 * @param {string} method - Extraction method
 * @returns {Promise<Object>} Operation result
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
 * Send message to LLM
 * @param {Object} payload - Message payload
 * @returns {Promise<Object>} Operation result
 */
const sendLlmMessage = async (payload) => {
  try {
    logger.info('Sending message to LLM via service worker');
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE',
      payload
    });
    
    // Since LLM response is sent via streaming, no specific response is returned here
    // Streaming response will be received via message listener
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
 * Message event listener setup
 * @param {Object} handlers - Message handler functions object
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