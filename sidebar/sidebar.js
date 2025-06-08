/**
 * sidebar.js - Page Bot侧边栏主入口
 * 整合所有模块，管理应用逻辑流程
 */

// 导入所有模块
import { createLogger, isRestrictedPage, showCopyToast } from './modules/utils.js';
import * as StateManager from './modules/state-manager.js';
import * as UIManager from './modules/ui-manager.js';
import * as MessageHandler from './modules/message-handler.js';
import * as ContentExtractor from './modules/content-extractor.js';
import * as ChatManager from './modules/chat-manager.js';
import * as ResizeHandler from './modules/resize-handler.js';
import * as ImageHandler from './modules/image-handler.js';
import * as QuickInputs from './components/quick-inputs.js';
import * as ChatMessage from './components/chat-message.js';
import * as ChatHistory from './modules/chat-history.js';

// 创建logger
const logger = createLogger('Sidebar');

// 全局工具函数，供其他模块使用
window.showCopyToast = showCopyToast;
window.StateManager = StateManager;
window.MessageHandler = MessageHandler;

// DOM元素加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Side panel loaded');
  
  // 初始化UI元素引用
  const elements = UIManager.initElements();
  
  // 应用配置的面板尺寸
  const config = await StateManager.getConfig();
  ResizeHandler.applyPanelSize(config);
  
  // 重置内容区域高度为配置默认值
  await ResizeHandler.resetContentSectionHeight(elements.contentSection, config);
  
  // 加载当前页面数据
  await loadCurrentPageData();
  
  // 加载快速输入按钮
  loadQuickInputs();
  
  // 设置事件监听器
  setupEventListeners();
  
  // 设置消息按钮跟随滚动的效果
  setupMessageButtonsScroll();
  
  // 设置初始按钮状态
  elements.includePageContentBtn.setAttribute('data-enabled', StateManager.getStateItem('includePageContent') ? 'true' : 'false');
  
  // 初始化图标布局
  UIManager.updateIconsLayout(elements.userInput.offsetHeight);
  
  // 添加默认布局类
  elements.buttonGroup.classList.add('layout-row');
  
  logger.info('Sidebar initialization completed');
});

/**
 * 加载当前页面数据
 */
async function loadCurrentPageData() {
  // 获取当前标签页URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const url = tabs[0].url;
    StateManager.updateStateItem('currentUrl', url);
    logger.info('Current URL:', url);
    
    // 检查是否为受限页面
    if (isRestrictedPage(url)) {
      UIManager.hideLoading();
      UIManager.showRestrictedPageMessage();
      return;
    }
    
    // 显示加载状态
    UIManager.showLoading('Loading page data...');
    
    // 从后台脚本加载页面数据
    try {
      const response = await MessageHandler.getPageData(url);
      
      if (response.success) {
        // 数据加载成功
        await handlePageDataLoaded(response.data);
      } else {
        // 加载数据出错
        UIManager.showExtractionError(response.error);
      }
    } catch (error) {
      logger.error('Error requesting page data:', error);
      UIManager.showExtractionError('Failed to communicate with the background script. Details: ' + (error.message || 'Unknown error'));
    }
  } else {
    UIManager.showExtractionError('No active tab found');
  }
}

/**
 * 处理页面数据加载完成
 * @param {Object} data - 页面数据
 */
async function handlePageDataLoaded(data) {
  const elements = UIManager.getAllElements();
  UIManager.hideLoading();
  
  // 重新启用按钮，以防它们在受限页面上被禁用
  elements.jinaExtractBtn.disabled = false;
  elements.readabilityExtractBtn.disabled = false;
  elements.userInput.disabled = false;
  elements.sendBtn.disabled = false;
  
  // 更新提取的内容并显示
  if (data && data.content) {
    StateManager.updateStateItem('extractedContent', data.content);
    await UIManager.displayExtractedContent(data.content);
    elements.copyContentBtn.classList.add('visible');
    elements.copyContentBtn.disabled = false;
  } else {
    StateManager.updateStateItem('extractedContent', '');
    UIManager.showExtractionError('No content could be extracted.');
    elements.copyContentBtn.classList.remove('visible');
    elements.copyContentBtn.disabled = true;
  }
  
  // 根据实际使用的方法更新提取方法UI
  if (data && data.extractionMethod) {
    StateManager.updateStateItem('currentExtractionMethod', data.extractionMethod);
    UIManager.updateExtractionButtonUI(data.extractionMethod);
    logger.info(`Content displayed using method: ${data.extractionMethod}`);
  }

  // 使用服务工作进程提供的聊天历史
  if (data && data.chatHistory) {
    logger.info(`Received chat history with ${data.chatHistory.length} messages from service worker`);
    ChatManager.displayChatHistory(elements.chatContainer, data.chatHistory);
  } else {
    logger.info('No chat history received from service worker');
    elements.chatContainer.innerHTML = '';
  }
  
  // 根据成功与否启用或禁用重试按钮
  elements.retryExtractBtn.disabled = !data.content;
  if (data.content) {
    elements.retryExtractBtn.classList.remove('disabled');
    elements.retryExtractBtn.classList.add('visible');
  } else {
    elements.retryExtractBtn.classList.add('disabled');
    // 保持可见以允许重试
  }
}

/**
 * 设置所有事件监听器
 */
function setupEventListeners() {
  const elements = UIManager.getAllElements();
  
  // 发送消息按钮
  elements.sendBtn.addEventListener('click', sendUserMessage);
  
  // 输入框中的Enter键发送消息
  elements.userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });
  
  // 导出对话
  elements.exportBtn.addEventListener('click', exportConversation);
  
  // 清除对话和上下文
  elements.clearBtn.addEventListener('click', clearConversationAndContext);
  
  // 提取方法按钮
  elements.jinaExtractBtn.addEventListener('click', () => switchExtractionMethod('jina'));
  elements.readabilityExtractBtn.addEventListener('click', () => switchExtractionMethod('readability'));
  
  // 包含页面内容按钮
  elements.includePageContentBtn.addEventListener('click', toggleIncludePageContent);
  
  // 初始化图片处理
  ImageHandler.initImageHandler(
    elements.userInput,
    elements.imagePreviewContainer,
    elements.imagePreview,
    elements.removeImageBtn
  );
  
  // 复制提取的内容
  elements.copyContentBtn.addEventListener('click', copyExtractedContent);
  
  // 重试提取
  elements.retryExtractBtn.addEventListener('click', () => {
    // 检查按钮是否禁用
    if (elements.retryExtractBtn.disabled || elements.retryExtractBtn.classList.contains('disabled')) {
      return;
    }
    logger.info(`Retry button clicked, current extraction method: ${StateManager.getStateItem('currentExtractionMethod')}`);
    reExtractContent(StateManager.getStateItem('currentExtractionMethod'));
  });
  
  // 初始化大小调整处理
  ResizeHandler.initContentResize(
    elements.contentSection,
    elements.resizeHandle,
    (height) => ResizeHandler.saveContentSectionHeight(height)
  );
  
  // 输入框大小调整处理
  ResizeHandler.initInputResize(
    elements.userInput,
    elements.inputResizeHandle,
    (height) => UIManager.updateIconsLayout(height)
  );
  
  // 设置消息监听器
  setupMessageListeners();
}

/**
 * 设置消息监听器
 */
function setupMessageListeners() {
  MessageHandler.setupMessageListeners({
    onStreamChunk: (chunk) => {
      logger.debug('Received LLM_STREAM_CHUNK:', chunk);
      ChatManager.handleStreamChunk(UIManager.getElement('chatContainer'), chunk);
    },
    
    onStreamEnd: (fullResponse) => {
      logger.debug('Received LLM_STREAM_END');
      ChatManager.handleStreamEnd(
        UIManager.getElement('chatContainer'),
        fullResponse,
        (response) => {
          // 从DOM获取更新后的对话历史
          const chatHistory = ChatHistory.getChatHistoryFromDOM(UIManager.getElement('chatContainer'));
          
          // 保存更新后的聊天历史
          chrome.runtime.sendMessage({
            type: 'SAVE_CHAT_HISTORY',
            url: StateManager.getStateItem('currentUrl'),
            chatHistory: chatHistory
          }).then(() => {
            logger.info('Chat history saved after adding assistant response');
          }).catch(error => {
            logger.error('Failed to save chat history after adding assistant response:', error);
          });
          
          // 重新启用发送按钮
          UIManager.getElement('sendBtn').disabled = false;
        }
      );
    },
    
    onLlmError: (error) => {
      ChatManager.handleLlmError(
        UIManager.getElement('chatContainer'),
        error,
        null,
        () => {
          // 重新启用发送按钮
          UIManager.getElement('sendBtn').disabled = false;
        }
      );
    },
    
    onTabChanged: (url) => {
      // 标签页切换，如果URL不同则重新加载数据
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Tab changed. New URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        loadCurrentPageData();
      }
    },
    
    onAutoLoadContent: (url, data) => {
      // 自动加载新URL的缓存内容
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Auto-loading cached content for URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        handlePageDataLoaded(data);
      }
    },
    
    onAutoExtractContent: (url, extractionMethod) => {
      // 自动提取新URL的内容
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Auto-extracting content for URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
        
        // 检查是否为受限页面
        if (isRestrictedPage(url)) {
          UIManager.hideLoading();
          UIManager.showRestrictedPageMessage();
    return;
  }
  
        // 显示加载并提取内容
        UIManager.showLoading('Extracting content...');
        loadCurrentPageData();
      }
    },
    
    onTabUpdated: (url) => {
      // 标签页更新的旧式回退
      if (url !== StateManager.getStateItem('currentUrl')) {
        logger.info(`Tab updated. New URL: ${url}`);
        StateManager.updateStateItem('currentUrl', url);
        loadCurrentPageData();
      }
    }
  });
}

/**
 * 发送用户消息
 */
async function sendUserMessage() {
  const elements = UIManager.getAllElements();
  const userText = elements.userInput.value.trim();
  const imageBase64 = ImageHandler.getCurrentImage();
  
  if (!userText && !imageBase64) {
    logger.warn('Attempted to send an empty message');
    return;
  }

  // 清除输入并禁用发送按钮
  elements.userInput.value = '';
  elements.sendBtn.disabled = true;
  
  // 创建消息时间戳，用于DOM和消息对象
  const messageTimestamp = Date.now();
  
  // 乐观地将用户消息添加到UI，使用相同的时间戳
  ChatManager.appendMessageToUI(elements.chatContainer, 'user', userText, imageBase64, false, messageTimestamp);
  
  // 从DOM获取对话历史
  const chatHistory = ChatHistory.getChatHistoryFromDOM(elements.chatContainer);
  
  // 将当前对话历史立即保存到存储
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    });
    logger.info('Chat history saved after adding user message');
  } catch (error) {
    logger.error('Failed to save chat history after adding user message:', error);
  }
  
  // 为服务工作进程准备有效载荷
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = StateManager.getStateItem('extractedContent'); // 始终传递extractedContent
  const config = await StateManager.getConfig();

  // 来自配置的默认系统提示(通常包含{CONTENT})
  systemPromptTemplateForPayload = config.systemPrompt;

  if (StateManager.getStateItem('includePageContent')) {
    logger.info('Including page content in the message. Extracted content will be sent.');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nPage Content:\n' + pageContentForPayload; 
  } else {
    logger.info('Not including page content in the message. Only using for {CONTENT} replacement.');
  }
  
  // 在聊天中显示加载指示器
  // 确保在发送消息之前调用此方法，以确保UI及时更新
  const loadingMsgId = ChatManager.appendMessageToUI(elements.chatContainer, 'assistant', '<div class="spinner"></div>', null, true);
  
  // 如果附加了图片，发送后移除
  if (imageBase64) {
    ImageHandler.removeAttachedImage(elements.imagePreviewContainer, elements.imagePreview);
  }

  try {
    // 向后台脚本发送消息以进行LLM处理
    await MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      imageBase64: imageBase64,
      currentUrl: StateManager.getStateItem('currentUrl'),
      extractionMethod: StateManager.getStateItem('currentExtractionMethod')
    });
  } catch (error) {
    logger.error('Error sending message to LLM via service worker:', error);
    ChatManager.handleLlmError(
      elements.chatContainer,
      'Failed to send message to the AI. Check service worker logs.',
      loadingMsgId,
      () => {
        // 如果发生错误，重新启用发送按钮
        elements.sendBtn.disabled = false;
      }
    );
  }
}

/**
 * 处理快速输入点击
 * @param {string} displayText - 显示文本
 * @param {string} sendTextTemplate - 发送文本模板
 */
async function handleQuickInputClick(displayText, sendTextTemplate) {
  const elements = UIManager.getAllElements();
  
  // 显示加载状态
  elements.sendBtn.disabled = true;
  
  // 创建消息时间戳，用于DOM和消息对象
  const messageTimestamp = Date.now();
  
  // 添加用户消息到UI，使用相同的时间戳
  ChatManager.appendMessageToUI(elements.chatContainer, 'user', displayText, null, false, messageTimestamp);
  
  // 显示助手响应的加载指示器
  const assistantLoadingMessage = ChatManager.appendMessageToUI(
    elements.chatContainer,
    'assistant',
    '<div class="spinner"></div>',
    null,
    true
  );
  
  // 从DOM获取对话历史
  const chatHistory = ChatHistory.getChatHistoryFromDOM(elements.chatContainer);
  
  // 将当前对话历史立即保存到存储
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CHAT_HISTORY',
      url: StateManager.getStateItem('currentUrl'),
      chatHistory: chatHistory
    });
    logger.info('Chat history saved after adding quick input message');
  } catch (error) {
    logger.error('Failed to save chat history after adding quick input message:', error);
  }
  
  // 准备数据
  const state = StateManager.getState();
  let systemPromptTemplateForPayload = '';
  let pageContentForPayload = state.extractedContent;
  const config = await StateManager.getConfig();

  // 获取系统提示
  systemPromptTemplateForPayload = config.systemPrompt;

  if (state.includePageContent) {
    logger.info('Including page content in quick input message');
    systemPromptTemplateForPayload = systemPromptTemplateForPayload + '\n\nPage Content:\n' + pageContentForPayload;
  } else {
    logger.info('Not including page content in quick input message');
  }

  try {
    // 向后台脚本发送消息以进行LLM处理
    await MessageHandler.sendLlmMessage({
      messages: chatHistory,
      systemPromptTemplate: systemPromptTemplateForPayload,
      extractedPageContent: pageContentForPayload,
      currentUrl: state.currentUrl,
      extractionMethod: state.currentExtractionMethod
    });
  } catch (error) {
    logger.error('Error sending quick message:', error);
    // 将加载消息元素传递给handleLlmError，以便在发送失败时可以更新它
    ChatManager.handleLlmError(
      elements.chatContainer,
      'Failed to send message to LLM',
      assistantLoadingMessage,
      () => {
        elements.sendBtn.disabled = false;
      }
    ); 
  }
}

/**
 * 加载快速输入按钮
 */
async function loadQuickInputs() {
  try {
    const config = await StateManager.getConfig();
    logger.info('Loaded config in loadQuickInputs:', config);
    
    if (config && config.quickInputs && config.quickInputs.length > 0) {
      QuickInputs.initQuickInputs(
        UIManager.getElement('quickInputsContainer'),
        config.quickInputs,
        (displayText, sendText) => handleQuickInputClick(displayText, sendText)
      );
    }
  } catch (error) {
    logger.error('Error loading quick inputs:', error);
  }
}

/**
 * 切换提取方法
 * @param {string} method - 提取方法
 */
function switchExtractionMethod(method) {
  const elements = UIManager.getAllElements();
  const state = StateManager.getState();
  
  // 检查是否为受限页面
  if (isRestrictedPage(state.currentUrl)) {
    logger.info('Cannot switch extraction method on restricted page');
    return;
  }
  
  // 更新活动按钮样式
  elements.jinaExtractBtn.classList.toggle('active', method === 'jina');
  elements.readabilityExtractBtn.classList.toggle('active', method === 'readability');
  
  // 显示加载状态
  UIManager.showLoading(`Switching to ${method === 'jina' ? 'Jina AI' : 'Readability'} extraction...`);
  
  // 调用内容提取器切换方法
  ContentExtractor.switchMethod(
    state.currentUrl,
    method,
    state.currentExtractionMethod,
    // 成功回调
    (content, extractionMethod) => {
      StateManager.updateStateItem('extractedContent', content);
      StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
      UIManager.displayExtractedContent(content);
      UIManager.hideLoading();
    },
    // 错误回调
    (error) => {
      UIManager.showExtractionError(error);
    }
  );
}

/**
 * 重新提取内容
 * @param {string} method - 提取方法
 */
function reExtractContent(method) {
  const state = StateManager.getState();
  
  // 检查是否为受限页面
  if (isRestrictedPage(state.currentUrl)) {
    logger.info('Cannot re-extract content on restricted page');
    return;
  }
  
  // 显示加载状态
  UIManager.showLoading(`Re-extracting with ${method === 'jina' ? 'Jina AI' : 'Readability'}...`);
  
  // 调用内容提取器重新提取方法
  ContentExtractor.reExtract(
    state.currentUrl,
    method,
    // 成功回调
    (content, extractionMethod) => {
      StateManager.updateStateItem('extractedContent', content);
      StateManager.updateStateItem('currentExtractionMethod', extractionMethod);
      UIManager.displayExtractedContent(content);
      UIManager.hideLoading();
    },
    // 错误回调
    (error) => {
      UIManager.showExtractionError(error);
    }
  );
}

/**
 * 复制提取的内容
 */
async function copyExtractedContent() {
  const elements = UIManager.getAllElements();
  
  // 检查按钮是否禁用
  if (elements.copyContentBtn.disabled || elements.copyContentBtn.classList.contains('disabled')) {
    return;
  }
  
  const content = StateManager.getStateItem('extractedContent');
  const success = await ContentExtractor.copyExtractedContent(content);
  
  if (success) {
    showCopyToast('Content copied to clipboard');
  } else {
    showCopyToast('Failed to copy content');
  }
}

/**
 * 切换是否包含页面内容
 */
function toggleIncludePageContent() {
  const includePageContent = StateManager.toggleIncludePageContent();
  UIManager.updateIncludePageContentUI(includePageContent);
}

/**
 * 导出对话
 */
function exportConversation() {
  const state = StateManager.getState();
  ChatManager.exportConversation(
    state.currentUrl,
    state.extractedContent,
    state.chatHistory
  );
}

/**
 * 清除对话和上下文
 */
async function clearConversationAndContext() {
  const elements = UIManager.getAllElements();
  
  // 清除UI
  ChatHistory.clearChatHistory(elements.chatContainer);
  
  // 从存储中清除(如果我们有URL)
  await StateManager.clearUrlData(false, true);
  
  logger.info('Conversation cleared');
}

/**
 * 设置消息按钮跟随滚动的效果 - 完全重写
 */
function setupMessageButtonsScroll() {
  const chatContainer = document.getElementById('chatContainer');
  if (!chatContainer) return;

  // 跟踪当前悬停的消息和其按钮
  let currentHoveredMessage = null;
  let currentFloatingButtons = null;
  
  /**
   * 清理浮动按钮状态
   */
  function clearFloatingButtons() {
    if (currentFloatingButtons) {
      currentFloatingButtons.classList.remove('floating');
      currentFloatingButtons.style.position = '';
      currentFloatingButtons.style.top = '';
      currentFloatingButtons.style.right = '';
      currentFloatingButtons.style.transform = '';
      currentFloatingButtons = null;
    }
    currentHoveredMessage = null;
  }
  
  /**
   * 更新按钮位置
   */
  function updateButtonPosition(message, buttons) {
    const messageRect = message.getBoundingClientRect();
    const containerRect = chatContainer.getBoundingClientRect();
    
    // 检查消息是否完全在可视区域内
    const isFullyVisible = messageRect.top >= containerRect.top && 
                           messageRect.bottom <= containerRect.bottom;
    
    if (isFullyVisible) {
      // 消息完全可见，使用常规定位
      buttons.classList.remove('floating');
      buttons.style.position = '';
      buttons.style.top = '';
      buttons.style.right = '';
      buttons.style.transform = '';
    } else {
      // 消息被部分裁剪，使用浮动定位
      buttons.classList.add('floating');
      
      // 计算按钮在可视区域内的最佳位置
      const visibleTop = Math.max(messageRect.top, containerRect.top);
      const visibleBottom = Math.min(messageRect.bottom, containerRect.bottom);
      const visibleCenter = (visibleTop + visibleBottom) / 2;
      
      // 设置浮动位置
      buttons.style.position = 'fixed';
      buttons.style.top = `${visibleCenter}px`;
      buttons.style.right = `${window.innerWidth - containerRect.right + 12}px`;
      buttons.style.transform = 'translateY(-50%)';
    }
  }
  
  // 使用事件委托处理鼠标进入消息
  chatContainer.addEventListener('mouseover', function(event) {
    const message = event.target.closest('.chat-message');
    if (!message || message === currentHoveredMessage) return;
    
    // 清理之前的状态
    clearFloatingButtons();
    
    const buttons = message.querySelector('.message-buttons');
    if (!buttons) return;
    
    currentHoveredMessage = message;
    currentFloatingButtons = buttons;
    
    // 立即更新按钮位置
    updateButtonPosition(message, buttons);
  });
  
  // 使用事件委托处理鼠标离开消息
  chatContainer.addEventListener('mouseout', function(event) {
    const message = event.target.closest('.chat-message');
    if (!message || message !== currentHoveredMessage) return;
    
    // 检查鼠标是否真的离开了消息区域（而不是移动到子元素）
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && message.contains(relatedTarget)) return;
    
    clearFloatingButtons();
  });
  
  // 滚动时更新按钮位置
  chatContainer.addEventListener('scroll', function() {
    if (currentHoveredMessage && currentFloatingButtons) {
      updateButtonPosition(currentHoveredMessage, currentFloatingButtons);
    }
  });
  
  // 窗口大小变化时更新位置
  window.addEventListener('resize', function() {
    if (currentHoveredMessage && currentFloatingButtons) {
      updateButtonPosition(currentHoveredMessage, currentFloatingButtons);
    }
  });
} 