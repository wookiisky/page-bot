/**
 * Handle GET_CHAT_HISTORY message
 * @param {Object} data - Message data containing url
 * @param {Object} serviceLogger - Service worker logger
 * @param {Object} storage - Storage module
 * @returns {Promise<Object>} Response object
 */
async function handleGetChatHistory(data, serviceLogger, storage) {
  const { url } = data;
  
  if (!url) {
    serviceLogger.warn('Handler: No URL provided for GET_CHAT_HISTORY');
    return { type: 'CHAT_HISTORY_ERROR', error: 'No URL provided' };
  }
  
  try {
    serviceLogger.info(`Handler: Getting chat history for URL: ${url}`);
    const chatHistory = await storage.getChatHistory(url);
    
    if (chatHistory && chatHistory.length > 0) {
      serviceLogger.info(`Handler: Successfully retrieved chat history for URL: ${url}, messages: ${chatHistory.length}`);
      return { 
        type: 'CHAT_HISTORY_LOADED', 
        chatHistory: chatHistory,
        url: url
      };
    } else {
      serviceLogger.info(`Handler: No chat history found for URL: ${url}`);
      return { 
        type: 'CHAT_HISTORY_LOADED', 
        chatHistory: [],
        url: url
      };
    }
  } catch (error) {
    serviceLogger.error('Handler: Error getting chat history:', error);
    return { 
      type: 'CHAT_HISTORY_ERROR', 
      error: error.message || 'Unknown error getting chat history',
      url: url
    };
  }
} 