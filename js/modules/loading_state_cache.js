// Page Bot Loading State Cache Module
// Manages loading states for LLM calls with timeout handling

// Create a global loadingStateCache object
var loadingStateCache = {};

// Create module logger
const loadingLogger = logger.createModuleLogger('LoadingStateCache');

// Constants
const LOADING_STATE_PREFIX = 'readBotLoadingState_';
const LOADING_TIMEOUT_MINUTES = 10;
const LOADING_TIMEOUT_MS = LOADING_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Save loading state for a specific tab
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @param {Object} loadingInfo - Loading information
 * @returns {Promise<boolean>} Success status
 */
loadingStateCache.saveLoadingState = async function(url, tabId, loadingInfo) {
  if (!url || !tabId) {
    loadingLogger.error('Cannot save loading state: URL or tabId is empty');
    return false;
  }
  
  try {
    const cacheKey = getLoadingStateKey(url, tabId);
    const loadingState = {
      ...loadingInfo,
      timestamp: Date.now(),
      status: 'loading',
      url: url,
      tabId: tabId
    };
    
    await chrome.storage.local.set({ [cacheKey]: loadingState });
    loadingLogger.info('Loading state saved successfully', { 
      url, 
      tabId, 
      cacheKey,
      messageCount: loadingInfo.messageCount || 0
    });
    
    return true;
  } catch (error) {
    loadingLogger.error('Error saving loading state:', { url, tabId, error: error.message });
    return false;
  }
};

/**
 * Update loading state to completed
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @param {string} result - LLM response result
 * @returns {Promise<boolean>} Success status
 */
loadingStateCache.completeLoadingState = async function(url, tabId, result) {
  if (!url || !tabId) {
    loadingLogger.error('Cannot complete loading state: URL or tabId is empty');
    return false;
  }
  
  try {
    const cacheKey = getLoadingStateKey(url, tabId);
    const existingState = await loadingStateCache.getLoadingState(url, tabId);
    
    if (!existingState) {
      loadingLogger.warn('No existing loading state found to complete', { url, tabId });
      return false;
    }
    
    const completedState = {
      ...existingState,
      status: 'completed',
      result: result,
      completedTimestamp: Date.now()
    };
    
    await chrome.storage.local.set({ [cacheKey]: completedState });
    loadingLogger.info('Loading state completed successfully', { url, tabId, cacheKey });
    
    return true;
  } catch (error) {
    loadingLogger.error('Error completing loading state:', { url, tabId, error: error.message });
    return false;
  }
};

/**
 * Update loading state to error
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @param {string} error - Error message
 * @returns {Promise<boolean>} Success status
 */
loadingStateCache.errorLoadingState = async function(url, tabId, error) {
  if (!url || !tabId) {
    loadingLogger.error('Cannot error loading state: URL or tabId is empty');
    return false;
  }
  
  try {
    const cacheKey = getLoadingStateKey(url, tabId);
    const existingState = await loadingStateCache.getLoadingState(url, tabId);
    
    if (!existingState) {
      loadingLogger.warn('No existing loading state found to error', { url, tabId });
      return false;
    }
    
    const errorState = {
      ...existingState,
      status: 'error',
      error: error,
      errorTimestamp: Date.now()
    };
    
    await chrome.storage.local.set({ [cacheKey]: errorState });
    loadingLogger.info('Loading state errored successfully', { url, tabId, cacheKey });
    
    return true;
  } catch (error) {
    loadingLogger.error('Error updating loading state to error:', { url, tabId, error: error.message });
    return false;
  }
};

/**
 * Get loading state for a specific tab
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @returns {Promise<Object|null>} Loading state or null
 */
loadingStateCache.getLoadingState = async function(url, tabId) {
  if (!url || !tabId) {
    loadingLogger.error('Cannot get loading state: URL or tabId is empty');
    return null;
  }
  
  try {
    const cacheKey = getLoadingStateKey(url, tabId);
    const result = await chrome.storage.local.get(cacheKey);
    
    if (!result[cacheKey]) {
      return null;
    }
    
    const loadingState = result[cacheKey];
    
    // Check if loading state is stale (over 10 minutes)
    if (loadingState.status === 'loading') {
      const timeSinceStart = Date.now() - loadingState.timestamp;
      if (timeSinceStart > LOADING_TIMEOUT_MS) {
        loadingLogger.info('Loading state is stale, auto-canceling', { 
          url, 
          tabId, 
          timeSinceStart: Math.round(timeSinceStart / 1000 / 60),
          timeoutMinutes: LOADING_TIMEOUT_MINUTES
        });
        
        // Update state to timeout
        const timeoutState = {
          ...loadingState,
          status: 'timeout',
          timeoutTimestamp: Date.now()
        };
        
        await chrome.storage.local.set({ [cacheKey]: timeoutState });
        return timeoutState;
      }
    }
    
    loadingLogger.info('Loading state retrieved', { 
      url, 
      tabId, 
      status: loadingState.status,
      timestamp: loadingState.timestamp
    });
    
    return loadingState;
  } catch (error) {
    loadingLogger.error('Error getting loading state:', { url, tabId, error: error.message });
    return null;
  }
};

/**
 * Clear loading state for a specific tab
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @returns {Promise<boolean>} Success status
 */
loadingStateCache.clearLoadingState = async function(url, tabId) {
  if (!url || !tabId) {
    loadingLogger.error('Cannot clear loading state: URL or tabId is empty');
    return false;
  }
  
  try {
    const cacheKey = getLoadingStateKey(url, tabId);
    await chrome.storage.local.remove(cacheKey);
    loadingLogger.info('Loading state cleared successfully', { url, tabId, cacheKey });
    
    return true;
  } catch (error) {
    loadingLogger.error('Error clearing loading state:', { url, tabId, error: error.message });
    return false;
  }
};

/**
 * Clear all loading states for a URL (all tabs)
 * @param {string} url - Page URL
 * @returns {Promise<boolean>} Success status
 */
loadingStateCache.clearAllLoadingStatesForUrl = async function(url) {
  if (!url) {
    loadingLogger.error('Cannot clear loading states: URL is empty');
    return false;
  }
  
  try {
    const result = await chrome.storage.local.get(null);
    const loadingStateKeys = Object.keys(result).filter(key => 
      key.startsWith(LOADING_STATE_PREFIX) && key.includes(normalizeUrl(url))
    );
    
    if (loadingStateKeys.length > 0) {
      await chrome.storage.local.remove(loadingStateKeys);
      loadingLogger.info('All loading states cleared for URL', { 
        url, 
        keysRemoved: loadingStateKeys.length 
      });
    }
    
    return true;
  } catch (error) {
    loadingLogger.error('Error clearing all loading states for URL:', { url, error: error.message });
    return false;
  }
};

/**
 * Get all active loading states
 * @returns {Promise<Array>} Array of active loading states
 */
loadingStateCache.getActiveLoadingStates = async function() {
  try {
    const result = await chrome.storage.local.get(null);
    const loadingStates = [];
    
    for (const key in result) {
      if (key.startsWith(LOADING_STATE_PREFIX)) {
        const state = result[key];
        if (state && state.status === 'loading') {
          // Check if still within timeout
          const timeSinceStart = Date.now() - state.timestamp;
          if (timeSinceStart <= LOADING_TIMEOUT_MS) {
            loadingStates.push(state);
          }
        }
      }
    }
    
    loadingLogger.info('Retrieved active loading states', { count: loadingStates.length });
    return loadingStates;
  } catch (error) {
    loadingLogger.error('Error getting active loading states:', error.message);
    return [];
  }
};

// Helper functions

/**
 * Get storage key for loading state
 * @param {string} url - Page URL
 * @param {string} tabId - Tab ID
 * @returns {string} Storage key
 */
function getLoadingStateKey(url, tabId) {
  return `${LOADING_STATE_PREFIX}${normalizeUrl(url)}#${tabId}`;
}

/**
 * Normalize URL for consistency
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    return url.trim().toLowerCase();
  } catch (error) {
    loadingLogger.error('Error normalizing URL:', error.message);
    return url;
  }
} 