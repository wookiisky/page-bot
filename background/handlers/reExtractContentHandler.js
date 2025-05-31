// background/handlers/reExtractContentHandler.js

async function handleReExtractContent(data, serviceLogger, configManager, storage, contentExtractor, safeSendTabMessage) {
    serviceLogger.info(`=== HANDLER RE_EXTRACT START ===`);
    const { url, method } = data;
    serviceLogger.info(`Handler RE_EXTRACT: URL = ${url}`);
    serviceLogger.info(`Handler RE_EXTRACT: Method = ${method}`);

    const config = await configManager.getConfig();
    // serviceLogger.info('Handler RE_EXTRACT: Got config:', config); // Potentially verbose
    // serviceLogger.info('Handler RE_EXTRACT: jinaResponseTemplate:', config.jinaResponseTemplate); // Potentially verbose

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
                            serviceLogger.warn('Error getting HTML from tab (re-extract):', chrome.runtime.lastError.message);
                            if (chrome.runtime.lastError.message === "Could not establish connection. Receiving end does not exist.") {
                                resolve('CONTENT_SCRIPT_NOT_CONNECTED');
                            } else {
                                resolve(null);
                            }
                        } else {
                            resolve(response?.htmlContent || null);
                        }
                    }
                );
            });
        });
    }

    try {
        if (method === 'readability' && !htmlContent) {
            serviceLogger.warn('HTML content not available for Readability re-extraction - possibly page still loading or content script issue.');
            return {
                type: 'CONTENT_UPDATE_ERROR',
                error: 'page_loading_or_script_issue'
            };
        }
        if (method === 'readability' && htmlContent === 'CONTENT_SCRIPT_NOT_CONNECTED') {
            serviceLogger.warn('HTML content not available (re-extract): Content script not connected.');
            return {
                type: 'CONTENT_UPDATE_ERROR',
                error: 'CONTENT_SCRIPT_NOT_CONNECTED'
            };
        }

        serviceLogger.info(`Calling contentExtractor.extract with method: ${method}`);
        const extractedContent = await contentExtractor.extract(url, htmlContent, method, config, true); // forceReExtract is true
        serviceLogger.info(`Content extraction result: ${extractedContent ? 'SUCCESS' : 'FAILED'}`);
        if (extractedContent) {
            serviceLogger.info(`Extracted content length: ${extractedContent.length}`);
        }

        if (extractedContent) {
            serviceLogger.info(`Saving extracted content with method: ${method}`);
            await storage.savePageContent(url, extractedContent, method);
            // const chatHistory = await storage.getChatHistory(url); // Not directly returned, so can be omitted here for now

            serviceLogger.info(`=== HANDLER RE_EXTRACT SUCCESS ===`);
            return { type: 'CONTENT_UPDATED', content: extractedContent, extractionMethod: method };
        } else {
            serviceLogger.info(`=== HANDLER RE_EXTRACT FAILED - NO CONTENT ===`);
            return { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to re-extract content' };
        }
    } catch (error) {
        serviceLogger.error('Error re-extracting content in reExtractContentHandler:', error);
        serviceLogger.info(`=== HANDLER RE_EXTRACT EXCEPTION ===`);
        return { type: 'CONTENT_UPDATE_ERROR', error: error.message || 'Failed to re-extract content' };
    }
} 