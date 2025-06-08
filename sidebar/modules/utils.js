/**
 * utils.js - 通用工具函数
 */

// 创建日志记录器
const createLogger = (moduleName) => {
  return window.logger 
    ? window.logger.createModuleLogger(moduleName) 
    : console;
};

// 检查URL是否为受限页面
const isRestrictedPage = (url) => {
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
};

// HTML特殊字符转义
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// 显示复制成功toast提示
const showCopyToast = (message) => {
  // 创建toast元素
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  
  // 添加到文档
  document.body.appendChild(toast);
  
  // 2秒后移除
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
};

export {
  createLogger,
  isRestrictedPage,
  escapeHtml,
  showCopyToast
}; 