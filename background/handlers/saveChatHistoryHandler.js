// background/handlers/saveChatHistoryHandler.js

async function handleSaveChatHistory(data, serviceLogger, storage) {
  const { url, chatHistory } = data;
  
  if (!url) {
    serviceLogger.warn('Handler: No URL provided for SAVE_CHAT_HISTORY');
    return { success: false, error: 'No URL provided' };
  }
  
  if (!chatHistory || !Array.isArray(chatHistory)) {
    serviceLogger.warn('Handler: Invalid or missing chatHistory for SAVE_CHAT_HISTORY');
    return { success: false, error: 'Invalid chat history data' };
  }
  
  try {
    serviceLogger.info(`Handler: Saving chat history for URL: ${url}, messages: ${chatHistory.length}`);
    const success = await storage.saveChatHistory(url, chatHistory);
    
    if (success) {
      serviceLogger.info(`Handler: Successfully saved chat history for URL: ${url}`);
      return { success: true };
    } else {
      serviceLogger.warn(`Handler: Failed to save chat history for URL: ${url}`);
      return { success: false, error: 'Failed to save chat history' };
    }
  } catch (error) {
    serviceLogger.error('Handler: Error saving chat history:', error);
    return { success: false, error: error.message || 'Unknown error saving chat history' };
  }
} 