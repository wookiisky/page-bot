// background/handlers/tabUpdateHandler.js

// Ensure necessary global variables (serviceLogger, configManager, storage, safeSendMessage) 
// are available or passed as parameters.

async function handleTabUpdated(tabId, changeInfo, tab, serviceLogger, configManager, storage, safeSendMessage) {
    if (changeInfo.status === 'complete' && tab && tab.url) {
        serviceLogger.info('Tab updated to:', tab.url);

        // Check if this is the active tab to avoid unnecessary operations
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isActiveTab = activeTab && activeTab.id === tabId;

        if (isActiveTab) {
            serviceLogger.info('Active page loaded, notifying sidebar and checking for auto-load/extract.');

            try {
                const config = await configManager.getConfig();
                const defaultMethod = config.defaultExtractionMethod;

                const cachedContent = await storage.getPageContent(tab.url, defaultMethod);
                // const chatHistory = await storage.getChatHistory(tab.url); // Fetched along with content if cached

                if (cachedContent) {
                    serviceLogger.info('Found cached content for URL:', tab.url);
                    const chatHistory = await storage.getChatHistory(tab.url); // Get history for cached content
                    safeSendMessage({
                        type: 'AUTO_LOAD_CONTENT',
                        url: tab.url,
                        tabId: tabId,
                        data: {
                            content: cachedContent,
                            chatHistory: chatHistory,
                            extractionMethod: defaultMethod
                        }
                    });
                } else {
                    serviceLogger.info('No cached content found, signaling sidebar to extract using default method:', defaultMethod);
                    safeSendMessage({
                        type: 'AUTO_EXTRACT_CONTENT',
                        url: tab.url,
                        tabId: tabId,
                        extractionMethod: defaultMethod
                    });
                }
            } catch (error) {
                serviceLogger.error('Error auto-loading/extracting content in tabUpdateHandler:', error);
                // Fallback: still notify sidebar about URL change, so it can attempt to load/extract manually
                safeSendMessage({
                    type: 'TAB_UPDATED', // Generic update, sidebar can decide action
                    url: tab.url,
                    tabId: tabId
                });
            }
        } else {
            serviceLogger.info('Tab updated but not active, no auto-load/extract action taken.');
        }

    } else if (changeInfo.status === 'complete') {
        serviceLogger.info('Tab update complete, but tab or tab.url is undefined. ChangeInfo:', changeInfo);
    } else if (changeInfo.status) {
        // Log other status changes if needed, e.g., 'loading'
        // serviceLogger.debug(`Tab status changed to: ${changeInfo.status} for tabId: ${tabId}`);
    }
} 