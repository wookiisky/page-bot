// Page Bot Storage Module
// Handles page data caching with LRU (Least Recently Used) strategy

// Create a global storage object
var storage = {};

// Create module logger
const storageLogger = logger.createModuleLogger('Storage');

// Storage constants
const DB_CONTENT_PREFIX = 'readBotContent_';
const DB_CHAT_PREFIX = 'readBotChat_';
const DB_PAGE_STATE_PREFIX = 'readBotPageState_';
const MAX_ITEMS = 20;
const RECENT_URLS_KEY = 'readBotRecentUrls';

// Save page content for specific extraction method
storage.savePageContent = async function(url, content, method = 'default') {
  if (!url) {
    storageLogger.error('Cannot save page content: URL is empty');
    return false;
  }
  
  try {
    // Get normalized URL as key with method for content
    const key = getContentKeyFromUrl(url, method);
    
    // Save only the content
    await chrome.storage.local.set({ [key]: content });
    storageLogger.info(`Page content saved successfully for ${method} method`, { url, contentLength: content?.length });
    
    // Update LRU list of URLs with method
    await updateRecentUrls(url, method);
    
    return true;
  } catch (error) {
    storageLogger.error('Error saving page content:', { url, method, error: error.message });
    return false;
  }
}

// Save chat history (global for the URL, not method-specific)
storage.saveChatHistory = async function(url, chatHistory) {
  if (!url) {
    storageLogger.error('Cannot save chat history: URL is empty');
    return false;
  }
  
  try {
    // Get normalized URL as key for chat history (no method suffix)
    const key = getChatHistoryKeyFromUrl(url);
    
    // 确保所有消息都有时间戳
    const baseTime = Date.now() - chatHistory.length * 1000;
    const historyWithTimestamps = chatHistory.map((msg, index) => {
      if (!msg.timestamp) {
        storageLogger.info(`Adding timestamp to message ${index} with role ${msg.role}`);
        return {
          ...msg,
          timestamp: baseTime + index * 1000 // 每条消息间隔1秒
        };
      }
      return msg;
    });
    
    // Log detailed info for debugging
    storageLogger.info('Saving chat history', { 
      url, 
      normalizedUrl: normalizeUrl(url),
      key, 
      messageCount: historyWithTimestamps?.length,
      firstMessage: historyWithTimestamps?.length > 0 ? 
        `${historyWithTimestamps[0].role}: ${historyWithTimestamps[0].content.substring(0, 50)}...` : 'none',
      lastMessage: historyWithTimestamps?.length > 0 ? 
        `${historyWithTimestamps[historyWithTimestamps.length-1].role}: ${historyWithTimestamps[historyWithTimestamps.length-1].content.substring(0, 50)}...` : 'none'
    });
    
    // Save the chat history
    await chrome.storage.local.set({ [key]: historyWithTimestamps });
    storageLogger.info('Chat history saved successfully', { url, messageCount: historyWithTimestamps?.length });
    
    return true;
  } catch (error) {
    storageLogger.error('Error saving chat history:', { url, error: error.message });
    return false;
  }
}

// Get page content for a URL with specific extraction method
storage.getPageContent = async function(url, method = 'default') {
  if (!url) {
    storageLogger.error('Cannot get page content: URL is empty');
    return null;
  }
  
  try {
    // Get normalized URL as key with method for content
    const key = getContentKeyFromUrl(url, method);
    
    // Get the content
    const result = await chrome.storage.local.get(key);
    
    if (result[key]) {
      storageLogger.info(`Found cached content for ${method} method`, { url, contentLength: result[key].length });
      // Update LRU list of URLs (move this URL to most recent)
      await updateRecentUrls(url, method);
      return result[key];
    }
    
    return null;
  } catch (error) {
    storageLogger.error('Error getting page content:', { url, method, error: error.message });
    return null;
  }
}

// Get chat history for a URL (global, not method-specific)
storage.getChatHistory = async function(url) {
  if (!url) {
    storageLogger.error('Cannot get chat history: URL is empty');
    return [];
  }
  
  try {
    // Get normalized URL as key for chat history (no method suffix)
    const key = getChatHistoryKeyFromUrl(url);
    
    // Get the chat history
    const result = await chrome.storage.local.get(key);
    
    const chatHistory = result[key] || [];
    
    // 确保所有消息都有时间戳
    const baseTime = Date.now() - chatHistory.length * 1000;
    const historyWithTimestamps = chatHistory.map((msg, index) => {
      if (!msg.timestamp) {
        storageLogger.info(`Adding timestamp to loaded message ${index} with role ${msg.role}`);
        return {
          ...msg,
          timestamp: baseTime + index * 1000 // 每条消息间隔1秒
        };
      }
      return msg;
    });
    
    if (historyWithTimestamps.length > 0) {
      storageLogger.info(`Found cached chat history for URL: ${url}`, { 
        messageCount: historyWithTimestamps.length,
        firstMessageTimestamp: historyWithTimestamps[0].timestamp,
        lastMessageTimestamp: historyWithTimestamps[historyWithTimestamps.length-1].timestamp
      });
    } else {
      storageLogger.info(`No chat history found for URL: ${url}`);
    }
    
    return historyWithTimestamps;
  } catch (error) {
    storageLogger.error('Error getting chat history:', { url, error: error.message });
    return [];
  }
}

// Update chat history for a URL (global, not method-specific)
storage.updateChatHistory = async function(url, newMessages) {
  if (!url) {
    storageLogger.error('Cannot update chat history: URL is empty');
    return false;
  }
  
  try {
    // Save the chat history directly
    return await storage.saveChatHistory(url, newMessages);
  } catch (error) {
    storageLogger.error('Error updating chat history:', { url, error: error.message });
    return false;
  }
}

// Get list of recent URLs (for LRU)
storage.getRecentUrls = async function() {
  try {
    const result = await chrome.storage.local.get(RECENT_URLS_KEY);
    return result[RECENT_URLS_KEY] || [];
  } catch (error) {
    storageLogger.error('Error getting recent URLs:', error.message);
    return [];
  }
}

// Clear data for a specific URL
storage.clearUrlData = async function(url, clearContent = true, clearChat = true, clearPageState = false) {
  if (!url) {
    storageLogger.error('Cannot clear data: URL is empty');
    return false;
  }
  
  try {
    const keysToRemove = [];
    
    if (clearContent) {
      // Clear content for all methods of this URL
      const result = await chrome.storage.local.get(null);
      const contentKeys = Object.keys(result).filter(key => 
        key.startsWith(DB_CONTENT_PREFIX) && key.includes(normalizeUrl(url))
      );
      keysToRemove.push(...contentKeys);
    }
    
    if (clearChat) {
      // Clear chat history for this URL
      const chatKey = getChatHistoryKeyFromUrl(url);
      keysToRemove.push(chatKey);
    }
    
    if (clearPageState) {
      // Clear page state for this URL
      const pageStateKey = getPageStateKeyFromUrl(url);
      keysToRemove.push(pageStateKey);
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    
    // Update recent URLs list
    let recentUrls = await storage.getRecentUrls();
    recentUrls = recentUrls.filter(item => normalizeUrl(item.url) !== normalizeUrl(url));
    await chrome.storage.local.set({ [RECENT_URLS_KEY]: recentUrls });
    
    storageLogger.info('URL data cleared successfully', { url, clearedContent: clearContent, clearedChat: clearChat, clearedPageState: clearPageState, keysRemoved: keysToRemove.length });
    return true;
  } catch (error) {
    storageLogger.error('Error clearing URL data:', { url, error: error.message });
    return false;
  }
}

// Update recent URLs list (LRU) with method information
async function updateRecentUrls(url, method) {
  try {
    // Get normalized URL
    const normalizedUrl = normalizeUrl(url);
    
    // Get current list of recent URLs
    let recentUrls = await storage.getRecentUrls();
    
    // Convert old format to new format if needed
    recentUrls = recentUrls.map(item => {
      if (typeof item === 'string') {
        return { url: item, method: 'default' };
      }
      return item;
    });
    
    // Remove the URL+method combination if it already exists
    recentUrls = recentUrls.filter(item => 
      !(normalizeUrl(item.url) === normalizedUrl && item.method === method)
    );
    
    // Add the URL+method to the front of the list (most recent)
    recentUrls.unshift({ url, method });
    
    // Trim the list if it exceeds MAX_ITEMS
    if (recentUrls.length > MAX_ITEMS) {
      // Get URLs to remove
      const itemsToRemove = recentUrls.slice(MAX_ITEMS);
      
              // Remove old data
        for (const oldItem of itemsToRemove) {
          const oldKey = getContentKeyFromUrl(oldItem.url, oldItem.method);
          await chrome.storage.local.remove(oldKey);
        }
      
      // Trim the list
      recentUrls = recentUrls.slice(0, MAX_ITEMS);
    }
    
    // Save updated list
    await chrome.storage.local.set({ [RECENT_URLS_KEY]: recentUrls });
  } catch (error) {
    storageLogger.error('Error updating recent URLs:', error.message);
  }
}

// Normalize URL for consistency
function normalizeUrl(url) {
  try {
    // Basic normalization: trim, convert to lowercase
    return url.trim().toLowerCase();
  } catch (error) {
    storageLogger.error('Error normalizing URL:', error.message);
    return url; // Return original if error
  }
}

// Get storage key for content from URL and method
function getContentKeyFromUrl(url, method = 'default') {
  // Create a consistent key for content storage that includes the extraction method
  return `${DB_CONTENT_PREFIX}${normalizeUrl(url)}_${method}`;
}

// Get storage key for chat history from URL
function getChatHistoryKeyFromUrl(url) {
  // Create a consistent key for chat history storage (no method suffix)
  return `${DB_CHAT_PREFIX}${normalizeUrl(url)}`;
}

// Save page UI state for a URL
storage.savePageState = async function(url, pageState) {
  if (!url) {
    storageLogger.error('Cannot save page state: URL is empty');
    return false;
  }
  
  try {
    // Get normalized URL as key for page state
    const key = getPageStateKeyFromUrl(url);
    
    // Save the page state
    await chrome.storage.local.set({ [key]: pageState });
    storageLogger.info('Page state saved successfully', { url, pageState });
    
    return true;
  } catch (error) {
    storageLogger.error('Error saving page state:', { url, error: error.message });
    return false;
  }
};

// Get page UI state for a URL
storage.getPageState = async function(url) {
  if (!url) {
    storageLogger.error('Cannot get page state: URL is empty');
    return null;
  }
  
  try {
    // Get normalized URL as key for page state
    const key = getPageStateKeyFromUrl(url);
    
    // Get the page state
    const result = await chrome.storage.local.get(key);
    
    if (result[key]) {
      storageLogger.info('Found cached page state', { url, pageState: result[key] });
      return result[key];
    }
    
    return null;
  } catch (error) {
    storageLogger.error('Error getting page state:', { url, error: error.message });
    return null;
  }
};

// Get storage key for page state from URL
function getPageStateKeyFromUrl(url) {
  // Create a consistent key for page state storage (no method suffix)
  return `${DB_PAGE_STATE_PREFIX}${normalizeUrl(url)}`;
}

// Clear all cached data
storage.clearAllCachedData = async function() {
  try {
    // Get all keys with our prefixes
    const result = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(result).filter(key => 
      key.startsWith(DB_CONTENT_PREFIX) || 
      key.startsWith(DB_CHAT_PREFIX) || 
      key.startsWith(DB_PAGE_STATE_PREFIX) ||
      key === RECENT_URLS_KEY
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    
    return true;
  } catch (error) {
    storageLogger.error('Error clearing cached data:', error.message);
    return false;
  }
} 