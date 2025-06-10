/**
 * ui-manager.js - UI状态管理和DOM操作
 */

import { createLogger, escapeHtml } from './utils.js';

const logger = createLogger('UIManager');

// DOM元素缓存
let elements = {};

/**
 * 初始化DOM元素引用
 */
const initElements = () => {
  elements = {
    extractedContentElem: document.getElementById('extractedContent'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    extractionError: document.getElementById('extractionError'),
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),
    jinaExtractBtn: document.getElementById('jinaExtractBtn'),
    readabilityExtractBtn: document.getElementById('readabilityExtractBtn'),
    quickInputsContainer: document.getElementById('quickInputs'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    copyContentBtn: document.getElementById('copyContentBtn'),
    retryExtractBtn: document.getElementById('retryExtractBtn'),
    contentSection: document.getElementById('contentSection'),
    resizeHandle: document.getElementById('resizeHandle'),
    includePageContentBtn: document.getElementById('includePageContentBtn'),
    inputResizeHandle: document.getElementById('inputResizeHandle'),
    buttonGroup: document.getElementById('inputActions')
  };
  
  logger.info('UI elements initialized');
  return elements;
};

/**
 * 获取DOM元素
 * @param {string} elementId - 元素ID
 * @returns {HTMLElement} DOM元素
 */
const getElement = (elementId) => {
  return elements[elementId];
};

/**
 * 获取所有DOM元素
 * @returns {Object} 所有DOM元素
 */
const getAllElements = () => {
  return { ...elements };
};

/**
 * Clear all display states completely
 */
const clearAllStates = () => {
  // Hide all main display elements
  elements.loadingIndicator.classList.add('hidden');
  elements.extractedContentElem.classList.add('hidden');
  elements.extractionError.classList.add('hidden');
  
  // Clear any content/text
  elements.extractionError.textContent = '';
  elements.extractionError.innerHTML = '';
  
  // Clear loading text
  const loadingText = elements.loadingIndicator.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = '';
  }
  
  logger.info('All display states cleared');
};

/**
 * 显示加载状态
 * @param {string} message - 加载消息
 */
const showLoading = (message = 'Extracting content...') => {
  // First, completely clear all states to prevent overlapping
  clearAllStates();
  
  // Force a DOM reflow to ensure changes are applied immediately
  void elements.loadingIndicator.offsetHeight;
  
  // Now show loading state
  elements.loadingIndicator.classList.remove('hidden');
  elements.extractedContentElem.classList.add('hidden');
  elements.extractionError.classList.add('hidden');
  
  // 更新加载文本
  const loadingText = elements.loadingIndicator.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = message;
  }
  
  // 显示按钮但处于禁用状态
  elements.copyContentBtn.classList.add('visible');
  elements.retryExtractBtn.classList.add('visible');
  elements.copyContentBtn.classList.add('disabled');
  elements.retryExtractBtn.classList.add('disabled');
  elements.copyContentBtn.classList.remove('enabled');
  elements.retryExtractBtn.classList.remove('enabled');
  elements.copyContentBtn.disabled = true;
  elements.retryExtractBtn.disabled = true;
  
  // 在提取期间禁用提取方法切换
  elements.jinaExtractBtn.disabled = true;
  elements.readabilityExtractBtn.disabled = true;
  
  logger.info('Loading state shown:', message);
};

/**
 * 隐藏加载状态
 */
const hideLoading = () => {
  elements.loadingIndicator.classList.add('hidden');
  elements.extractedContentElem.classList.remove('hidden');
  
  // 提取完成后重新启用提取方法切换
  elements.jinaExtractBtn.disabled = false;
  elements.readabilityExtractBtn.disabled = false;
  
  logger.info('Loading state hidden');
};

/**
 * 显示提取错误
 * @param {string|Error} error - 错误信息
 */
const showExtractionError = (error) => {
  // First, completely clear all states to prevent overlapping
  clearAllStates();
  
  // Force a DOM reflow to ensure changes are applied immediately
  void elements.extractionError.offsetHeight;
  
  // Now show error state
  elements.loadingIndicator.classList.add('hidden');
  elements.extractedContentElem.classList.add('hidden');
  elements.extractionError.classList.remove('hidden');
  
  // 显示两个按钮，但只启用重试按钮
  elements.copyContentBtn.classList.add('visible');
  elements.retryExtractBtn.classList.add('visible');
  
  // 复制按钮禁用(灰色)
  elements.copyContentBtn.classList.add('disabled');
  elements.copyContentBtn.classList.remove('enabled');
  elements.copyContentBtn.disabled = true;
  
  // 重试按钮启用(主色)
  elements.retryExtractBtn.classList.remove('disabled');
  elements.retryExtractBtn.classList.add('enabled');
  elements.retryExtractBtn.disabled = false;
  
  // Re-enable extraction method buttons so users can try different methods after error
  if (elements.jinaExtractBtn && elements.readabilityExtractBtn) {
    elements.jinaExtractBtn.disabled = false;
    elements.readabilityExtractBtn.disabled = false;
  }
  
  let errorMessage = 'Failed to extract content.'; // 默认消息
  if (error) {
    if (error === 'CONTENT_SCRIPT_NOT_CONNECTED') {
      errorMessage = 'Content script not connected. Please reload the page and try again.';
    } else if (error === 'page_loading_or_script_issue') {
      errorMessage = 'Page content not ready or content script issue. Please wait for the page to load fully and try again.';
    } else if (error === 'page_loading') {
      errorMessage = 'Page content not ready, please wait for page to load fully and retry.';
    } else if (typeof error === 'string') {
      // Handle specific readability errors
      if (error.includes('Readability library not loaded')) {
        errorMessage = 'Readability library failed to load. Please try again or contact support.';
      } else if (error.includes('Failed to extract content with Readability')) {
        errorMessage = 'Readability extraction failed. The page content may not be suitable for extraction. Try refreshing the page.';
      } else if (error.includes('HTML content is required')) {
        errorMessage = 'Unable to get page content. Please reload the page and try again.';
      } else if (error.includes('Processing error')) {
        errorMessage = 'Content processing error. Please try again or reload the page.';
      } else if (error.includes('offscreen')) {
        errorMessage = 'Content processing service unavailable. Please try again.';
      } else {
        errorMessage = error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        // 如果stringify失败，使用默认消息
      }
    }
  }
  elements.extractionError.textContent = errorMessage;
  logger.info('Extraction Error shown:', errorMessage);
};

/**
 * 显示受限页面消息
 */
const showRestrictedPageMessage = () => {
  elements.loadingIndicator.classList.add('hidden');
  elements.extractedContentElem.classList.add('hidden');
  elements.extractionError.classList.remove('hidden');
  
  // 显示按钮但保持禁用状态
  elements.copyContentBtn.classList.add('visible');
  elements.retryExtractBtn.classList.add('visible');
  elements.copyContentBtn.classList.add('disabled');
  elements.retryExtractBtn.classList.add('disabled');
  elements.copyContentBtn.classList.remove('enabled');
  elements.retryExtractBtn.classList.remove('enabled');
  elements.copyContentBtn.disabled = true;
  elements.retryExtractBtn.disabled = true;
  
  // 清除现有内容
  elements.extractionError.innerHTML = '';
  
  // 创建受限页面消息
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 20px; text-align: center; color: #666;';
  
  messageDiv.innerHTML = `
    <div style="font-size: 18px; margin-bottom: 10px;">🚫</div>
    <div style="font-weight: bold; margin-bottom: 10px;">Restricted Page</div>
    <div style="font-size: 14px; line-height: 1.4; margin-bottom: 15px;">
      Page Bot cannot work on Chrome internal pages (chrome://, chrome-extension://, etc.).
    </div>
    <div style="font-size: 14px; line-height: 1.4; color: #888;">
      Please navigate to a regular webpage to use the extension.
    </div>
  `;
  
  elements.extractionError.appendChild(messageDiv);
  
  // 禁用提取按钮和输入
  elements.jinaExtractBtn.disabled = true;
  elements.readabilityExtractBtn.disabled = true;
  elements.userInput.disabled = true;
  elements.sendBtn.disabled = true;
  
  logger.info('Restricted page message shown');
};

/**
 * 显示提取的内容
 * @param {string} content - 提取的内容
 */
const displayExtractedContent = async (content) => {
  if (!content) {
    showExtractionError('No content extracted');
    return;
  }
  
  // First, completely clear all states to prevent overlapping
  clearAllStates();
  
  // Force a DOM reflow to ensure changes are applied immediately
  void elements.extractedContentElem.offsetHeight;
  
  // Now show content
  elements.loadingIndicator.classList.add('hidden');
  elements.extractionError.classList.add('hidden');
  elements.extractedContentElem.classList.remove('hidden');
  
  // 显示原始markdown内容而不是渲染它
  elements.extractedContentElem.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(content)}</pre>`;
  
  // 当内容可用时显示操作按钮并启用它们(橙色状态)
  elements.copyContentBtn.classList.add('visible');
  elements.retryExtractBtn.classList.add('visible');
  elements.copyContentBtn.classList.remove('disabled');
  elements.retryExtractBtn.classList.remove('disabled');
  elements.copyContentBtn.classList.add('enabled');
  elements.retryExtractBtn.classList.add('enabled');
  elements.copyContentBtn.disabled = false;
  elements.retryExtractBtn.disabled = false;
  
  logger.info('Content displayed, length:', content.length);
};

/**
 * 更新提取方法按钮UI
 * @param {string} currentMethod - 当前提取方法
 */
const updateExtractionButtonUI = (currentMethod) => {
  if (elements.jinaExtractBtn && elements.readabilityExtractBtn) {
    elements.jinaExtractBtn.classList.toggle('active', currentMethod === 'jina');
    elements.readabilityExtractBtn.classList.toggle('active', currentMethod === 'readability');
    logger.info(`Extraction buttons UI updated. Jina active: ${currentMethod === 'jina'}, Readability active: ${currentMethod === 'readability'}`);
  } else {
    logger.warn('Extraction buttons not found, cannot update UI.');
  }
};

/**
 * 更新包含页面内容按钮状态
 * @param {boolean} includePageContent - 是否包含页面内容
 */
const updateIncludePageContentUI = (includePageContent) => {
  elements.includePageContentBtn.setAttribute('data-enabled', includePageContent ? 'true' : 'false');
  logger.info(`Include page content button updated: ${includePageContent}`);
};

/**
 * 更新输入区域按钮布局
 * @param {number} height - 输入框高度
 */
const updateIconsLayout = (height) => {
  // 移除过渡效果以便立即更新布局
  elements.buttonGroup.style.transition = 'none';
  
  // 清除所有布局类
  elements.buttonGroup.classList.remove('layout-row', 'layout-grid', 'layout-column');
  
  // 根据高度阈值设置布局
  if (height <= 40) {
    // 默认布局: 单行
    elements.buttonGroup.classList.add('layout-row');
    logger.info('Setting row layout');
  } else if (height > 40 && height <= 80) {
    // 网格布局: 两行两列
    elements.buttonGroup.classList.add('layout-grid');
    logger.info('Setting grid layout');
  } else {
    // 列布局: 单列多行
    elements.buttonGroup.classList.add('layout-column');
    logger.info('Setting column layout');
  }
  
  // 确保发送按钮始终保持主要类
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    if (!sendBtn.classList.contains('primary')) {
      sendBtn.classList.add('primary');
    }
  }
  
  // 重置所有按钮样式
  Array.from(elements.buttonGroup.children).forEach(button => {
    // 清除任何内联样式
    button.removeAttribute('style');
  });
  
  // 使用setTimeout恢复过渡效果
  setTimeout(() => {
    elements.buttonGroup.style.transition = '';
  }, 50);
};

export {
  initElements,
  getElement,
  getAllElements,
  clearAllStates,
  showLoading,
  hideLoading,
  showExtractionError,
  showRestrictedPageMessage,
  displayExtractedContent,
  updateExtractionButtonUI,
  updateIncludePageContentUI,
  updateIconsLayout
}; 