// background/handlers/getLoadingStateHandler.js

async function handleGetLoadingState(data, serviceLogger, loadingStateCache) {
    const { url, tabId } = data;
    
    if (!url || !tabId) {
        const error = 'Missing required fields: url and tabId are required';
        serviceLogger.error('GET_LOADING_STATE error:', error);
        return { type: 'GET_LOADING_STATE_ERROR', error };
    }
    
    try {
        serviceLogger.info(`Getting loading state for URL: ${url}, tabId: ${tabId}`);
        
        const loadingState = await loadingStateCache.getLoadingState(url, tabId);
        
        if (loadingState) {
            serviceLogger.info(`Loading state found for tab ${tabId}:`, loadingState.status);
            return { 
                type: 'LOADING_STATE_LOADED', 
                loadingState: loadingState 
            };
        } else {
            serviceLogger.info(`No loading state found for tab ${tabId}`);
            return { 
                type: 'LOADING_STATE_LOADED', 
                loadingState: null 
            };
        }
    } catch (error) {
        serviceLogger.error('Error getting loading state:', error);
        return { 
            type: 'GET_LOADING_STATE_ERROR', 
            error: error.message || 'Failed to get loading state' 
        };
    }
} 