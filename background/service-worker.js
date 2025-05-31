// Read Bot service worker script
// Handles background processes, messaging, and coordinates between UI and functionality

// Import required modules using importScripts instead of dynamic import
importScripts('../js/modules/logger.js');
importScripts('../js/modules/config_manager.js');
importScripts('../js/modules/storage.js');
importScripts('../js/modules/content_extractor.js');
// Ensure providers are loaded before llm_service.js
// importScripts('../js/modules/page_content_extractor.js'); // Removed as it does not exist
importScripts('../js/modules/llm_provider/gemini_provider.js');
importScripts('../js/modules/llm_provider/openai_provider.js');
importScripts('../js/modules/llm_service.js');
// importScripts('../js/modules/jina_ai_service.js'); // Removed as it does not exist

// Import utility functions
importScripts('utils.js');

// Import message handlers
importScripts('handlers/getPageDataHandler.js');
importScripts('handlers/switchExtractionMethodHandler.js');
importScripts('handlers/reExtractContentHandler.js');
importScripts('handlers/sendLlmMessageHandler.js');
importScripts('handlers/clearUrlDataHandler.js');
importScripts('handlers/configHandler.js');

// Import event listener handlers
importScripts('handlers/tabActivationHandler.js');
importScripts('handlers/tabUpdateHandler.js');

// Initialize logger for service worker
const serviceLogger = logger ? logger.createModuleLogger('ServiceWorker') : console;

// Helper functions (safeSendMessage, safeSendTabMessage, isRestrictedPage, checkSidePanelAllowed)
// are now defined in utils.js and imported via importScripts.
// They are available globally within the service worker scope.

// Set up event listeners when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  serviceLogger.info('Read Bot extension installed or updated');
  
  await configManager.initializeIfNeeded();
  
  serviceLogger.info('Extension setup complete');
});

// Extension startup
serviceLogger.info('Read Bot service worker started');

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  serviceLogger.info('Extension icon clicked, tab URL:', tab?.url);
  
  if (tab && tab.url && isRestrictedPage(tab.url)) {
    serviceLogger.info('Clicked on restricted page, showing notification');
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'Read Bot',
        message: 'Read Bot cannot work on Chrome internal pages (chrome://, chrome-extension://, etc.). Please navigate to a regular webpage to use the extension.'
      });
    } catch (error) {
      serviceLogger.error('Error creating notification:', error);
      try {
        await chrome.notifications.create({
          type: 'basic',
          title: 'Read Bot',
          message: 'Read Bot cannot work on Chrome internal pages (chrome://, chrome-extension://, etc.). Please navigate to a regular webpage to use the extension.'
        });
      } catch (fallbackError) {
        serviceLogger.error('Error creating fallback notification:', fallbackError);
      }
    }
  } else {
    serviceLogger.info('Clicked on normal page, trying to open side panel');
    try {
      if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        serviceLogger.info('Successfully opened side panel');
      }
    } catch (error) {
      serviceLogger.error('Error opening side panel:', error);
      try {
        // const behavior = await chrome.sidePanel.getPanelBehavior(); // Logging behavior might be too verbose or error-prone
      } catch (behaviorError) {
        serviceLogger.error('Error getting panel behavior:', behaviorError);
      }
    }
  }
});

// Tab activation listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Pass serviceLogger to handler, and isRestrictedPage & safeSendMessage are now global
  await handleTabActivated(activeInfo, serviceLogger, isRestrictedPage, (msg) => safeSendMessage(msg, serviceLogger));
});

// Tab URL change listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Pass serviceLogger to handler, other dependencies are global or passed within handler
  await handleTabUpdated(tabId, changeInfo, tab, serviceLogger, configManager, storage, (msg) => safeSendMessage(msg, serviceLogger));
});

// Message handling from sidebar.js and content_script.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
    serviceLogger.info('Service worker received message:', message.type);
    
    try {
      const { type, ...data } = message;
      
      switch (type) {
        case 'GET_PAGE_DATA': {
          return await handleGetPageData(data, serviceLogger, configManager, storage, contentExtractor, 
            (tabId, msg, callback) => safeSendTabMessage(tabId, msg, serviceLogger, callback));
        }
        case 'SWITCH_EXTRACTION_METHOD': {
          return await handleSwitchExtractionMethod(data, serviceLogger, configManager, storage, contentExtractor, 
            (tabId, msg, callback) => safeSendTabMessage(tabId, msg, serviceLogger, callback));
        }
        case 'RE_EXTRACT_CONTENT': {
          return await handleReExtractContent(data, serviceLogger, configManager, storage, contentExtractor, 
            (tabId, msg, callback) => safeSendTabMessage(tabId, msg, serviceLogger, callback));
        }
        case 'SEND_LLM_MESSAGE': {
          return await handleSendLlmMessage(data, serviceLogger, configManager, storage, llmService, 
            (msg) => safeSendMessage(msg, serviceLogger));
        }
        case 'CLEAR_URL_DATA': {
          return await handleClearUrlData(data, serviceLogger, storage);
        }
        case 'GET_CONFIG':
          return await handleGetConfig(configManager, serviceLogger);
        case 'SAVE_CONFIG':
          return await handleSaveConfig(data, configManager, serviceLogger);
        default:
          return { type: 'UNKNOWN_MESSAGE', error: `Unknown message type: ${type}` };
      }
    } catch (error) {
      serviceLogger.error('Error handling message:', error);
      return { type: 'ERROR', error: error.message || 'Unknown error in service worker' };
    }
  };
  
  handleMessage().then(sendResponse).catch(error => {
    serviceLogger.error('Unhandled error in handleMessage promise:', error);
    sendResponse({ type: 'ERROR', error: error.message || 'Critical unhandled error in service worker' });
  });
  return true; // Crucial for asynchronous sendResponse
}); 
