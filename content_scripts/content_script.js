// Page Bot content script
// Runs in the context of web pages
// Handles content extraction and communication with the background script

// Import logger module (fallback to console if not available in content script context)
const logger = (() => {
  try {
    return window.logger ? window.logger.createModuleLogger('ContentScript') : console;
  } catch (e) {
    return console;
  }
})();

// Store any Readability.js script we might inject
let readabilityScript = null;

// Flag to track if the page is fully loaded
let pageLoaded = document.readyState === 'complete';

// Listen for page load complete event
window.addEventListener('load', () => {
  pageLoaded = true;
  logger.info('Page fully loaded');
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.info('Content script received message:', message.type);
  
  if (message.type === 'GET_HTML_CONTENT') {
    // Check if the page is fully loaded
    if (pageLoaded) {
      sendResponse({
        htmlContent: document.documentElement.outerHTML
      });
    } else {
      // If the page is not yet fully loaded, wait for it to load before returning content
      logger.info('Page not fully loaded yet, waiting...');
      
      // Set a timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        logger.warn('Timeout reached, sending current HTML content');
        sendResponse({
          htmlContent: document.documentElement.outerHTML,
          warning: 'Page was not fully loaded (timeout)'
        });
      }, 5000); // 5 second timeout
      
      // Listen for the load event, respond immediately after the page is loaded
      window.addEventListener('load', () => {
        clearTimeout(timeout);
        logger.info('Page loaded, sending HTML content');
        sendResponse({
          htmlContent: document.documentElement.outerHTML
        });
      }, { once: true });
      
      return true; // Keep the message channel open for asynchronous response
    }
    return true;
  }
  
  if (message.type === 'EXTRACT_WITH_READABILITY') {
    try {
      // Load Readability.js if not already loaded
      if (!window.Readability) {
        // We would normally inject the script here, but for this extension
        // we'll be using the imported version in the background script
        logger.warn('Readability.js not available in content script.');
      }
      
      // If Readability is available, use it
      if (window.Readability) {
        const documentClone = document.cloneNode(true);
        const article = new window.Readability(documentClone).parse();
        
        sendResponse({
          title: article.title,
          content: article.content,
          textContent: article.textContent,
          excerpt: article.excerpt
        });
      } else {
        // Fallback to basic extraction
        sendResponse({
          title: document.title,
          content: document.body.innerHTML,
          textContent: document.body.innerText,
          excerpt: document.body.innerText.substring(0, 200)
        });
      }
    } catch (error) {
      logger.error('Error extracting content with Readability:', error);
      sendResponse({
        error: error.message || 'Error extracting content with Readability'
      });
    }
    return true;
  }
});

// Log when the content script has loaded
logger.info('Page Bot content script loaded on:', document.location.href); 