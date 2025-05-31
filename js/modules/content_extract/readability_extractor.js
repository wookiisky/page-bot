// Readability Extractor Module for Page Bot

// This script should be imported by the main content_extractor.js using importScripts.
// It assumes 'logger' is available in the global scope.

const readabilityExtractorLogger = logger.createModuleLogger('ReadabilityExtractor');
const OFFSCREEN_DOCUMENT_PATH_FOR_READABILITY = '/offscreen/offscreen.html'; // Updated path to match new location

// Helper function to manage the offscreen document for Readability
async function getOrCreateOffscreenDocumentForReadability() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH_FOR_READABILITY)] // Match specific offscreen document
    });

    if (existingContexts.length > 0) {
        return existingContexts[0].documentId;
    }

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
    throw new Error('HTML content is required for Readability extraction');
  }

  try {
    await getOrCreateOffscreenDocumentForReadability();
    
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen', // Assuming offscreen.js handles routing or this is the specific target name
      type: 'extract-content-readability', // More specific type for clarity
      htmlString: htmlString,
      pageUrl: pageUrl
    });

    if (response && response.success && typeof response.content === 'string') {
      return response.content;
    } else {
      const errorMessage = response && response.error ? response.error : 'Unknown error from offscreen document during Readability extraction';
      throw new Error(`Failed to extract content with Readability via offscreen: ${errorMessage}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract content with Readability: ${error.message}`);
  }
} 