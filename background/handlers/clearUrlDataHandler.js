// background/handlers/clearUrlDataHandler.js

async function handleClearUrlData(data, serviceLogger, storage) {
    const { url } = data;
    if (!url) {
        serviceLogger.warn('Handler: No URL provided for CLEAR_URL_DATA');
        return { success: false, error: 'No URL provided' };
    }

    try {
        // Clear both content and chat history for this URL
        serviceLogger.info(`Handler: Clearing data for URL: ${url}`);
        const success = await storage.clearUrlData(url, true, true);
        if (success) {
            serviceLogger.info(`Handler: Successfully cleared data for URL: ${url}`);
        } else {
            serviceLogger.warn(`Handler: Failed to clear data for URL: ${url} (storage.clearUrlData returned false)`);
        }
        return { success, error: success ? null : 'Failed to clear data from storage' };
    } catch (error) {
        serviceLogger.error('Handler: Error clearing URL data:', error);
        return { success: false, error: error.message || 'Unknown error clearing data' };
    }
} 