// Read Bot service worker script
// Handles background processes, messaging, and coordinates between UI and functionality

// Import required modules using importScripts instead of dynamic import
importScripts('../js/modules/logger.js');
importScripts('../js/modules/config_manager.js');
importScripts('../js/modules/storage.js');
importScripts('../js/modules/content_extractor.js');
importScripts('../js/modules/llm_service.js');

// Initialize logger for service worker
const serviceLogger = logger ? logger.createModuleLogger('ServiceWorker') : console;

// Helper function to safely send messages
function safeSendMessage(message) {
  // Check if there are any listeners before sending message
  chrome.runtime.sendMessage(
    message,
    // Add a callback to catch and silence the error
    () => {
      if (chrome.runtime.lastError) {
        // Quietly handle the error - this is expected when sidebar is closed
        serviceLogger.debug('Message destination unavailable, this is normal when sidebar is closed');
      }
    }
  );
}

// Helper function to safely send messages to tabs
function safeSendTabMessage(tabId, message, callback) {
  chrome.tabs.sendMessage(
    tabId, 
    message,
    (response) => {
      // Handle potential error
      if (chrome.runtime.lastError) {
        serviceLogger.debug(`Tab message error: ${chrome.runtime.lastError.message}`);
        // Call callback with null if provided
        if (callback) callback(null);
        return;
      }
      
      // Normal case - call callback with response
      if (callback) callback(response);
    }
  );
}

// Helper function to check if URL is a restricted Chrome internal page
function isRestrictedPage(url) {
  if (!url) return true;
  
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'moz-extension://',
    'chrome-search://',
    'chrome-devtools://',
    'devtools://'
  ];
  
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

// Helper function to check if current page allows side panel
async function checkSidePanelAllowed(tabUrl = null) {
  try {
    let url = tabUrl;
    
    // If no URL provided, get current active tab
    if (!url) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        serviceLogger.warn('No active tab found');
        return false;
      }
      
      // Check if tab.url exists and is valid
      if (!tab.url) {
        serviceLogger.warn('Tab URL is undefined');
        return false;
      }
      
      url = tab.url;
    }
    
    const allowed = !isRestrictedPage(url);
    serviceLogger.info(`Side panel ${allowed ? 'allowed' : 'not allowed'} for page:`, url);
    return allowed;
  } catch (error) {
    serviceLogger.error('Error checking side panel permission:', error);
    return false;
  }
}

// Set up event listeners when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  serviceLogger.info('Read Bot extension installed or updated');
  
  // Initialize default configurations if not already set
  await configManager.initializeIfNeeded();
  
  serviceLogger.info('Extension setup complete');
  
  // Optional: Set up context menu items
  // chrome.contextMenus.create({
  //   id: 'readBotMain',
  //   title: 'Read Bot',
  //   contexts: ['page', 'selection']
  // });
});

// Extension startup
serviceLogger.info('Read Bot service worker started');

// Handle extension icon clicks - try to open side panel manually
chrome.action.onClicked.addListener(async (tab) => {
  serviceLogger.info('Extension icon clicked, tab URL:', tab?.url);
  
  if (tab && tab.url && isRestrictedPage(tab.url)) {
    serviceLogger.info('Clicked on restricted page, showing notification');
    // Show notification for restricted pages
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'Read Bot',
        message: 'Read Bot cannot work on Chrome internal pages (chrome://, chrome-extension://, etc.). Please navigate to a regular webpage to use the extension.'
      });
    } catch (error) {
      serviceLogger.error('Error creating notification:', error);
      // Fallback: create notification without icon
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
    // For normal pages, try to open the side panel
    try {
      if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        serviceLogger.info('Successfully opened side panel');
      }
    } catch (error) {
      serviceLogger.error('Error opening side panel:', error);
      // Log current behavior for debugging
      try {
        const behavior = await chrome.sidePanel.getPanelBehavior();
        serviceLogger.debug('Current panel behavior:', behavior);
      } catch (behaviorError) {
        serviceLogger.error('Error getting panel behavior:', behaviorError);
      }
    }
  }
});

// Tab activation listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      serviceLogger.info('Tab switched to:', tab.url);
      
      // Close side panel when switching tabs
      try {
        // Get all windows and close side panel in each
        const windows = await chrome.windows.getAll();
        for (const window of windows) {
          try {
            // Try to close side panel for this window
            await chrome.sidePanel.setOptions({
              tabId: activeInfo.tabId,
              enabled: false
            });
            serviceLogger.debug('Side panel closed due to tab switch');
            
            // Re-enable after a short delay
            setTimeout(async () => {
              try {
                await chrome.sidePanel.setOptions({
                  tabId: activeInfo.tabId,
                  enabled: true
                });
                serviceLogger.debug('Side panel re-enabled for new tab');
              } catch (error) {
                serviceLogger.debug('Error re-enabling side panel:', error.message);
              }
            }, 100);
            
            break; // Only need to do this once
          } catch (error) {
            // Ignore errors for individual windows
          }
        }
      } catch (error) {
        serviceLogger.debug('Error closing side panel on tab switch:', error.message);
      }
      
      // Send tab change notification to sidebar if it's open
      safeSendMessage({
        type: 'TAB_CHANGED',
        url: tab.url
      });
    } else {
      serviceLogger.warn('Tab activation: tab or tab.url is undefined');
    }
  } catch (error) {
    serviceLogger.error('Error handling tab activation:', error);
  }
});

// Tab URL change listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    serviceLogger.info('Tab updated to:', tab.url);
    
    // Check if this is the active tab to avoid unnecessary operations
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isActiveTab = activeTab && activeTab.id === tabId;
    
    if (isActiveTab) {
      // Don't close side panel on URL change - just notify sidebar to update content
      serviceLogger.info('Page loaded, notifying sidebar to update content');
      
      // Auto-load content for the new URL
      try {
        const config = await configManager.getConfig();
        const defaultMethod = config.defaultExtractionMethod;
        
        // Check if we have cached content
        const cachedContent = await storage.getPageContent(tab.url, defaultMethod);
        const chatHistory = await storage.getChatHistory(tab.url);
        
        if (cachedContent) {
          serviceLogger.info('Found cached content for URL:', tab.url);
          // Send cached data to sidebar
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
          serviceLogger.info('No cached content found, will extract using default method:', defaultMethod);
          // Send signal to sidebar to extract content
          safeSendMessage({
            type: 'AUTO_EXTRACT_CONTENT',
            url: tab.url,
            tabId: tabId,
            extractionMethod: defaultMethod
          });
        }
      } catch (error) {
        serviceLogger.error('Error auto-loading content:', error);
        // Still notify sidebar about URL change as fallback
        safeSendMessage({
          type: 'TAB_UPDATED',
          url: tab.url,
          tabId: tabId
        });
      }
    }
    
  } else if (changeInfo.status === 'complete') {
    serviceLogger.info('Tab updated: tab or tab.url is undefined');
  }
});

// Message handling from sidebar.js and content_script.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Using async function for promise handling
  const handleMessage = async () => {
    serviceLogger.info('Service worker received message:', message.type);
    
    try {
      const { type, ...data } = message;
      
      switch (type) {
        case 'GET_PAGE_DATA': {
          const { url } = data;
          const config = await configManager.getConfig();
          const defaultMethod = config.defaultExtractionMethod;
          
          // Get cached content and chat history separately
          const cachedContent = await storage.getPageContent(url, defaultMethod);
          const chatHistory = await storage.getChatHistory(url);
          
          if (cachedContent) {
            return { 
              type: 'PAGE_DATA_LOADED', 
              data: { 
                content: cachedContent, 
                chatHistory: chatHistory,
                extractionMethod: defaultMethod
              } 
            };
          } else {
            // Need to extract content
            serviceLogger.info('Service Worker: Got config:', config);
            serviceLogger.info('Service Worker: jinaResponseTemplate:', config.jinaResponseTemplate);
            
            try {
              // Request content from content script if needed
              let htmlContent = null;
              if (defaultMethod === 'readability') {
                // We need HTML content from the content script
                htmlContent = await new Promise((resolve, reject) => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (chrome.runtime.lastError) {
                      serviceLogger.error('Error querying tabs:', chrome.runtime.lastError.message);
                      return reject(new Error(chrome.runtime.lastError.message));
                    }
                    if (tabs.length === 0) {
                      serviceLogger.warn('No active tab found for GET_HTML_CONTENT');
                      resolve(null);
                      return;
                    }
                    
                    safeSendTabMessage(
                      tabs[0].id, 
                      { type: 'GET_HTML_CONTENT' },
                      (response) => {
                        if (chrome.runtime.lastError) {
                           serviceLogger.error('Error getting HTML from tab:', chrome.runtime.lastError.message);
                           resolve(null);
                        } else {
                           resolve(response?.htmlContent || null);
                        }
                      }
                    );
                  });
                });
              }
              
              // Ensure HTML content is available for Readability method
              if (defaultMethod === 'readability' && !htmlContent) {
                serviceLogger.warn('HTML content not available for Readability extraction - possibly page still loading');
                return { 
                  type: 'PAGE_DATA_ERROR', 
                  error: 'page_loading' 
                };
              }
              
              const extractedContent = await contentExtractor.extract(url, htmlContent, defaultMethod, config);
              
              if (extractedContent) {
                // Save content and get existing chat history
                await storage.savePageContent(url, extractedContent, defaultMethod);
                const chatHistory = await storage.getChatHistory(url);
                const newPageData = { content: extractedContent, chatHistory: chatHistory, extractionMethod: defaultMethod };
                return { type: 'PAGE_DATA_LOADED', data: newPageData };
              } else {
                return { type: 'PAGE_DATA_ERROR', error: 'Failed to extract content (content might be null or extraction failed)' };
              }
            } catch (error) {
              serviceLogger.error('Error extracting content:', error);
              return { type: 'PAGE_DATA_ERROR', error: error.message || 'Failed to extract content' };
            }
          }
        }
        
        case 'SWITCH_EXTRACTION_METHOD': {
          serviceLogger.info(`=== SERVICE WORKER SWITCH METHOD START ===`);
          const { url, method } = data;
          serviceLogger.info(`Service Worker SWITCH: URL = ${url}`);
          serviceLogger.info(`Service Worker SWITCH: Method = ${method}`);
          
          // Check if we have cached content for this method
          const cachedContent = await storage.getPageContent(url, method);
          const chatHistory = await storage.getChatHistory(url);
          
          if (cachedContent) {
            serviceLogger.info(`Found cached content for method: ${method}, length: ${cachedContent.length}`);
            return { 
              type: 'CONTENT_UPDATED', 
              content: cachedContent, 
              extractionMethod: method 
            };
          }
          
          // No cache, need to extract content
          serviceLogger.info(`No cached content for method: ${method}, extracting...`);
          const config = await configManager.getConfig();
          
          let htmlContent = null;
          if (method === 'readability') {
            htmlContent = await new Promise((resolve, reject) => {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                  serviceLogger.error('Error querying tabs:', chrome.runtime.lastError.message);
                  return reject(new Error(chrome.runtime.lastError.message));
                }
                if (tabs.length === 0) {
                  serviceLogger.warn('No active tab found for GET_HTML_CONTENT (switch method)');
                  resolve(null);
                  return;
                }
                
                safeSendTabMessage(
                  tabs[0].id, 
                  { type: 'GET_HTML_CONTENT' },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      serviceLogger.error('Error getting HTML from tab (switch method):', chrome.runtime.lastError.message);
                      resolve(null);
                    } else {
                      resolve(response?.htmlContent || null);
                    }
                  }
                );
              });
            });
          }
          
          try {
            // Ensure HTML content is available for Readability method
            if (method === 'readability' && !htmlContent) {
              serviceLogger.warn('HTML content not available for Readability extraction - possibly page still loading');
              return { 
                type: 'CONTENT_UPDATE_ERROR', 
                error: 'page_loading' 
              };
            }
            
            serviceLogger.info(`Calling contentExtractor.extract with method: ${method}`);
            const extractedContent = await contentExtractor.extract(url, htmlContent, method, config);
            serviceLogger.info(`Content extraction result: ${extractedContent ? 'SUCCESS' : 'FAILED'}`);
            
            if (extractedContent) {
              serviceLogger.info(`Extracted content length: ${extractedContent.length}`);
              // Save the new content
              serviceLogger.info(`Saving extracted content with method: ${method}`);
              await storage.savePageContent(url, extractedContent, method);
              
              serviceLogger.info(`=== SERVICE WORKER SWITCH METHOD SUCCESS ===`);
              return { type: 'CONTENT_UPDATED', content: extractedContent, extractionMethod: method };
            } else {
              serviceLogger.info(`=== SERVICE WORKER SWITCH METHOD FAILED - NO CONTENT ===`);
              return { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to extract content' };
            }
          } catch (error) {
            serviceLogger.error('Error extracting content:', error);
            serviceLogger.info(`=== SERVICE WORKER SWITCH METHOD EXCEPTION ===`);
            return { type: 'CONTENT_UPDATE_ERROR', error: error.message || 'Failed to extract content' };
          }
        }

        case 'RE_EXTRACT_CONTENT': {
          serviceLogger.info(`=== SERVICE WORKER RE_EXTRACT START ===`);
          const { url, method } = data;
          serviceLogger.info(`Service Worker RE_EXTRACT: URL = ${url}`);
          serviceLogger.info(`Service Worker RE_EXTRACT: Method = ${method}`);
          
          const config = await configManager.getConfig();
          serviceLogger.info('Service Worker RE_EXTRACT: Got config:', config);
          serviceLogger.info('Service Worker RE_EXTRACT: jinaResponseTemplate:', config.jinaResponseTemplate);
          
          // For retry operation, we always force re-extraction (skip cache)
          serviceLogger.info(`Forcing re-extraction for method: ${method} (retry operation)`);
          
          let htmlContent = null;
          if (method === 'readability') {
            htmlContent = await new Promise((resolve, reject) => {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                 if (chrome.runtime.lastError) {
                    serviceLogger.error('Error querying tabs:', chrome.runtime.lastError.message);
                    return reject(new Error(chrome.runtime.lastError.message));
                  }
                if (tabs.length === 0) {
                  serviceLogger.warn('No active tab found for GET_HTML_CONTENT (re-extract)');
                  resolve(null);
                  return;
                }
                
                safeSendTabMessage(
                  tabs[0].id, 
                  { type: 'GET_HTML_CONTENT' },
                  (response) => {
                     if (chrome.runtime.lastError) {
                        serviceLogger.error('Error getting HTML from tab (re-extract): ', chrome.runtime.lastError.message);
                        resolve(null);
                     } else {
                        resolve(response?.htmlContent || null);
                     }
                  }
                );
              });
            });
          }
          
          try {
            // Ensure HTML content is available for Readability method
            if (method === 'readability' && !htmlContent) {
              serviceLogger.warn('HTML content not available for Readability re-extraction - possibly page still loading');
              return { 
                type: 'CONTENT_UPDATE_ERROR', 
                error: 'page_loading' 
              };
            }
            
            serviceLogger.info(`Calling contentExtractor.extract with method: ${method}`);
            const extractedContent = await contentExtractor.extract(url, htmlContent, method, config);
            serviceLogger.info(`Content extraction result: ${extractedContent ? 'SUCCESS' : 'FAILED'}`);
            if (extractedContent) {
              serviceLogger.info(`Extracted content length: ${extractedContent.length}`);
            }
            
            if (extractedContent) {
              // Save the new content and get existing chat history
              serviceLogger.info(`Saving extracted content with method: ${method}`);
              await storage.savePageContent(url, extractedContent, method);
              const chatHistory = await storage.getChatHistory(url);
              
              serviceLogger.info(`=== SERVICE WORKER RE_EXTRACT SUCCESS ===`);
              return { type: 'CONTENT_UPDATED', content: extractedContent, extractionMethod: method };
            } else {
              serviceLogger.info(`=== SERVICE WORKER RE_EXTRACT FAILED - NO CONTENT ===`);
              return { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to re-extract content' };
            }
          } catch (error) {
            serviceLogger.error('Error re-extracting content:', error);
            serviceLogger.info(`=== SERVICE WORKER RE_EXTRACT EXCEPTION ===`);
            return { type: 'CONTENT_UPDATE_ERROR', error: error.message || 'Failed to re-extract content' };
          }
        }
        
        case 'SEND_LLM_MESSAGE': {
          const { messages, systemPromptTemplate, extractedPageContent, imageBase64, currentUrl, extractionMethod } = data.payload;
          const config = await configManager.getConfig();
          const llmConfig = {
            provider: config.llm.defaultProvider,
            ...config.llm.providers[config.llm.defaultProvider]
          };
          
          // Replace {CONTENT} placeholder in system prompt with extracted content
          const systemPrompt = systemPromptTemplate.replace('{CONTENT}', extractedPageContent || '');
          
          let assistantResponse = '';
          let error = null;
          
          try {
            // Create a stream callback to send chunks to sidebar
            const streamCallback = (chunk) => {
              if (chunk !== undefined && chunk !== null) {
                serviceLogger.debug('ServiceWorker received chunk from LLMService, sending to UI:', chunk);
                safeSendMessage({ type: 'LLM_STREAM_CHUNK', chunk });
                serviceLogger.debug('Sending chunk to UI:', chunk);
              }
            };
            
            const doneCallback = async (fullResponse) => {
              serviceLogger.info('LLM stream finished. Full response:', fullResponse);
              safeSendMessage({ type: 'LLM_STREAM_END', fullResponse });
              
              // Update and save chat history
              if (message.payload && message.payload.currentUrl && messages) {
                const updatedMessages = [
                  ...messages,
                  { role: 'assistant', content: fullResponse }
                ];
                await storage.saveChatHistory(message.payload.currentUrl, updatedMessages);
                serviceLogger.info('Chat history updated and saved for URL:', message.payload.currentUrl);
              } else {
                serviceLogger.warn('Could not save chat history: missing currentUrl or messages in payload.');
              }
            };
            
            const errorCallback = (err) => {
              error = err;
              safeSendMessage({ type: 'LLM_ERROR', error: err.message || 'Error calling LLM' });
            };
            
            // Call the LLM service
            await llmService.callLLM(
              messages, 
              llmConfig, 
              systemPrompt, 
              imageBase64, 
              streamCallback, 
              doneCallback, 
              errorCallback
            );
            
            // For synchronous response:
            return { type: 'LLM_REQUEST_RECEIVED' };
          } catch (err) {
            serviceLogger.error('Error calling LLM:', err);
            return { type: 'LLM_ERROR', error: err.message || 'Error calling LLM' };
          }
        }
        
        case 'CLEAR_URL_DATA': {
          const { url } = data;
          if (!url) {
            return { success: false, error: 'No URL provided' };
          }
          
          try {
            // Clear both content and chat history for this URL
            const success = await storage.clearUrlData(url, true, true);
            return { success, error: success ? null : 'Failed to clear data' };
          } catch (error) {
            serviceLogger.error('Error clearing URL data:', error);
            return { success: false, error: error.message || 'Unknown error clearing data' };
          }
        }
        
        case 'GET_CONFIG':
          return { 
            type: 'CONFIG_LOADED', 
            config: await configManager.getConfig() 
          };
          
        case 'SAVE_CONFIG':
          await configManager.saveConfig(data.config);
          return { type: 'CONFIG_SAVED' };
          
        default:
          return { type: 'UNKNOWN_MESSAGE', error: `Unknown message type: ${type}` };
      }
    } catch (error) {
      serviceLogger.error('Error handling message:', error);
      return { type: 'ERROR', error: error.message || 'Unknown error in service worker' };
    }
  };
  
  // Handle async response pattern
  handleMessage().then(sendResponse).catch(error => {
    // Catch any unhandled promise rejections from handleMessage
    serviceLogger.error('Unhandled error in handleMessage promise:', error);
    sendResponse({ type: 'ERROR', error: error.message || 'Critical unhandled error in service worker' });
  });
  return true; // Crucial for asynchronous sendResponse
}); 
