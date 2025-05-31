// Readability Extractor Module for Read Bot

// This script should be imported by the main content_extractor.js using importScripts.
// It assumes 'logger' is available in the global scope.

const readabilityExtractorLogger = logger.createModuleLogger('ReadabilityExtractor');
const OFFSCREEN_DOCUMENT_PATH_FOR_READABILITY = '/offscreen.html'; // Ensure this path is correct

// Helper function to manage the offscreen document for Readability
async function getOrCreateOffscreenDocumentForReadability() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH_FOR_READABILITY)] // Match specific offscreen document
    });

    if (existingContexts.length > 0) {
        readabilityExtractorLogger.debug('Offscreen document for Readability already exists.');
        return existingContexts[0].documentId;
    }

    readabilityExtractorLogger.debug('Creating offscreen document for Readability.');
    await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH_FOR_READABILITY,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse HTML content with Readability.js for content extraction'
    });
    // It might be necessary to query again if documentId is needed and not directly available,
    // but createDocument resolves when the document is loaded.
}

// Extract with Readability.js via Offscreen Document
async function extractWithReadabilityViaOffscreen(htmlString, pageUrl) {
  if (!htmlString) {
    readabilityExtractorLogger.error('HTML content is required for Readability extraction');
    throw new Error('HTML content is required for Readability extraction');
  }

  readabilityExtractorLogger.debug('Starting Readability extraction via offscreen', { pageUrl });

  try {
    await getOrCreateOffscreenDocumentForReadability();
    
    readabilityExtractorLogger.debug('Sending message to offscreen document for Readability extraction', { pageUrl });
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen', // Assuming offscreen.js handles routing or this is the specific target name
      type: 'extract-content-readability', // More specific type for clarity
      htmlString: htmlString,
      pageUrl: pageUrl
    });

    if (response && response.success && typeof response.content === 'string') {
      readabilityExtractorLogger.info('Readability extraction successful via offscreen', { pageUrl, contentLength: response.content.length });
      return response.content;
    } else {
      const errorMessage = response && response.error ? response.error : 'Unknown error from offscreen document during Readability extraction';
      readabilityExtractorLogger.error('Error from offscreen document (Readability)', { errorMessage, pageUrl });
      throw new Error(`Failed to extract content with Readability via offscreen: ${errorMessage}`);
    }
  } catch (error) {
    readabilityExtractorLogger.error('Error with Readability (offscreen) extraction', { errorMessage: error.message, pageUrl });
    // Optional: Consider closing the offscreen document on error if it's not meant to be persistent.
    // await chrome.offscreen.closeDocument(); 
    throw new Error(`Failed to extract content with Readability: ${error.message}`);
  }
} 