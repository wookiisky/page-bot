/**
 * resize-handler.js - 处理UI尺寸调整
 */

import { createLogger } from './utils.js';

const logger = createLogger('ResizeHandler');

// 尺寸调整状态变量
let isResizing = false;
let startY = 0;
let startHeight = 0;
let isInputResizing = false;
let inputStartY = 0;
let inputStartHeight = 0;

/**
 * 初始化内容区域大小调整处理
 * @param {HTMLElement} contentSection - 内容区域元素
 * @param {HTMLElement} resizeHandle - 尺寸调整句柄元素
 * @param {Function} saveCallback - 保存尺寸的回调函数
 */
const initContentResize = (contentSection, resizeHandle, saveCallback) => {
  if (!contentSection || !resizeHandle) {
    logger.error('Missing required elements for content resize');
    return;
  }
  
  // 开始调整大小
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = contentSection.offsetHeight;
    e.preventDefault();
    
    // 添加视觉反馈
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    logger.info('Content resize started, initial height:', startHeight);
  });
  
  // 监听全局鼠标移动和释放事件
  document.addEventListener('mousemove', (e) => {
    if (isResizing) {
      doResize(e, contentSection, null, saveCallback);
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (isResizing) {
      stopResize(e, contentSection, null, saveCallback);
    }
  });
  
  logger.info('Content resize handlers initialized');
};

/**
 * 初始化输入框大小调整处理
 * @param {HTMLElement} userInput - 输入框元素
 * @param {HTMLElement} inputResizeHandle - 输入框尺寸调整句柄元素
 * @param {Function} layoutCallback - 更新布局的回调函数
 */
const initInputResize = (userInput, inputResizeHandle, layoutCallback) => {
  if (!userInput || !inputResizeHandle) {
    logger.error('Missing required elements for input resize');
    return;
  }
  
  // 开始调整输入框大小
  inputResizeHandle.addEventListener('mousedown', (e) => {
    isInputResizing = true;
    inputStartY = e.clientY;
    inputStartHeight = userInput.offsetHeight;
    e.preventDefault();
    
    // 添加视觉反馈
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    logger.info('Input resize started, initial height:', inputStartHeight);
  });
  
  // 添加专用于输入框调整的事件监听器
  document.addEventListener('mousemove', (e) => {
    if (isInputResizing) {
      doResize(e, null, userInput, layoutCallback);
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (isInputResizing) {
      stopResize(e, null, userInput, null);
    }
  });
  
  logger.info('Input resize handlers initialized');
};

/**
 * 执行尺寸调整
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLElement} contentSection - 内容区域元素
 * @param {HTMLElement} userInput - 输入框元素
 * @param {Function} layoutCallback - 更新布局的回调函数
 */
const doResize = (e, contentSection, userInput, layoutCallback) => {
  // 内容区域尺寸调整逻辑
  if (isResizing && contentSection) {
    const deltaY = e.clientY - startY;
    const newHeight = startHeight + deltaY;
    
    // 设置最小和最大高度
    const minHeight = 80;
    const maxHeight = window.innerHeight * 0.7; // 最大为窗口高度的70%
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      contentSection.style.height = `${newHeight}px`;
      contentSection.style.maxHeight = `${newHeight}px`;
      logger.debug('Content section resized to height:', newHeight);
    }
  }
  
  // 输入框尺寸调整逻辑
  if (isInputResizing && userInput && typeof layoutCallback === 'function') {
    const deltaY = e.clientY - inputStartY;
    // 调整增长因子使拖动感觉更自然
    const newHeight = Math.round(inputStartHeight - (deltaY * 1.2));
    
    // 设置最小和最大高度
    const minHeight = 30;
    const maxHeight = 200;
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      // 使用整数值避免布局问题
      const roundedHeight = Math.floor(newHeight);
      userInput.style.height = `${roundedHeight}px`;
      // 实时输入高度更新
      userInput.style.transition = 'none';
      
      // 添加防抖以避免频繁布局更新
      if (!window.layoutUpdateTimer) {
        // 基于输入高度更新图标布局
        layoutCallback(roundedHeight);
        
        // 防抖：50ms内不更新
        window.layoutUpdateTimer = setTimeout(() => {
          window.layoutUpdateTimer = null;
        }, 50);
      }
    }
  }
};

/**
 * 停止尺寸调整
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLElement} contentSection - 内容区域元素
 * @param {HTMLElement} userInput - 输入框元素
 * @param {Function} saveCallback - 保存尺寸的回调函数
 */
const stopResize = (e, contentSection, userInput, saveCallback) => {
  if (isResizing && contentSection && typeof saveCallback === 'function') {
    isResizing = false;
    
    // 移除视觉反馈
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // 保存新高度
    const currentHeight = contentSection.offsetHeight;
    saveCallback(currentHeight);
    
    logger.info('Content resize stopped, final height:', currentHeight);
  }
  
  if (isInputResizing && userInput) {
    isInputResizing = false;
    
    // 移除视觉反馈
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // 恢复输入过渡效果
    userInput.style.transition = '';
    
    // 清除布局更新定时器
    if (window.layoutUpdateTimer) {
      clearTimeout(window.layoutUpdateTimer);
      window.layoutUpdateTimer = null;
    }
    
    logger.info('Input resize stopped');
  }
};

/**
 * 重置内容区域高度为配置默认值
 * @param {HTMLElement} contentSection - 内容区域元素
 * @param {Object} config - 配置对象
 */
const resetContentSectionHeight = (contentSection, config) => {
  if (!contentSection) {
    logger.error('Content section element not found');
    return;
  }
  
  try {
    if (config && typeof config.contentDisplayHeight === 'number') {
      const height = Math.max(config.contentDisplayHeight, 80); // 确保最小高度
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Reset content section height to config default: ${height}px`);
    } else {
      // 回退到默认值
      const defaultHeight = 100;
      contentSection.style.height = `${defaultHeight}px`;
      contentSection.style.maxHeight = `${defaultHeight}px`;
      logger.info(`Reset content section height to default: ${defaultHeight}px`);
    }
  } catch (error) {
    logger.error('Error resetting content section height:', error);
    // 回退到默认值
    const defaultHeight = 100;
    contentSection.style.height = `${defaultHeight}px`;
    contentSection.style.maxHeight = `${defaultHeight}px`;
  }
};

/**
 * 应用面板尺寸
 * @param {Object} config - 配置对象
 */
const applyPanelSize = (config) => {
  try {
    const panelWidth = config.panelWidth || 400; // 如果未配置则使用默认宽度
    
    // 侧面板通常由Chrome控制宽度，但我们可以设置最小宽度
    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`);
    
    // 高度通常由浏览器窗口控制
    document.documentElement.style.height = '100%';
    
    logger.info('Panel size applied, width:', panelWidth);
  } catch (error) {
    logger.error('Error applying panel size:', error);
  }
};

/**
 * 保存内容区域高度到本地存储
 * @param {number} height - 要保存的高度
 * @returns {Promise<boolean>} 是否成功保存
 */
const saveContentSectionHeight = async (height) => {
  try {
    await chrome.storage.local.set({ contentSectionHeight: height });
    logger.info(`Content section height saved: ${height}px`);
    return true;
  } catch (error) {
    logger.error('Error saving content section height:', error);
    return false;
  }
};

/**
 * 加载保存的内容区域高度
 * @param {HTMLElement} contentSection - 内容区域元素
 * @param {Object} config - 配置对象
 * @returns {Promise<number>} 加载的高度值
 */
const loadContentSectionHeight = async (contentSection, config) => {
  try {
    // 首先尝试从本地存储获取保存的高度
    const result = await chrome.storage.local.get(['contentSectionHeight']);
    
    if (result.contentSectionHeight) {
      const height = result.contentSectionHeight;
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Applied saved content section height: ${height}px`);
      return height;
    }
    
    // 如果没有保存的高度，使用配置默认值
    if (config && typeof config.contentDisplayHeight === 'number') {
      const height = Math.max(config.contentDisplayHeight, 80); // 确保最小高度
      contentSection.style.height = `${height}px`;
      contentSection.style.maxHeight = `${height}px`;
      logger.info(`Applied config content section height: ${height}px`);
      return height;
    } else {
      // 回退到默认值
      const defaultHeight = 100;
      contentSection.style.height = `${defaultHeight}px`;
      contentSection.style.maxHeight = `${defaultHeight}px`;
      logger.info(`Applied default content section height: ${defaultHeight}px`);
      return defaultHeight;
    }
  } catch (error) {
    logger.error('Error loading content section height:', error);
    // 回退到默认值
    const defaultHeight = 100;
    contentSection.style.height = `${defaultHeight}px`;
    contentSection.style.maxHeight = `${defaultHeight}px`;
    return defaultHeight;
  }
};

export {
  initContentResize,
  initInputResize,
  resetContentSectionHeight,
  applyPanelSize,
  saveContentSectionHeight,
  loadContentSectionHeight
}; 