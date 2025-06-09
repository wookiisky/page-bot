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

// 检测内容是否包含markdown元素
const hasMarkdownElements = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  // Check for common markdown patterns
  const markdownPatterns = [
    // Headers (# ## ###)
    /^#{1,6}\s+.*/m,
    // Bold (**text** or __text__)
    /(\*\*|__).+?\1/,
    // Italic (*text* or _text_)
    /(\*|_)[^*_\s].+?\1/,
    // Code blocks (```code```)
    /```[\s\S]*?```/,
    // Inline code (`code`)
    /`[^`]+`/,
    // Links ([text](url) or [text][ref])
    /\[.+?\]\(.+?\)|\[.+?\]\[.+?\]/,
    // Images (![alt](url))
    /!\[.*?\]\(.+?\)/,
    // Unordered lists (- item or * item or + item)
    /^[\s]*[-*+]\s+.*/m,
    // Ordered lists (1. item)
    /^[\s]*\d+\.\s+.*/m,
    // Blockquotes (> text)
    /^[\s]*>\s+.*/m,
    // Horizontal rules (--- or ***)
    /^[\s]*(-{3,}|\*{3,}|_{3,})[\s]*$/m,
    // Tables (| col | col |)
    /\|.+\|/,
    // Strikethrough (~~text~~)
    /~~.+?~~/
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
};

export {
  createLogger,
  isRestrictedPage,
  escapeHtml,
  showCopyToast,
  hasMarkdownElements
}; 