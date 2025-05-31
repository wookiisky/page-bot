// Read Bot Popup JavaScript
// Handles UI interaction and communication with the background script

// Import logger module
const logger = window.logger ? window.logger.createModuleLogger('Sidebar') : console;

// Current page URL and extracted content
let currentUrl = '';
let extractedContent = '';
let chatHistory = [];
let imageBase64 = null;
let currentExtractionMethod = 'readability'; // Track current extraction method

// Resize functionality variables
let isResizing = false;
let startY = 0;
let startHeight = 0;

// DOM Elements
const extractedContentElem = document.getElementById('extractedContent');
const loadingIndicator = document.getElementById('loadingIndicator');
const extractionError = document.getElementById('extractionError');
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const jinaExtractBtn = document.getElementById('jinaExtractBtn');
const readabilityExtractBtn = document.getElementById('readabilityExtractBtn');
const quickInputsContainer = document.getElementById('quickInputs');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const copyContentBtn = document.getElementById('copyContentBtn');
const retryExtractBtn = document.getElementById('retryExtractBtn');
const contentSection = document.getElementById('contentSection');
const resizeHandle = document.getElementById('resizeHandle');
const includePageContentCheckbox = document.getElementById('includePageContent');

// Initialize when the panel loads
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Side panel loaded');
  
  // Apply configured size for side panel
  await applyPanelSize();
  
  // Reset content section height to config default each time panel opens
  await resetContentSectionHeight();
  
  // Initial loading of content
  await loadCurrentPageData();
  
  // Load quick inputs from config
  loadQuickInputs();
  
  // Set up event listeners
  setupEventListeners();
});

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

// Load data for current page
async function loadCurrentPageData() {
  // Get current tab URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    currentUrl = tabs[0].url;
    logger.info('Current URL:', currentUrl);
    
    // Check if this is a restricted page
    if (isRestrictedPage(currentUrl)) {
      hideLoading();
      showRestrictedPageMessage();
      return;
    }
    
    // Show loading state
    showLoading('Loading page data...');
    
    // Load page data from background script
    try {
      // Add a small delay to allow service worker to initialize
      await new Promise(resolve => setTimeout(resolve, 100)); 
      logger.info('Attempting to send GET_PAGE_DATA to service worker');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PAGE_DATA',
        url: currentUrl
      });
      logger.info('Received response for GET_PAGE_DATA:', response);
      
      if (response.type === 'PAGE_DATA_LOADED') {
        // Data loaded successfully
        await handlePageDataLoaded(response.data);
      } else if (response.type === 'PAGE_DATA_ERROR') {
        // Error loading data
        showExtractionError(response.error);
      }
    } catch (error) {
      logger.error('Error requesting page data:', error); // This log should appear in sidebar console
      showExtractionError('Failed to communicate with the background script. Details: ' + (error.message || 'Unknown error'));
    }
  } else {
    showExtractionError('No active tab found');
  }
}

// Extract content for current URL using specified method
async function extractContentForCurrentUrl() {
  if (!currentUrl) {
    showExtractionError('No URL available for extraction');
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PAGE_DATA',
      url: currentUrl
    });
    
    if (response.type === 'PAGE_DATA_LOADED') {
      // Data loaded successfully
      await handlePageDataLoaded(response.data);
    } else if (response.type === 'PAGE_DATA_ERROR') {
      // Error loading data
      showExtractionError(response.error);
    }
  } catch (error) {
    logger.error('Error extracting content for current URL:', error);
    showExtractionError('Failed to extract content');
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Send message button
  sendBtn.addEventListener('click', sendUserMessage);
  
  // Enter key in input box sends message
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });
  
  // Export conversation
  exportBtn.addEventListener('click', exportConversation);
  
  // Clear conversation and context
  clearBtn.addEventListener('click', clearConversationAndContext);
  
  // Extraction method buttons
  jinaExtractBtn.addEventListener('click', () => switchExtractionMethod('jina'));
  readabilityExtractBtn.addEventListener('click', () => switchExtractionMethod('readability'));
  
  // Image paste handling
  userInput.addEventListener('paste', handleImagePaste);
  
  // Remove attached image
  removeImageBtn.addEventListener('click', removeAttachedImage);
  
  // Copy extracted content
  copyContentBtn.addEventListener('click', copyExtractedContent);
  
  // Retry extraction
  retryExtractBtn.addEventListener('click', () => {
    // Check if button is disabled
    if (retryExtractBtn.disabled || retryExtractBtn.classList.contains('disabled')) {
      return;
    }
    logger.info(`Retry button clicked, current extraction method: ${currentExtractionMethod}`);
    reExtractContent(currentExtractionMethod);
  });
  
  // Resize handle events
  resizeHandle.addEventListener('mousedown', startResize);
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);

  // Listen for messages from background script (for streaming LLM responses and tab changes)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LLM_STREAM_CHUNK') {
      logger.debug('Sidebar received LLM_STREAM_CHUNK:', message.chunk);
      handleStreamChunk(message.chunk);
    } else if (message.type === 'LLM_STREAM_END') {
      logger.debug('Sidebar received LLM_STREAM_END');
      handleStreamEnd(message.fullResponse);
    } else if (message.type === 'LLM_ERROR') {
      handleLlmError(message.error);
    } else if (message.type === 'TAB_CHANGED') {
      // Tab switched, reload data if URL different
      if (message.url !== currentUrl) {
        logger.info(`Tab changed. New URL: ${message.url}`);
        currentUrl = message.url;
        loadCurrentPageData(); // Load data for the new URL without reloading the panel
      }
    } else if (message.type === 'AUTO_LOAD_CONTENT') {
      // Auto-load cached content for new URL
      if (message.url !== currentUrl) {
        logger.info(`Auto-loading cached content for URL: ${message.url}`);
        currentUrl = message.url;
        handlePageDataLoaded(message.data);
      }
    } else if (message.type === 'AUTO_EXTRACT_CONTENT') {
      // Auto-extract content for new URL
      if (message.url !== currentUrl) {
        logger.info(`Auto-extracting content for URL: ${message.url}`);
        currentUrl = message.url;
        currentExtractionMethod = message.extractionMethod;
        
        // Check if this is a restricted page
        if (isRestrictedPage(currentUrl)) {
          hideLoading();
          showRestrictedPageMessage();
          return;
        }
        
        // Show loading and extract content
        showLoading('Extracting content...');
        extractContentForCurrentUrl();
      }
    } else if (message.type === 'TAB_UPDATED') {
      // Legacy fallback for tab updates
      if (message.url !== currentUrl) {
        logger.info(`Tab updated. New URL: ${message.url}`);
        currentUrl = message.url;
        loadCurrentPageData();
      }
    }
  });
}

// Handle page data loaded from background script
async function handlePageDataLoaded(data) {
  hideLoading();
  
  // Re-enable buttons in case they were disabled on a restricted page
  jinaExtractBtn.disabled = false;
  readabilityExtractBtn.disabled = false;
  userInput.disabled = false;
  sendBtn.disabled = false;
  
  // Update extracted content and display
  if (data && data.content) {
    extractedContent = data.content; // Store extracted content
    await displayExtractedContent(extractedContent); // Display content in UI
    copyContentBtn.classList.add('visible'); // Show copy button
    copyContentBtn.disabled = false;
  } else {
    extractedContent = ''; // Clear extracted content if none found
    showExtractionError('No content could be extracted.');
    copyContentBtn.classList.remove('visible');
    copyContentBtn.disabled = true;
  }
  
  // Update extraction method UI based on what was actually used
  if (data && data.extractionMethod) {
    currentExtractionMethod = data.extractionMethod;
    if (typeof updateExtractionButtonUI === 'function') {
      updateExtractionButtonUI();
    } else {
      logger.error('updateExtractionButtonUI function is not defined when trying to call it.');
    }
    logger.info(`Content displayed using method: ${currentExtractionMethod}`);
  }

  // Use chat history directly from the data provided by the service worker
  if (data && data.chatHistory) {
    chatHistory = data.chatHistory;
  } else {
    chatHistory = []; // Default to empty array if not provided
  }
  displayChatHistory(chatHistory);
  
  // Enable or disable retry button based on success
  retryExtractBtn.disabled = !extractedContent;
  if (extractedContent) {
    retryExtractBtn.classList.remove('disabled');
    retryExtractBtn.classList.add('visible');
  } else {
    retryExtractBtn.classList.add('disabled');
    // Keep visible to allow retry
  }
}

// Display the extracted content in the UI
async function displayExtractedContent(content) {
  if (!content) {
    showExtractionError('No content extracted');
    return;
  }
  
  // Display raw markdown content instead of rendering it
  extractedContentElem.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(content)}</pre>`;
  
  // Show action buttons when content is available and enable them (orange state)
  copyContentBtn.classList.add('visible');
  retryExtractBtn.classList.add('visible');
  copyContentBtn.classList.remove('disabled');
  retryExtractBtn.classList.remove('disabled');
  copyContentBtn.classList.add('enabled');
  retryExtractBtn.classList.add('enabled');
  copyContentBtn.disabled = false;
  retryExtractBtn.disabled = false;
  
  // Content height is now managed by the resize functionality
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display chat history in the UI
function displayChatHistory(history) {
  chatContainer.innerHTML = '';
  
  if (!history || history.length === 0) {
    return;
  }
  
  history.forEach(message => {
    appendMessageToUI(message.role, message.content);
  });
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Append a new message to the chat UI
function appendMessageToUI(role, content, imageBase64, isStreaming = false) {
  const messageTimestamp = Date.now(); // For unique ID if needed
  logger.info(`[appendMessageToUI ${messageTimestamp}] Role: ${role}, Streaming: ${isStreaming}, Content: ${content ? content.substring(0, 50) + '...' : 'empty'}`);
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
  messageDiv.id = `message-${messageTimestamp}`;
  
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  roleDiv.textContent = ''; // Role text is not currently used, can be added if needed
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (role === 'assistant' && isStreaming) {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Condition for streaming assistant placeholder met.`);
    try {
      // The content passed for streaming placeholder is already HTML with spinner
      contentDiv.innerHTML = content; 
      logger.info(`[appendMessageToUI ${messageTimestamp}] Applied raw HTML content for streaming placeholder.`);
    } catch (error) {
      logger.error(`[appendMessageToUI ${messageTimestamp}] Error setting innerHTML for streaming placeholder:`, error);
      contentDiv.textContent = content; // Fallback
    }
    messageDiv.dataset.streaming = 'true';
    logger.info(`[appendMessageToUI ${messageTimestamp}] Set data-streaming=true on messageDiv (ID: ${messageDiv.id}). Element:`, messageDiv);
  } else {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Not a streaming assistant placeholder. Role: ${role}, Streaming: ${isStreaming}`);
    try {
      contentDiv.innerHTML = window.marked.parse(content);
      logger.info(`[appendMessageToUI ${messageTimestamp}] Parsed Markdown for normal message.`);
    } catch (error) {
      logger.error(`[appendMessageToUI ${messageTimestamp}] Error parsing markdown for normal message:`, error);
      contentDiv.textContent = content; // Fallback to plain text
    }
  }
  
  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  
  // Add action buttons for completed messages (not for streaming placeholders initially)
  // Now applies to both 'user' and 'assistant' roles
  if ((role === 'user' || role === 'assistant') && !isStreaming && content) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.dataset.content = content;
    copyTextButton.onclick = () => copyMessageText(content);
    
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.dataset.content = content; // For user messages, this will be plain text
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content); // For user, effectively same as copyText
    
    buttonContainer.appendChild(copyTextButton);
    buttonContainer.appendChild(copyMarkdownButton);
    messageDiv.appendChild(buttonContainer);
    logger.info(`[appendMessageToUI ${messageTimestamp}] Added action buttons for ${role} message.`);
  }
  
  chatContainer.appendChild(messageDiv);
  logger.info(`[appendMessageToUI ${messageTimestamp}] Message div (ID: ${messageDiv.id}) appended to chatContainer. Child count: ${chatContainer.childElementCount}`);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return messageDiv; // Return the element itself
}

// Send user message to LLM
async function sendUserMessage() {
  const userText = userInput.value.trim();
  if (!userText && !imageBase64) {
    logger.warn('Attempted to send an empty message');
    return;
  }

  // Clear input and disable send button
  userInput.value = '';
  sendBtn.disabled = true;
  
  // Optimistically add user message to UI
  appendMessageToUI('user', userText, imageBase64);
  
  // Add user message to local chatHistory array for optimistic UI update
  // The service worker will handle the actual saving of the complete history (user + assistant)
  chatHistory.push({ role: 'user', content: userText });
  
  // Prepare payload for service worker
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = null;
  const config = await getConfig();

  // Default system prompt from config (usually contains {CONTENT})
  systemPromptTemplateForPayload = config.systemPrompt ;
  pageContentForPayload = extractedContent;

  if (includePageContentCheckbox.checked) {
    logger.info('Including page content in the message. Extracted content will be sent.');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nContent:\n' + extractedContent; // Send current extracted content
  } else {
    logger.info('Not including page content in the message. Extracted content will be null.');
    
  }
  logger.info(['sys', includePageContentCheckbox.checked, systemPromptTemplateForPayload]);
    
  

  // Show loading indicator in chat
  // Make sure this is called *before* sending the message to ensure UI updates promptly
  const loadingMsgId = appendMessageToUI('assistant', '<div class="spinner"></div> Thinking...', null, true);
  
  // Remove image after sending if one was attached
  if (imageBase64) {
    removeAttachedImage();
  }

  try {
    // Send message to background script for LLM processing
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE', // Corrected type
      payload: { // Corrected structure
        messages: chatHistory, // Full history including current user message
        systemPromptTemplate: systemPromptTemplateForPayload,
        extractedPageContent: pageContentForPayload,
        imageBase64: imageBase64, // This remains null if no image was attached
        currentUrl: currentUrl,
        extractionMethod: currentExtractionMethod
      }
    });
  } catch (error) {
    logger.error('Error sending message to LLM via service worker:', error);
    handleLlmError('Failed to send message to the AI. Check service worker logs.');
    // It's important to also update the UI if the sendMessage itself fails.
    // The handleLlmError function should ideally remove the loading indicator.
    if (loadingMsgId && typeof loadingMsgId === 'string') { // if appendMessageToUI returned an ID
        const loadingMessageElement = document.getElementById(loadingMsgId);
        if (loadingMessageElement) {
            const contentDiv = loadingMessageElement.querySelector('.message-content');
            if (contentDiv) contentDiv.innerHTML = `<span style="color: var(--error-color);">Error: Failed to send message.</span>`;
            loadingMessageElement.removeAttribute('data-streaming');
        }
    } else if (loadingMsgId && loadingMsgId.classList) { // if it returned the element itself
        const contentDiv = loadingMsgId.querySelector('.message-content');
        if (contentDiv) contentDiv.innerHTML = `<span style="color: var(--error-color);">Error: Failed to send message.</span>`;
        loadingMsgId.removeAttribute('data-streaming');
    }
  }
}

// Handle streaming chunk from LLM
function handleStreamChunk(chunk) {
  // Find the message that's currently streaming
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    const streamingMessageContentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!streamingMessageContentDiv) return;

    // Remove spinner if it exists (should only be there on the first chunk)
    const spinner = streamingMessageContentDiv.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }
    
    // Append the new chunk to the buffer and re-render markdown
    let currentBuffer = streamingMessageContainer.dataset.markdownBuffer || '';
    currentBuffer += chunk;
    streamingMessageContainer.dataset.markdownBuffer = currentBuffer;
    
    try {
      streamingMessageContentDiv.innerHTML = window.marked.parse(currentBuffer);
    } catch (error) {
        logger.error('Error parsing markdown during stream:', error);
        // Fallback: append as text, but this might mix with previous HTML
        const textNode = document.createTextNode(chunk);
        streamingMessageContentDiv.appendChild(textNode);
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Handle the end of a stream
function handleStreamEnd(fullResponse) {
  logger.info('[handleStreamEnd] Received fullResponse:', fullResponse ? fullResponse.substring(0, 100) + '...' : 'empty_or_null');
  // Find the message that was streaming
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    logger.info('[handleStreamEnd] Found streamingMessageContainer:', streamingMessageContainer);
    // Update the content with the full response
    const contentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!contentDiv) {
      logger.error('[handleStreamEnd] streamingMessageContainer found, but .message-content child is missing!');
      // Attempt to clear the streaming attribute anyway to prevent multiple stuck loaders
      streamingMessageContainer.removeAttribute('data-streaming');
      return;
    }
    logger.info('[handleStreamEnd] Found contentDiv:', contentDiv);
    
    try {
      logger.info('[handleStreamEnd] Attempting to parse Markdown...');
      contentDiv.innerHTML = window.marked.parse(fullResponse);
      logger.info('[handleStreamEnd] Markdown parsed and applied to contentDiv.');
    } catch (markdownError) {
      logger.error('[handleStreamEnd] Error parsing Markdown:', markdownError);
      contentDiv.textContent = fullResponse; // Fallback to plain text
      logger.info('[handleStreamEnd] Applied fullResponse as plain text due to Markdown error.');
    }
        
    // Remove the streaming flag
    streamingMessageContainer.removeAttribute('data-streaming');
    logger.info('[handleStreamEnd] Removed data-streaming attribute.');
    
    // Add action buttons for assistant messages
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // Copy text button
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.onclick = () => copyMessageText(fullResponse);
    
    // Copy markdown button
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(fullResponse);
    
    buttonContainer.appendChild(copyTextButton);
    buttonContainer.appendChild(copyMarkdownButton);
    
    // Ensure buttons are added to the correct position
    streamingMessageContainer.appendChild(buttonContainer);
    logger.info('[handleStreamEnd] Action buttons added.');
    
    // Add to chat history (assistant response)
    // This is for UI consistency; actual saving is done by service worker.
    // Let's remove this to avoid potential confusion or double entries if logic changes.
    // chatHistory.push({ role: 'assistant', content: fullResponse });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    logger.info('[handleStreamEnd] Scrolled to bottom.');
  } else {
    logger.warn('[handleStreamEnd] streamingMessageContainer not found! UI might be stuck or already updated.');
  }
}

// Handle LLM API error
function handleLlmError(error, streamingMessageElement = null) {
  logger.error('LLM Error:', error);
  
  // Try to find a streaming message if one isn't passed
  const messageElement = streamingMessageElement || chatContainer.querySelector('[data-streaming="true"]');
  
  if (messageElement) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.innerHTML = `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`;
    }
    messageElement.removeAttribute('data-streaming'); // Ensure streaming flag is removed
  } else {
    // If no streaming message (e.g., error happened before one was created or already handled),
    // append a new error message.
    appendMessageToUI('assistant', `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`);
  }
  
  // Re-enable send button if it was disabled
  sendBtn.disabled = false;
}

// Switch extraction method (check cache first, extract if needed)
async function switchExtractionMethod(method) {
  logger.info(`=== SWITCH EXTRACTION METHOD START ===`);
  logger.info(`Switching to method: ${method}`);
  logger.info(`Current URL: ${currentUrl}`);
  logger.info(`Current extraction method before: ${currentExtractionMethod}`);
  
  // Check if this is a restricted page
  if (isRestrictedPage(currentUrl)) {
    logger.info('Cannot switch extraction method on restricted page');
    return;
  }
  
  // If already using this method, do nothing
  if (currentExtractionMethod === method) {
    logger.info(`Already using method: ${method}, no action needed`);
    return;
  }
  
  showLoading(`Switching to ${method === 'jina' ? 'Jina AI' : 'Readability'} extraction...`);
  
  // Update active button styling
  jinaExtractBtn.classList.toggle('active', method === 'jina');
  readabilityExtractBtn.classList.toggle('active', method === 'readability');
  logger.info(`Button styling updated - Jina active: ${method === 'jina'}, Readability active: ${method === 'readability'}`);
  
  try {
    logger.info(`Sending SWITCH_EXTRACTION_METHOD message to background script...`);
    const response = await chrome.runtime.sendMessage({
      type: 'SWITCH_EXTRACTION_METHOD',
      url: currentUrl,
      method: method
    });
    
    logger.info(`Received response from background script:`, response);
    
    if (response.type === 'CONTENT_UPDATED') {
      // Content updated successfully
      logger.info(`Content updated successfully with method: ${response.extractionMethod || method}`);
      extractedContent = response.content;
      currentExtractionMethod = response.extractionMethod || method; // Update current extraction method
      logger.info(`Current extraction method after: ${currentExtractionMethod}`);
      await displayExtractedContent(extractedContent);
      hideLoading();
      logger.info(`=== SWITCH EXTRACTION METHOD SUCCESS ===`);
    } else if (response.type === 'CONTENT_UPDATE_ERROR') {
      // Error updating content
      logger.info(`Content update error: ${response.error}`);
      showExtractionError(response.error);
      logger.info(`=== SWITCH EXTRACTION METHOD ERROR ===`);
    } else {
      logger.info(`Unexpected response type: ${response.type}`);
      showExtractionError('Unexpected response from background script');
      logger.info(`=== SWITCH EXTRACTION METHOD UNEXPECTED ===`);
    }
  } catch (error) {
    logger.error('Error switching extraction method:', error);
    showExtractionError('Failed to communicate with the background script');
    logger.info(`=== SWITCH EXTRACTION METHOD EXCEPTION ===`);
  }
}

// Re-extract content using current method (force re-extraction)
async function reExtractContent(method) {
  logger.info(`=== RE-EXTRACT START ===`);
  logger.info(`Re-extracting with method: ${method}`);
  logger.info(`Current URL: ${currentUrl}`);
  logger.info(`Current extraction method before: ${currentExtractionMethod}`);
  
  // Check if this is a restricted page
  if (isRestrictedPage(currentUrl)) {
    logger.info('Cannot re-extract content on restricted page');
    return;
  }
  
  showLoading(`Re-extracting with ${method === 'jina' ? 'Jina AI' : 'Readability'}...`);
  
  // Update active button styling
  jinaExtractBtn.classList.toggle('active', method === 'jina');
  readabilityExtractBtn.classList.toggle('active', method === 'readability');
  logger.info(`Button styling updated - Jina active: ${method === 'jina'}, Readability active: ${method === 'readability'}`);
  
  try {
    logger.info(`Sending RE_EXTRACT_CONTENT message to background script...`);
    const response = await chrome.runtime.sendMessage({
      type: 'RE_EXTRACT_CONTENT',
      url: currentUrl,
      method: method
    });
    
    logger.info(`Received response from background script:`, response);
    
    if (response.type === 'CONTENT_UPDATED') {
      // Content updated successfully
      logger.info(`Content updated successfully with method: ${response.extractionMethod || method}`);
      extractedContent = response.content;
      currentExtractionMethod = response.extractionMethod || method; // Update current extraction method
      logger.info(`Current extraction method after: ${currentExtractionMethod}`);
      await displayExtractedContent(extractedContent);
      hideLoading();
      logger.info(`=== RE-EXTRACT SUCCESS ===`);
    } else if (response.type === 'CONTENT_UPDATE_ERROR') {
      // Error updating content
      logger.info(`Content update error: ${response.error}`);
      showExtractionError(response.error);
      logger.info(`=== RE-EXTRACT ERROR ===`);
    } else {
      logger.info(`Unexpected response type: ${response.type}`);
      showExtractionError('Unexpected response from background script');
      logger.info(`=== RE-EXTRACT UNEXPECTED ===`);
    }
  } catch (error) {
    logger.error('Error re-extracting content:', error);
    showExtractionError('Failed to communicate with the background script');
    logger.info(`=== RE-EXTRACT EXCEPTION ===`);
  }
}

// Load quick input buttons from config
async function loadQuickInputs() {
  try {
    const config = await getConfig();
    logger.info('Loaded config in loadQuickInputs:', config);
    
    if (config && config.quickInputs && config.quickInputs.length > 0) {
      quickInputsContainer.innerHTML = '';
      
      config.quickInputs.forEach((quickInput, index) => {
        const button = document.createElement('button');
        button.className = 'quick-input-btn';
        button.textContent = quickInput.displayText;
        button.dataset.index = index;
        button.dataset.sendText = quickInput.sendText;
        
        button.addEventListener('click', () => {
          // Directly send the quick button message
          sendQuickMessage(quickInput.displayText, quickInput.sendText);
        });
        
        quickInputsContainer.appendChild(button);
      });
    }
  } catch (error) {
    logger.error('Error loading quick inputs:', error);
  }
}

// New function to send quick button messages
async function sendQuickMessage(displayText, sendTextTemplate) {
  // Display the original displayText in the bubble
  const userMessage = displayText;
  
  // Clear the input box (if it has content)
  userInput.value = '';
  
  // Add user message to UI
  logger.info('Appending quick message to UI:', userMessage);
  appendMessageToUI('user', userMessage);
  
  // Show loading indicator in chat for assistant's response
  const assistantLoadingMessage = appendMessageToUI('assistant', '<div class="spinner"></div> Thinking...', null, true);
  
  // Add the original message to chat history
  chatHistory.push({ role: 'user', content: userMessage });
  
  try {
    // Get system prompt template and page content handling logic
    const config = await getConfig();
    let systemPromptTemplateForPayload = config.systemPrompt;
    let pageContentForPayload = null; // Initialize to null

    // Replace {CONTENT} placeholder in sendTextTemplate first
    // This ensures {CONTENT} in quick input's own template is handled correctly
    const processedSendTextTemplate = sendTextTemplate.replace('{CONTENT}', extractedContent || '');

    // Now, handle the "includePageContent" checkbox for the main system prompt
    if (includePageContentCheckbox.checked && extractedContent) {
      logger.info('[QuickMessage] Including page content in the system prompt. Extracted content will be part of system prompt.');
      // Append extracted content to the system prompt template
      systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nContent:\n' + extractedContent;
      pageContentForPayload = extractedContent; // also send it separately for good measure, though service worker might primarily use the one in systemPrompt
    } else {
      logger.info('[QuickMessage] Not including page content in the system prompt, or no extracted content available.');
      // If not checked, or no content, systemPromptTemplateForPayload remains as is (or from config)
      // pageContentForPayload remains null or what it was (if we decide to pass it even if not in prompt)
      // For clarity, explicitly set to null if checkbox is unchecked, matching sendUserMessage behavior
      if (!includePageContentCheckbox.checked) {
        pageContentForPayload = null;
      } else {
        pageContentForPayload = extractedContent; // if checkbox is checked but extractedContent was null/empty
      }
    }
    
    // The actual text to be sent as the user's last turn
    const actualSendText = processedSendTextTemplate;
    
    // Prepare messages to send to LLM
    // Note: We use the actual substituted text as the last message, but display the original text in the UI
    const messages = chatHistory.slice(0, -1).map(msg => ({ role: msg.role, content: msg.content }));
    messages.push({ role: 'user', content: actualSendText }); // Use processedSendTextTemplate here
    
    logger.info('[QuickMessage] Sending quick message to background script...');
    logger.debug('[QuickMessage] Payload:', {
        messages,
        systemPromptTemplate: systemPromptTemplateForPayload,
        extractedPageContent: pageContentForPayload, // Use the determined pageContentForPayload
        imageBase64,
        currentUrl,
        extractionMethod: currentExtractionMethod
    });

    // Send message to background script
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE',
      payload: {
        messages,
        systemPromptTemplate: systemPromptTemplateForPayload, // Use the new template
        extractedPageContent: pageContentForPayload, // Use the new page content payload
        imageBase64,
        currentUrl,
        extractionMethod: currentExtractionMethod
      }
    });
    logger.info('Quick message sent to background script');
  } catch (error) {
    logger.error('Error sending quick message:', error);
    // Pass the loading message element to handleLlmError so it can be updated if sending fails
    handleLlmError('Failed to send message to LLM', assistantLoadingMessage); 
  }
}

// Get config from background script
async function getConfig() {
  try {
    logger.info('Requesting config from service worker...', 'Sidebar getConfig');
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONFIG'
    });
    logger.info('Received response from service worker for GET_CONFIG:', 'Sidebar getConfig', response);
    
    if (response && response.type === 'CONFIG_LOADED' && response.config) {
      return response.config;
    } else {
      logger.error('Error loading config or config missing in response. Response:', 'Sidebar getConfig', response);
      return null;
    }
  } catch (error) {
    logger.error('Error requesting config via sendMessage:', 'Sidebar getConfig', error);
    return null;
  }
}

// Handle image paste into the input
function handleImagePaste(e) {
  const items = e.clipboardData.items;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      
      reader.onload = function(event) {
        imageBase64 = event.target.result;
        displayAttachedImage(imageBase64);
      };
      
      reader.readAsDataURL(blob);
      
      // Prevent default paste behavior for the image
      e.preventDefault();
      return;
    }
  }
}

// Display the attached image in the UI
function displayAttachedImage(dataUrl) {
  imagePreview.innerHTML = `<img src="${dataUrl}" alt="Attached image">`;
  imagePreviewContainer.classList.remove('hidden');
}

// Remove the attached image
function removeAttachedImage() {
  imagePreview.innerHTML = '';
  imagePreviewContainer.classList.add('hidden');
  imageBase64 = null;
}

// Export conversation as markdown
function exportConversation() {
  if (chatHistory.length === 0) {
    return;
  }
  
  let markdownContent = `# Read Bot Conversation\n\n`;
  markdownContent += `URL: ${currentUrl}\n\n`;
  markdownContent += `Extracted content summary:\n\`\`\`\n${extractedContent.substring(0, 300)}${extractedContent.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
  markdownContent += `## Conversation\n\n`;
  
  chatHistory.forEach(message => {
    markdownContent += `### \n\n`;
    markdownContent += `${message.content}\n\n`;
  });
  
  // Create a blob and download
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `readbot-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Show loading state
function showLoading(message = 'Extracting content...') {
  loadingIndicator.classList.remove('hidden');
  extractedContentElem.classList.add('hidden');
  extractionError.classList.add('hidden');
  
  // Update loading text
  const loadingText = loadingIndicator.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = message;
  }
  
  // Show buttons but in disabled state during extraction
  copyContentBtn.classList.add('visible');
  retryExtractBtn.classList.add('visible');
  copyContentBtn.classList.add('disabled');
  retryExtractBtn.classList.add('disabled');
  copyContentBtn.classList.remove('enabled');
  retryExtractBtn.classList.remove('enabled');
  copyContentBtn.disabled = true;
  retryExtractBtn.disabled = true;
  
  // Disable extraction method switching during extraction
  jinaExtractBtn.disabled = true;
  readabilityExtractBtn.disabled = true;
}

// Hide loading state
function hideLoading() {
  loadingIndicator.classList.add('hidden');
  extractedContentElem.classList.remove('hidden');
  
  // Re-enable extraction method switching after extraction completes
  jinaExtractBtn.disabled = false;
  readabilityExtractBtn.disabled = false;
}

// Show extraction error
function showExtractionError(error) {
  loadingIndicator.classList.add('hidden');
  extractedContentElem.classList.add('hidden');
  extractionError.classList.remove('hidden');
  
  // Show both buttons but only enable retry button
  copyContentBtn.classList.add('visible');
  retryExtractBtn.classList.add('visible');
  
  // Copy button disabled (gray)
  copyContentBtn.classList.add('disabled');
  copyContentBtn.classList.remove('enabled');
  copyContentBtn.disabled = true;
  
  // Retry button enabled (primary color)
  retryExtractBtn.classList.remove('disabled');
  retryExtractBtn.classList.add('enabled');
  retryExtractBtn.disabled = false;
  
  let errorMessage = 'Failed to extract content.'; // Default message
  if (error) {
    if (error === 'CONTENT_SCRIPT_NOT_CONNECTED') {
      errorMessage = 'Please reload page and retry.';
    } else if (error === 'page_loading') {
      errorMessage = 'Page content not ready, please wait for page to load fully and retry.';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        // If stringify fails, use the default message
      }
    }
  }
  extractionError.textContent = errorMessage;
  logger.info('Extraction Error:', errorMessage);
  updateExtractionButtonUI(); // Ensure buttons are updated based on state
}

// Show restricted page message
function showRestrictedPageMessage() {
  loadingIndicator.classList.add('hidden');
  extractedContentElem.classList.add('hidden');
  extractionError.classList.remove('hidden');
  // Show buttons but keep them disabled on restricted pages
  copyContentBtn.classList.add('visible');
  retryExtractBtn.classList.add('visible');
  copyContentBtn.classList.add('disabled');
  retryExtractBtn.classList.add('disabled');
  copyContentBtn.classList.remove('enabled');
  retryExtractBtn.classList.remove('enabled');
  copyContentBtn.disabled = true;
  retryExtractBtn.disabled = true;
  
  // Clear existing content
  extractionError.innerHTML = '';
  
  // Create restricted page message
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 20px; text-align: center; color: #666;';
  
  messageDiv.innerHTML = `
    <div style="font-size: 18px; margin-bottom: 10px;">🚫</div>
    <div style="font-weight: bold; margin-bottom: 10px;">Restricted Page</div>
    <div style="font-size: 14px; line-height: 1.4; margin-bottom: 15px;">
      Read Bot cannot work on Chrome internal pages (chrome://, chrome-extension://, etc.).
    </div>
    <div style="font-size: 14px; line-height: 1.4; color: #888;">
      Please navigate to a regular webpage to use the extension.
    </div>
  `;
  
  extractionError.appendChild(messageDiv);
  
  // Disable extraction buttons and input
  jinaExtractBtn.disabled = true;
  readabilityExtractBtn.disabled = true;
  userInput.disabled = true;
  sendBtn.disabled = true;
}

// Apply configured panel size - updated for side panel
async function applyPanelSize() {
  try {
    const config = await getConfig();
    const panelWidth = config.panelWidth || 400; // Default width if not configured
    
    // Side panels typically have width controlled by Chrome, but we can set min-width
    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`);
    
    // Height is typically controlled by the browser window
    document.documentElement.style.height = '100%';
  } catch (error) {
    logger.error('Error applying panel size:', error);
  }
}

// Note: Content display height is now managed by the resize functionality

// Clear conversation and context
async function clearConversationAndContext() {
  if (!currentUrl) {
    return;
  }
  
  try {
    // Clear UI
    chatContainer.innerHTML = '';
    chatHistory = [];
    
    // Send request to clear data for this URL
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_URL_DATA',
      url: currentUrl
    });
    
    if (response && response.success) {
      logger.info('Data cleared successfully for URL:', currentUrl);
    } else {
      logger.error('Error clearing data:', response.error);
    }
  } catch (error) {
    logger.error('Error in clear conversation and context:', error);
  }
}

// Copy extracted content to clipboard
function copyExtractedContent() {
  // Check if button is disabled
  if (copyContentBtn.disabled || copyContentBtn.classList.contains('disabled')) {
    return;
  }
  
  if (!extractedContent) {
    showCopyToast('No content to copy');
    return;
  }
  
  navigator.clipboard.writeText(extractedContent)
    .then(() => showCopyToast('Content copied to clipboard'))
    .catch(err => {
      logger.error('Failed to copy content:', err);
      showCopyToast('Failed to copy content');
    });
}

// Copy assistant message plain text
function copyMessageText(content) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.marked.parse(content);
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  navigator.clipboard.writeText(textContent)
    .then(() => showCopyToast('Text copied to clipboard'))
    .catch(err => logger.error('Failed to copy text:', err));
}

// Copy assistant message Markdown
function copyMessageMarkdown(content) {
  navigator.clipboard.writeText(content)
    .then(() => showCopyToast('Markdown copied to clipboard'))
    .catch(err => logger.error('Failed to copy Markdown:', err));
}

// Show copy success toast
function showCopyToast(message) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  
  // Add to document
  document.body.appendChild(toast);
  
  // Remove after 2 seconds
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

// Resize functionality for content section
function startResize(e) {
  isResizing = true;
  startY = e.clientY;
  startHeight = contentSection.offsetHeight;
  e.preventDefault();
  
  // Add visual feedback
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function doResize(e) {
  if (!isResizing) return;
  
  const deltaY = e.clientY - startY;
  const newHeight = startHeight + deltaY;
  
  // Set minimum and maximum heights
  const minHeight = 80;
  const maxHeight = window.innerHeight * 0.7; // Maximum 70% of window height
  
  if (newHeight >= minHeight && newHeight <= maxHeight) {
    contentSection.style.height = `${newHeight}px`;
    contentSection.style.maxHeight = `${newHeight}px`;
  }
}

function stopResize() {
  if (isResizing) {
    isResizing = false;
    
    // Remove visual feedback
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Save the new height to storage for persistence
    const currentHeight = contentSection.offsetHeight;
    saveContentSectionHeight(currentHeight);
  }
}

// Save content section height to local storage
async function saveContentSectionHeight(height) {
  try {
    await chrome.storage.local.set({ contentSectionHeight: height });
    logger.info(`Content section height saved: ${height}px`);
  } catch (error) {
    logger.error('Error saving content section height:', error);
  }
}

// Reset content section height to config default (called when panel opens)
async function resetContentSectionHeight() {
  try {
    const config = await getConfig();
    if (config && typeof config.contentDisplayHeight === 'number') {
      const height = Math.max(config.contentDisplayHeight, 80); // Ensure minimum height
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Reset content section height to config default: ${height}px`);
    } else {
      // Fallback to default
      const defaultHeight = 100;
      contentSection.style.height = `${defaultHeight}px`;
      contentSection.style.maxHeight = `${defaultHeight}px`;
      logger.info(`Reset content section height to default: ${defaultHeight}px`);
    }
  } catch (error) {
    logger.error('Error resetting content section height:', error);
    // Fallback to default
    const defaultHeight = 100;
    contentSection.style.height = `${defaultHeight}px`;
    contentSection.style.maxHeight = `${defaultHeight}px`;
  }
}

// Load and apply saved content section height
async function loadContentSectionHeight() {
  try {
    // First try to get saved height from local storage
    const result = await chrome.storage.local.get(['contentSectionHeight']);
    
    if (result.contentSectionHeight) {
      const height = result.contentSectionHeight;
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Applied saved content section height: ${height}px`);
      return;
    }
    
    // If no saved height, use config default
    const config = await getConfig();
    if (config && typeof config.contentDisplayHeight === 'number') {
      const height = Math.max(config.contentDisplayHeight, 80); // Ensure minimum height
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Applied config content section height: ${height}px`);
    } else {
      // Fallback to default
      const defaultHeight = 100;
      contentSection.style.height = `${defaultHeight}px`;
      contentSection.style.maxHeight = `${defaultHeight}px`;
      logger.info(`Applied default content section height: ${defaultHeight}px`);
    }
  } catch (error) {
    logger.error('Error loading content section height:', error);
    // Fallback to default
    const defaultHeight = 100;
    contentSection.style.height = `${defaultHeight}px`;
    contentSection.style.maxHeight = `${defaultHeight}px`;
  }
}

// Helper function to update the UI of extraction method buttons
function updateExtractionButtonUI() {
  if (jinaExtractBtn && readabilityExtractBtn) {
    jinaExtractBtn.classList.toggle('active', currentExtractionMethod === 'jina');
    readabilityExtractBtn.classList.toggle('active', currentExtractionMethod === 'readability');
    logger.info(`Extraction buttons UI updated. Jina active: ${currentExtractionMethod === 'jina'}, Readability active: ${currentExtractionMethod === 'readability'}`);
  } else {
    logger.warn('Extraction buttons not found, cannot update UI.');
  }
} 