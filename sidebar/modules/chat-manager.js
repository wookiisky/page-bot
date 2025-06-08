/**
 * chat-manager.js - 聊天功能管理
 */

import { createLogger } from './utils.js';
import { editMessage, retryMessage } from '../components/chat-message.js';
import { displayChatHistory as displayChatHistoryFromModule } from './chat-history.js';

const logger = createLogger('ChatManager');

/**
 * 将消息追加到聊天UI
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {string} role - 消息角色('user'或'assistant')
 * @param {string} content - 消息内容
 * @param {string|null} imageBase64 - 可选的图片数据
 * @param {boolean} isStreaming - 是否为流式传输消息
 * @param {number|null} customTimestamp - 可选的自定义时间戳
 * @returns {HTMLElement} 创建的消息元素
 */
const appendMessageToUI = (chatContainer, role, content, imageBase64 = null, isStreaming = false, messageTimestamp = Date.now()) => {
  logger.info(`[appendMessageToUI] Appending ${role} message, isStreaming=${isStreaming}, timestamp=${messageTimestamp}`);
  
  // 创建消息元素
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message`;
  messageDiv.id = `message-${messageTimestamp}`;
  
  // 如果有图片，保存到元素属性
  if (imageBase64) {
    messageDiv.setAttribute('data-image', imageBase64);
  }
  
  // 创建角色元素 - 移除角色文本显示
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  // 不再显示角色标识
  // roleDiv.textContent = role === 'user' ? 'You' : 'AI';
  
  // 创建内容元素
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // 保存原始内容以便编辑和导出
  contentDiv.setAttribute('data-raw-content', content);
  
  if (role === 'assistant' && isStreaming) {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Condition for streaming assistant placeholder met.`);
    try {
      // 流式传输占位符的内容已经是带有spinner的HTML
      contentDiv.innerHTML = content; 
      logger.info(`[appendMessageToUI ${messageTimestamp}] Applied raw HTML content for streaming placeholder.`);
    } catch (error) {
      logger.error(`[appendMessageToUI ${messageTimestamp}] Error setting innerHTML for streaming placeholder:`, error);
      contentDiv.textContent = content; // 回退处理
    }
    messageDiv.dataset.streaming = 'true';
    logger.info(`[appendMessageToUI ${messageTimestamp}] Set data-streaming=true on messageDiv (ID: ${messageDiv.id}). Element:`, messageDiv);
  } else {
    logger.info(`[appendMessageToUI ${messageTimestamp}] Not a streaming assistant placeholder. Role: ${role}, Streaming: ${isStreaming}`);
    
    // For user messages, preserve line breaks by using textContent instead of markdown parsing
    if (role === 'user') {
      contentDiv.textContent = content;
      logger.info(`[appendMessageToUI ${messageTimestamp}] Used textContent for user message to preserve line breaks.`);
    } else {
      // For assistant messages, use markdown parsing
      try {
        contentDiv.innerHTML = window.marked.parse(content);
        logger.info(`[appendMessageToUI ${messageTimestamp}] Parsed Markdown for assistant message.`);
      } catch (error) {
        logger.error(`[appendMessageToUI ${messageTimestamp}] Error parsing markdown for assistant message:`, error);
        contentDiv.textContent = content; // 回退到纯文本
      }
    }
  }
  
  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  
  // 用户消息的操作按钮
  if (role === 'user' && !isStreaming) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // 编辑按钮
    const editButton = document.createElement('button');
    editButton.className = 'btn-base message-action-btn';
    editButton.innerHTML = '<i class="material-icons">edit</i>';
    editButton.title = 'Edit Message';
    editButton.onclick = () => editMessage(messageDiv, (messageId, newContent) => {
      // 修改DOM
      const contentDiv = messageDiv.querySelector('.message-content');
      contentDiv.setAttribute('data-raw-content', newContent);
      // For user messages, preserve line breaks by using textContent
      if (role === 'user') {
        contentDiv.textContent = newContent;
      } else {
        try {
          contentDiv.innerHTML = window.marked.parse(newContent);
        } catch (error) {
          contentDiv.textContent = newContent;
        }
      }
    });
    
    // 复制文本按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'btn-base message-action-btn';
    copyButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyButton.title = 'Copy Text';
    copyButton.onclick = () => copyMessageText(content);
    
    // 复制markdown按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content);
    
    // 重试按钮
    const retryButton = document.createElement('button');
    retryButton.className = 'btn-base message-action-btn';
    retryButton.innerHTML = '<i class="material-icons">refresh</i>';
    retryButton.title = 'Retry';
    retryButton.onclick = () => retryMessage(messageDiv, (messageId, messageContent) => {
      // 简单地移除所有后续消息
      const allMessages = Array.from(chatContainer.querySelectorAll('.chat-message'));
      const messageElementIndex = allMessages.findIndex(el => el.id === messageDiv.id);
      
      if (messageElementIndex !== -1) {
        // 移除后续消息
        for (let i = allMessages.length - 1; i > messageElementIndex; i--) {
          allMessages[i].remove();
        }
      }
      
      // 添加新的助手占位符消息
      appendMessageToUI(
        chatContainer,
        'assistant',
        '<div class="spinner"></div>',
        null,
        true
      );
      
      // 滚动到底部
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    
    const buttons = [editButton, copyButton, copyMarkdownButton, retryButton];
    
    // 动态布局按钮
    layoutMessageButtons(buttonContainer, buttons, messageDiv);
    messageDiv.appendChild(buttonContainer);
  }
  // 助手消息的操作按钮（非流式传输）
  else if (role === 'assistant' && !isStreaming) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // 复制文本按钮
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'btn-base message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.onclick = () => copyMessageText(content);
    
    // 复制markdown按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content);
    
    const buttons = [copyTextButton, copyMarkdownButton];
    
    // 动态布局按钮
    layoutMessageButtons(buttonContainer, buttons, messageDiv);
    messageDiv.appendChild(buttonContainer);
  }
  
  // 添加到聊天容器
  chatContainer.appendChild(messageDiv);
  
  // 滚动到底部
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // 显示图片(如果有)
  if (imageBase64 && !isStreaming) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'message-image-container';
    const image = document.createElement('img');
    image.src = imageBase64;
    image.className = 'message-image';
    image.alt = 'Attached image';
    imageContainer.appendChild(image);
    
    // 在内容后面添加图片
    contentDiv.appendChild(imageContainer);
  }
  
  return messageDiv;
};

/**
 * 处理流式块响应
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {string} chunk - 接收到的文本块
 */
const handleStreamChunk = (chatContainer, chunk) => {
  // 查找当前正在流式传输的消息
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    const streamingMessageContentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!streamingMessageContentDiv) return;

    // 移除spinner(如果存在，应该只在第一个块上)
    const spinner = streamingMessageContentDiv.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }
    
    // 将新块附加到缓冲区并重新渲染markdown
    let currentBuffer = streamingMessageContainer.dataset.markdownBuffer || '';
    currentBuffer += chunk;
    streamingMessageContainer.dataset.markdownBuffer = currentBuffer;
    
    // 保存原始内容
    streamingMessageContentDiv.setAttribute('data-raw-content', currentBuffer);
    
    try {
      streamingMessageContentDiv.innerHTML = window.marked.parse(currentBuffer);
    } catch (error) {
      logger.error('Error parsing markdown during stream:', error);
      // 回退：以文本形式附加，但这可能与之前的HTML混合
      const textNode = document.createTextNode(chunk);
      streamingMessageContentDiv.appendChild(textNode);
    }
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

/**
 * 处理流式传输结束
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {string} fullResponse - 完整响应文本
 * @param {Function} onComplete - 完成后的回调函数
 */
const handleStreamEnd = (chatContainer, fullResponse, onComplete) => {
  logger.info('[handleStreamEnd] Received fullResponse:', fullResponse ? fullResponse.substring(0, 100) + '...' : 'empty_or_null');
  // 查找正在流式传输的消息
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    logger.info('[handleStreamEnd] Found streamingMessageContainer:', streamingMessageContainer);
    // 用完整响应更新内容
    const contentDiv = streamingMessageContainer.querySelector('.message-content');
    if (!contentDiv) {
      logger.error('[handleStreamEnd] streamingMessageContainer found, but .message-content child is missing!');
      // 尝试清除streaming属性以防止多个卡住的加载器
      streamingMessageContainer.removeAttribute('data-streaming');
      return;
    }
    logger.info('[handleStreamEnd] Found contentDiv:', contentDiv);
    
    try {
      logger.info('[handleStreamEnd] Attempting to parse Markdown...');
      // 保存原始内容
      contentDiv.setAttribute('data-raw-content', fullResponse);
      contentDiv.innerHTML = window.marked.parse(fullResponse);
      logger.info('[handleStreamEnd] Markdown parsed and applied to contentDiv.');
    } catch (markdownError) {
      logger.error('[handleStreamEnd] Error parsing Markdown:', markdownError);
      contentDiv.textContent = fullResponse; // 回退到纯文本
      contentDiv.setAttribute('data-raw-content', fullResponse);
      logger.info('[handleStreamEnd] Applied fullResponse as plain text due to Markdown error.');
    }
        
    // 移除streaming标志
    streamingMessageContainer.removeAttribute('data-streaming');
    logger.info('[handleStreamEnd] Removed data-streaming attribute.');
    
    // 为助手消息添加操作按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // 复制文本按钮
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'btn-base message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = 'Copy Text';
    copyTextButton.onclick = () => copyMessageText(fullResponse);
    
    // 复制markdown按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'btn-base message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = 'Copy Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(fullResponse);
    
    const buttons = [copyTextButton, copyMarkdownButton];
    
    // 动态布局按钮
    layoutMessageButtons(buttonContainer, buttons, streamingMessageContainer);
    
    // 确保按钮添加到正确位置
    streamingMessageContainer.appendChild(buttonContainer);
    logger.info('[handleStreamEnd] Action buttons added.');
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
    logger.info('[handleStreamEnd] Scrolled to bottom.');
    
    // 调用完成回调
    if (typeof onComplete === 'function') {
      onComplete(fullResponse);
    }
  } else {
    logger.warn('[handleStreamEnd] streamingMessageContainer not found! UI might be stuck or already updated.');
    // 即使没有找到streaming消息容器也调用完成回调
    if (typeof onComplete === 'function') {
      onComplete(fullResponse);
    }
  }
};

/**
 * 处理LLM错误
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {string|Error} error - 错误信息
 * @param {HTMLElement} streamingMessageElement - 可选的streaming消息元素
 * @param {Function} onComplete - 完成后的回调函数
 */
const handleLlmError = (chatContainer, error, streamingMessageElement = null, onComplete = null) => {
  logger.error('LLM Error:', error);
  
  // 尝试查找streaming消息(如果没有传递)
  const messageElement = streamingMessageElement || chatContainer.querySelector('[data-streaming="true"]');
  
  if (messageElement) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.innerHTML = `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`;
    }
    messageElement.removeAttribute('data-streaming'); // 确保移除streaming标志
  } else {
    // 如果没有streaming消息(例如，错误发生在创建之前或已处理)，
    // 添加一个新的错误消息。
    appendMessageToUI(
      chatContainer,
      'assistant', 
      `<span style="color: var(--error-color);">${typeof error === 'string' ? error : 'An unexpected error occurred with the AI.'}</span>`
    );
  }
  
  // 调用完成回调
  if (typeof onComplete === 'function') {
    onComplete(error);
  }
};

/**
 * 复制消息文本
 * @param {string} content - 消息内容
 */
const copyMessageText = (content) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.marked.parse(content);
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  navigator.clipboard.writeText(textContent)
    .then(() => window.showCopyToast('Text copied to clipboard'))
    .catch(err => logger.error('Failed to copy text:', err));
};

/**
 * 复制消息Markdown
 * @param {string} content - 消息内容
 */
const copyMessageMarkdown = (content) => {
  navigator.clipboard.writeText(content)
    .then(() => window.showCopyToast('Markdown copied to clipboard'))
    .catch(err => {
      logger.error('Error copying markdown to clipboard:', err);
      window.showCopyToast('Error copying markdown');
    });
};

/**
 * 在聊天界面中显示聊天历史
 * @param {HTMLElement} chatContainer - 聊天容器元素
 * @param {Array} history - 聊天历史数组
 */
const displayChatHistory = (chatContainer, history) => {
  displayChatHistoryFromModule(chatContainer, history, appendMessageToUI);
};

/**
 * 导出会话为Markdown
 * @param {string} currentUrl - 当前页面URL
 * @param {string} extractedContent - 提取的内容
 * @param {Array} chatHistory - 聊天历史
 */
const exportConversation = (currentUrl, extractedContent, chatHistory) => {
  if (chatHistory.length === 0) {
    return;
  }
  
  let markdownContent = `# Page Bot Conversation\n\n`;
  markdownContent += `URL: ${currentUrl}\n\n`;
  markdownContent += `Extracted content summary:\n\`\`\`\n${extractedContent.substring(0, 300)}${extractedContent.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
  markdownContent += `## Conversation\n\n`;
  
  chatHistory.forEach(message => {
    markdownContent += `### ${message.role}\n\n`;
    markdownContent += `${message.content}\n\n`;
  });
  
  // 创建blob并下载
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `page-bot-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  
  URL.revokeObjectURL(url);
};

/**
 * 动态布局消息按钮，根据消息高度和按钮数量选择最佳布局
 * @param {HTMLElement} container - 按钮容器
 * @param {HTMLElement[]} buttons - 按钮数组
 * @param {HTMLElement} messageElement - 消息元素，用于获取高度
 */
const layoutMessageButtons = (container, buttons, messageElement = null) => {
  const buttonCount = buttons.length;
  
  function applyLayout() {
    // 清空容器
    container.innerHTML = '';
    
    let messageHeight = 0;
    let layoutType = '';
    
    if (messageElement) {
      messageHeight = messageElement.offsetHeight;
    }
    
    // 根据消息高度和按钮数量决定布局
    if (messageElement && messageHeight > 80) {
      // 消息高度足够时，优先使用单列布局
      container.className = 'message-buttons layout-column';
      layoutType = 'column';
      buttons.forEach(button => container.appendChild(button));
    } else if (buttonCount <= 2) {
      // 1-2个按钮：单行布局
      container.className = 'message-buttons layout-row';
      layoutType = 'row';
      buttons.forEach(button => container.appendChild(button));
    } else if (buttonCount <= 4) {
      // 3-4个按钮：两行布局
      container.className = 'message-buttons layout-2rows';
      layoutType = '2rows';
      
      const buttonsPerRow = Math.ceil(buttonCount / 2);
      for (let i = 0; i < buttonCount; i += buttonsPerRow) {
        const row = document.createElement('div');
        row.className = 'button-row';
        
        for (let j = i; j < Math.min(i + buttonsPerRow, buttonCount); j++) {
          row.appendChild(buttons[j]);
        }
        
        container.appendChild(row);
      }
    } else {
      // 5个及以上按钮：单列布局
      container.className = 'message-buttons layout-column';
      layoutType = 'column';
      buttons.forEach(button => container.appendChild(button));
    }
    
    // 为消息容器添加对应的布局类名，以便CSS调整消息内容宽度
    if (messageElement && layoutType) {
      // 移除之前的布局类名
      messageElement.classList.remove('buttons-layout-row', 'buttons-layout-2rows', 'buttons-layout-column');
      // 添加新的布局类名
      messageElement.classList.add(`buttons-layout-${layoutType}`);
      logger.debug(`Applied layout class: buttons-layout-${layoutType} to message ${messageElement.id}`);
    }
  }
  
  // 先应用基于按钮数量的默认布局
  applyLayout();
  
  // 如果传入了消息元素，在DOM渲染完成后重新检查高度并调整布局
  if (messageElement) {
    // 使用 requestAnimationFrame 确保DOM已经渲染完成
    requestAnimationFrame(() => {
      applyLayout();
    });
  }
};

/**
 * 检查并修复现有消息的布局类名
 * @param {HTMLElement} chatContainer - 聊天容器
 */
const fixExistingMessageLayouts = (chatContainer) => {
  if (!chatContainer) return;
  
  const messages = chatContainer.querySelectorAll('.chat-message');
  messages.forEach(messageElement => {
    const buttonContainer = messageElement.querySelector('.message-buttons');
    if (buttonContainer) {
      const buttons = Array.from(buttonContainer.querySelectorAll('.message-action-btn'));
      if (buttons.length > 0) {
        // 重新应用布局
        layoutMessageButtons(buttonContainer, buttons, messageElement);
        logger.debug(`Fixed layout for message ${messageElement.id}`);
      }
    }
  });
};

export {
  appendMessageToUI,
  handleStreamChunk,
  handleStreamEnd,
  handleLlmError,
  copyMessageText,
  copyMessageMarkdown,
  displayChatHistory,
  exportConversation,
  layoutMessageButtons,
  fixExistingMessageLayouts
}; 