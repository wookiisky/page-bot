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


// Convert HTML to Markdown (Copied from content_extractor.js)
function htmlToMarkdown(html) {
  try {
    // Simple conversion for common HTML elements
    let markdown = html;
    
    markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match, content) => content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n');
    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match, content) => content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent, offset) => `${offset / liMatch.length + 1}. ${liContent}\n`) + '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n'); // Fallback for LI outside UL/OL though less common
    markdown = markdown.replace(/<img src="(.*?)"[^>]* alt="(.*?)"[^>]*>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img src="(.*?)"[^>]*>/gi, '![]($1)');
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
    markdown = markdown.replace(/<hr[^>]*>/gi, '\n---\n\n');
    markdown = markdown.replace(/<br[^>]*>/gi, '\n');
    
    markdown = markdown.replace(/<[^>]*>/g, '');
    markdown = decodeHtmlEntities(markdown);
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return markdown.trim();
  } catch (error) {
    logger.error('Error converting HTML to Markdown:', error);
    return html; 
  }
}

// Decode HTML entities (Copied from content_extractor.js)
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