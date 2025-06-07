// offscreen.js

// Import logger module (fallback to console if not available in offscreen context)
const logger = (() => {
  try {
    return window.logger ? window.logger.createModuleLogger('@offscreen') : console;
  } catch (e) {
    return console;
  }
})();

// Listen for messages from the service worker.
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
  if (message.target !== 'offscreen') {
    return false; // Not for us
  }

  switch (message.type) {
    case 'extract-content':
    case 'extract-content-readability':
      try {
        logger.debug(`Processing message type: ${message.type}`, { pageUrl: message.pageUrl });
        const article = processWithReadability(message.htmlString, message.pageUrl);
        if (article && article.content) {
          const markdown = htmlToMarkdown(article.content);
          const fullContent = `# ${article.title || 'Untitled'}\n\n${markdown}`;
          logger.info('Readability processing successful', { pageUrl: message.pageUrl, title: article.title });
          sendResponse({ success: true, content: fullContent });
        } else {
          logger.error('Readability failed to parse content or extract title/content', { pageUrl: message.pageUrl });
          sendResponse({ success: false, error: 'Readability failed to parse content or extract title/content.' });
        }
      } catch (e) {
        logger.error('Error in offscreen document during Readability processing:', { pageUrl: message.pageUrl, error: e.message, stack: e.stack });
        sendResponse({ success: false, error: e.toString() });
      }
      return true; // Indicates an asynchronous response.
    default:
      logger.warn(`Unexpected message type received: '${message.type}'.`, { receivedMessage: message });
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return false;
  }
}

function processWithReadability(htmlString, pageUrl) {
  if (!self.Readability) {
    logger.error('Readability library not loaded in offscreen document.');
    throw new Error('Readability library not loaded.');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Set baseURI for proper relative URL resolution by Readability
  if (pageUrl) {
    let base = doc.querySelector('base');
    if (!base) {
      base = doc.createElement('base');
      doc.head.appendChild(base);
    }
    base.href = pageUrl;
    logger.debug('Set base href for Readability document', { pageUrl });
  } else if (doc.baseURI === "about:blank" && doc.head) {
    // Fallback if pageUrl is not provided, though it's less ideal
    let base = doc.createElement('base');
    base.href = 'http://localhost/'; 
    doc.head.appendChild(base);
    logger.warn('pageUrl not provided for Readability, using generic localhost base.');
  }

  const reader = new self.Readability(doc);
  return reader.parse();
}

// Convert HTML to Markdown using Turndown
function htmlToMarkdown(html) {
  try {
    if (typeof TurndownService === 'undefined') {
      logger.error('TurndownService is not loaded.');
      throw new Error('TurndownService is not loaded.');
    }
    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use '#' for headings
      codeBlockStyle: 'fenced', // Use '```' for code blocks
      bulletListMarker: '-', // Use '-' for unordered lists (common in GFM)
      emDelimiter: '*', // Use '*' for emphasis (italic)
      strongDelimiter: '**', // Use '**' for strong (bold)
      linkStyle: 'inlined', // Output links as [text](url)
      // fence: '```', // Default is '```', so not strictly necessary to set
      // hr: '---', // Default is '* * *', GFM often uses '---'
    });    

    // For basic GFM compatibility, we might need to add rules for strikethrough if desired
    // turndownService.addRule('strikethrough', {
    //   filter: ['del', 's', 'strike'],
    //   replacement: function (content) {
    //     return '~' + content + '~'; // GFM uses single tilde for strikethrough
    //   }
    // });
    // For now, we will stick to built-in options.

    let markdown = turndownService.turndown(html);
    
    // Turndown might leave some HTML entities, decode them
    // The decodeHtmlEntities function is still useful.
    markdown = decodeHtmlEntities(markdown);

    // Additional cleanup: Turndown usually handles this well, but an extra pass for multiple blank lines can be useful.
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return markdown.trim();
  } catch (error) {
    logger.error('Error converting HTML to Markdown with Turndown:', { errorMessage: error.message, stack: error.stack, originalHtmlLength: html.length });
    // Fallback to a very basic stripping or return original HTML snippet to avoid breaking flow.
    // For now, returning a simple error message in markdown.
    return `> Error during Markdown conversion: ${error.message}`;
  }
}

// Decode HTML entities (Copied from content_extractor.js - still useful)
function decodeHtmlEntities(text) {
  if (typeof document === 'undefined') {
    // This function cannot run in a Worker without a 'document' object.
    // Handle this case, perhaps by returning text as is or throwing an error.
    // For Offscreen document, 'document' will be available.
    logger.warn('decodeHtmlEntities called in an environment without `document`. This should be in an offscreen document.');
    return text; // Or throw an error, depending on desired behavior
  }
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
} 