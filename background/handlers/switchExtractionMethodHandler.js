// background/handlers/switchExtractionMethodHandler.js

async function handleSwitchExtractionMethod(data, serviceLogger, configManager, storage, contentExtractor, safeSendTabMessage) {
    serviceLogger.info(`=== HANDLER SWITCH METHOD START ===`);
    const { url, method } = data;
    serviceLogger.info(`Handler SWITCH: URL = ${url}`);
    serviceLogger.info(`Handler SWITCH: Method = ${method}`);

    // Check if we have cached content for this method
    const cachedContent = await storage.getPageContent(url, method);
    // const chatHistory = await storage.getChatHistory(url); // Chat history is not directly used in the response for this handler

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
        serviceLogger.info('Getting HTML content for readability extraction');
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

                serviceLogger.info(`Sending GET_HTML_CONTENT to tab ${tabs[0].id}`);
                safeSendTabMessage(
                    tabs[0].id,
                    { type: 'GET_HTML_CONTENT' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            serviceLogger.warn('Error getting HTML from tab (switch method):', chrome.runtime.lastError.message);
                            if (chrome.runtime.lastError.message === "Could not establish connection. Receiving end does not exist.") {
                                serviceLogger.warn('Content script not connected - this may be the issue');
                                resolve('CONTENT_SCRIPT_NOT_CONNECTED');
                            } else {
                                resolve(null);
                            }
                        } else {
                            serviceLogger.info('Received HTML content response:', {
                                hasResponse: !!response,
                                hasHtmlContent: !!(response && response.htmlContent),
                                htmlLength: response && response.htmlContent ? response.htmlContent.length : 0,
                                warning: response ? response.warning : null
                            });
                            resolve(response?.htmlContent || null);
                        }
                    }
                );
            });
        });
        
        serviceLogger.info('HTML content retrieval completed:', {
            hasHtmlContent: !!htmlContent,
            htmlLength: htmlContent && typeof htmlContent === 'string' ? htmlContent.length : 0,
            isErrorState: htmlContent === 'CONTENT_SCRIPT_NOT_CONNECTED'
        });
    }

    try {
        if (method === 'readability' && !htmlContent) {
            serviceLogger.warn('HTML content not available for Readability extraction - possibly page still loading or content script issue.');
            return {
                type: 'CONTENT_UPDATE_ERROR',
                error: 'page_loading_or_script_issue'
            };
        }
        if (method === 'readability' && htmlContent === 'CONTENT_SCRIPT_NOT_CONNECTED') {
            serviceLogger.warn('HTML content not available (switch method): Content script not connected.');
            return {
                type: 'CONTENT_UPDATE_ERROR',
                error: 'CONTENT_SCRIPT_NOT_CONNECTED'
            };
        }

        serviceLogger.info(`Calling contentExtractor.extract with method: ${method}`, {
            hasHtmlContent: !!htmlContent,
            htmlLength: htmlContent ? htmlContent.length : 0
        });
        const extractedContent = await contentExtractor.extract(url, htmlContent, method, config);
        serviceLogger.info(`Content extraction result: ${extractedContent ? 'SUCCESS' : 'FAILED'}`, {
            extractedLength: extractedContent ? extractedContent.length : 0
        });

        if (extractedContent) {
            serviceLogger.info(`Extracted content length: ${extractedContent.length}`);
            serviceLogger.info(`Saving extracted content with method: ${method}`);
            await storage.savePageContent(url, extractedContent, method);

            serviceLogger.info(`=== HANDLER SWITCH METHOD SUCCESS ===`);
            return { type: 'CONTENT_UPDATED', content: extractedContent, extractionMethod: method };
        } else {
            serviceLogger.info(`=== HANDLER SWITCH METHOD FAILED - NO CONTENT ===`);
            return { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to extract content' };
        }
    } catch (error) {
        serviceLogger.error('Error extracting content in switchExtractionMethodHandler:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        serviceLogger.info(`=== HANDLER SWITCH METHOD EXCEPTION ===`);
        return { type: 'CONTENT_UPDATE_ERROR', error: error.message || 'Failed to extract content' };
    }
} 