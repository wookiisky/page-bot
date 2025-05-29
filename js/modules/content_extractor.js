// Read Bot Content Extractor Module
// Handles various methods for extracting content from web pages

// Create a global contentExtractor object
var contentExtractor = {};

// Create module logger
const extractorLogger = logger.createModuleLogger('ContentExtractor');

// Import utils.js using importScripts
// Ensure utils.js does not rely on DOM APIs if used solely in the service worker context.
// If utils.js also has DOM-dependent parts, they might need adjustment or to be moved to offscreen.
importScripts('../js/utils.js'); 

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

// Main extract function
contentExtractor.extract = async function(url, htmlString, method, config) {
  if (!url) {
    throw new Error('URL is required for extraction');
  }
  
  extractorLogger.info(`Starting content extraction`, { url, method, hasHtml: !!htmlString, hasApiKey: !!config?.jinaApiKey });
  
  try {
    let result;
    switch (method) {
      case 'jina':
        result = await extractWithJina(url, config.jinaApiKey, config.jinaResponseTemplate);
        break;

      case 'readability':
        result = await extractWithReadabilityViaOffscreen(htmlString, url);
        break;
        
      default:
        throw new Error(`Unknown extraction method: ${method}`);
    }
    
    if (result) {
      extractorLogger.info(`Content extraction successful`, { url, method, resultLength: result.length });
    } else {
      extractorLogger.warn(`Content extraction returned empty result`, { url, method });
    }
    
    return result;
    
  } catch (error) {
    extractorLogger.error(`Content extraction failed`, { url, method, error: error.message });
    throw error; // Re-throw to be caught by the caller in service-worker.js
  }
}

// Helper function to manage the offscreen document
async function getOrCreateOffscreenDocument() {
    // Check if an offscreen document is already active.
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });

    if (existingContexts.length > 0) {
        return existingContexts[0].documentId; // Should ideally match a specific documentId if managing multiple.
    }

    // Create an offscreen document.
    // We can specify multiple reasons, but for now, just DOM_PARSER is sufficient for Readability.
    await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse HTML content with Readability.js'
    });
    // Note: createDocument resolves when the document has been created and loaded.
    // We might need to query again to get the documentId if not returned directly or needed for specific targeting.
}

// Extract with Readability.js via Offscreen Document
async function extractWithReadabilityViaOffscreen(htmlString, pageUrl) {
  if (!htmlString) {
    throw new Error('HTML content is required for Readability extraction');
  }

  try {
    await getOrCreateOffscreenDocument();
    
    // Send a message to the offscreen document to process the HTML.
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'extract-content',
      htmlString: htmlString,
      pageUrl: pageUrl // Sending pageUrl in case offscreen.js needs it for base URI or other logic
    });

    if (response && response.success) {
      return response.content;
    } else {
      const errorMessage = response && response.error ? response.error : 'Unknown error from offscreen document';
      extractorLogger.error('Error from offscreen document:', errorMessage);
      throw new Error(`Failed to extract content with Readability via offscreen: ${errorMessage}`);
    }
  } catch (error) {
    extractorLogger.error('Error with Readability (offscreen) extraction:', error.message);
    // Optional: Consider closing the offscreen document on error if it's not meant to be persistent.
    // await chrome.offscreen.closeDocument(); 
    throw new Error(`Failed to extract content with Readability: ${error.message}`);
  }
}

// Extract with Jina AI
async function extractWithJina(url, apiKey, responseTemplate) {
  extractorLogger.debug('Starting Jina extraction', { url, hasApiKey: !!apiKey, hasTemplate: !!responseTemplate });
  
  // Define extraction strategies in order of preference
  const strategies = [];
  
  // If API key is provided, add authenticated strategy first
  if (apiKey) {
    extractorLogger.debug('Adding authenticated Jina strategy');
    // Strategy 1: r.jina.ai with API key (JSON response)
    strategies.push({
      name: 'r.jina.ai (authenticated)',
      execute: () => callJinaAPI('https://r.jina.ai/', url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }, true)
    });
  }
  
  // Strategy 2: Free r.jina.ai service (JSON response)
  extractorLogger.debug('Adding free Jina strategy');
  strategies.push({
    name: 'r.jina.ai (free)',
    execute: () => callJinaAPI('https://r.jina.ai/', url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }, true)
  });
  
  extractorLogger.info(`Trying ${strategies.length} Jina extraction strategies`, { url });
  
  // Try each strategy in order
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    try {
      extractorLogger.debug(`Trying Jina strategy: ${strategy.name}`, { url, attempt: i + 1, total: strategies.length });
      const result = await strategy.execute();
      
      if (result) {
        extractorLogger.info(`Jina strategy succeeded: ${strategy.name}`, { url });
        // Apply template formatting if available
        const formatted = formatJinaResponse(result.data || result, responseTemplate, url, false);
        return formatted;
      } else {
        extractorLogger.warn(`Jina strategy returned empty result: ${strategy.name}`, { url });
      }
    } catch (error) {
      extractorLogger.warn(`Jina strategy failed: ${strategy.name}`, { url, error: error.message });
      // Continue to next strategy
    }
  }
  
  extractorLogger.error('All Jina extraction strategies failed', { url, strategiesAttempted: strategies.length });
  throw new Error('All Jina AI services failed');
}

// Unified Jina AI API call function
async function callJinaAPI(baseUrl, url, options, expectJson = true) {
  // Build the request URL
  let requestUrl;
  if (options.method === 'GET') {
    requestUrl = `${baseUrl}${encodeURIComponent(url)}`;
  } else {
    requestUrl = baseUrl;
  }
  
  extractorLogger.debug(`Calling Jina API`, { requestUrl, method: options.method });
  
  const response = await fetch(requestUrl, options);
  
  if (!response.ok) {
    throw new Error(`Jina AI service returned: ${response.status} ${response.statusText}`);
  }
  
  let data;
  if (expectJson) {
    data = await response.json();
    if (!data) {
      throw new Error('No data returned from Jina AI service');
    }
  } else {
    data = await response.text();
    if (!data || !data.trim()) {
      throw new Error('No content returned from Jina AI service');
    }
  }
  
  return data;
}

// Format Jina AI response using template
function formatJinaResponse(data, template, originalUrl) {
  extractorLogger.debug('Formatting Jina response', { 
    hasData: !!data, 
    hasTemplate: !!template, 
    originalUrl: originalUrl
  });
  
  // If no template provided, return content directly
  if (!template) {
    extractorLogger.debug('No template provided, returning raw content');
    return data.content || data.text || JSON.stringify(data, null, 2);
  }
  
  // Extract fields from Jina response (all services now return JSON)
  const title = data.title || 'Untitled';
  const url = data.url || '';
  const description = data.description || '';
  const content = data.content || '';
  
  extractorLogger.debug('Extracted fields for template', { title, url, description, contentLength: content.length });
  
  // Replace placeholders in template
  let formatted = template
    .replace(/\{title\}/g, title)
    .replace(/\{url\}/g, url)
    .replace(/\{description\}/g, description)
    .replace(/\{content\}/g, content);
  
  extractorLogger.debug('Template formatting completed', { resultLength: formatted.length });
  return formatted;
}



// Removed loadReadability, htmlToMarkdown, and decodeHtmlEntities as they are moved or handled by offscreen.js 