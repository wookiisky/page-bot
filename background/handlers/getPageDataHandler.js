// background/handlers/getPageDataHandler.js

// Ensure modules used here are globally available via importScripts in service-worker.js
// or pass them as arguments if a more modular approach is taken later.

async function handleGetPageData(data, serviceLogger, configManager, storage, contentExtractor, safeSendTabMessage) {
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
    serviceLogger.info('Handler: Got config:', config);
    // serviceLogger.info('Handler: jinaResponseTemplate:', config.jinaResponseTemplate); // This might be too verbose if not always needed

    try {
      // Request content from content script if needed
      let htmlContent = null;
      if (defaultMethod === 'readability') {
        htmlContent = await new Promise((resolve, reject) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
              serviceLogger.error('Error querying tabs:', chrome.runtime.lastError.message);
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (tabs.length === 0) {
              serviceLogger.warn('No active tab found for GET_HTML_CONTENT');
              resolve(null); // Resolve with null if no active tab
              return;
            }

            safeSendTabMessage(
              tabs[0].id,
              { type: 'GET_HTML_CONTENT' },
              (response) => {
                if (chrome.runtime.lastError) {
                  serviceLogger.info('Error getting HTML from tab:', chrome.runtime.lastError.message);
                  if (chrome.runtime.lastError.message === "Could not establish connection. Receiving end does not exist.") {
                    resolve('CONTENT_SCRIPT_NOT_CONNECTED');
                  } else {
                    resolve(null); // Resolve with null on other errors
                  }
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
        serviceLogger.warn('HTML content not available for Readability extraction - possibly page still loading or content script issue.');
        return {
          type: 'PAGE_DATA_ERROR',
          error: 'page_loading_or_script_issue' // More generic error
        };
      }
      if (defaultMethod === 'readability' && htmlContent === 'CONTENT_SCRIPT_NOT_CONNECTED') {
        serviceLogger.warn('HTML content not available: Content script not connected.');
        return {
          type: 'PAGE_DATA_ERROR',
          error: 'CONTENT_SCRIPT_NOT_CONNECTED'
        };
      }

      const extractedContent = await contentExtractor.extract(url, htmlContent, defaultMethod, config);

      if (extractedContent) {
        await storage.savePageContent(url, extractedContent, defaultMethod);
        // Re-fetch chat history, although it's unlikely to change in this specific flow,
        // but for consistency if other operations might modify it concurrently.
        const freshChatHistory = await storage.getChatHistory(url);
        const newPageData = { content: extractedContent, chatHistory: freshChatHistory, extractionMethod: defaultMethod };
        return { type: 'PAGE_DATA_LOADED', data: newPageData };
      } else {
        return { type: 'PAGE_DATA_ERROR', error: 'Failed to extract content (content might be null or extraction failed)' };
      }
    } catch (error) {
      serviceLogger.error('Error extracting content in getPageDataHandler:', error);
      return { type: 'PAGE_DATA_ERROR', error: error.message || 'Failed to extract content' };
    }
  }
}

// Make the handler available (e.g. by attaching to a global object if not using ES6 modules directly in SW)
// For now, we'll rely on importScripts and call it directly.
// If this file were a module, you'd export it: export { handleGetPageData }; 