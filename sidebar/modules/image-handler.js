/**
 * image-handler.js - 图片处理功能
 */

import { createLogger } from './utils.js';

const logger = createLogger('ImageHandler');

// 当前图片数据
let currentImageBase64 = null;

/**
 * 初始化图片处理器
 * @param {HTMLElement} userInput - 用户输入元素
 * @param {HTMLElement} imagePreviewContainer - 图片预览容器
 * @param {HTMLElement} imagePreview - 图片预览元素
 * @param {HTMLElement} removeImageBtn - 移除图片按钮
 */
const initImageHandler = (userInput, imagePreviewContainer, imagePreview, removeImageBtn) => {
  if (!userInput || !imagePreviewContainer || !imagePreview || !removeImageBtn) {
    logger.error('Missing required elements for image handler');
    return;
  }
  
  // 处理图片粘贴
  userInput.addEventListener('paste', (e) => {
    handleImagePaste(e, imagePreviewContainer, imagePreview);
  });
  
  // 移除图片
  removeImageBtn.addEventListener('click', () => {
    removeAttachedImage(imagePreviewContainer, imagePreview);
  });
  
  logger.info('Image handler initialized');
};

/**
 * 处理图片粘贴
 * @param {ClipboardEvent} e - 粘贴事件
 * @param {HTMLElement} imagePreviewContainer - 图片预览容器
 * @param {HTMLElement} imagePreview - 图片预览元素
 */
const handleImagePaste = (e, imagePreviewContainer, imagePreview) => {
  const items = e.clipboardData.items;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      
      reader.onload = function(event) {
        currentImageBase64 = event.target.result;
        displayAttachedImage(currentImageBase64, imagePreviewContainer, imagePreview);
        logger.info('Image pasted and displayed');
      };
      
      reader.readAsDataURL(blob);
      
      // 防止默认的粘贴行为
      e.preventDefault();
      return;
    }
  }
};

/**
 * 显示附加的图片
 * @param {string} dataUrl - 图片数据URL
 * @param {HTMLElement} imagePreviewContainer - 图片预览容器
 * @param {HTMLElement} imagePreview - 图片预览元素
 */
const displayAttachedImage = (dataUrl, imagePreviewContainer, imagePreview) => {
  imagePreview.innerHTML = `<img src="${dataUrl}" alt="Attached image">`;
  imagePreviewContainer.classList.remove('hidden');
  logger.info('Image displayed in preview');
};

/**
 * 移除附加的图片
 * @param {HTMLElement} imagePreviewContainer - 图片预览容器
 * @param {HTMLElement} imagePreview - 图片预览元素
 */
const removeAttachedImage = (imagePreviewContainer, imagePreview) => {
  imagePreview.innerHTML = '';
  imagePreviewContainer.classList.add('hidden');
  currentImageBase64 = null;
  logger.info('Attached image removed');
};

/**
 * 获取当前图片数据
 * @returns {string|null} 图片的Base64数据
 */
const getCurrentImage = () => {
  return currentImageBase64;
};

/**
 * 设置当前图片数据
 * @param {string|null} imageBase64 - 图片的Base64数据
 */
const setCurrentImage = (imageBase64) => {
  currentImageBase64 = imageBase64;
};

export {
  initImageHandler,
  handleImagePaste,
  displayAttachedImage,
  removeAttachedImage,
  getCurrentImage,
  setCurrentImage
}; 