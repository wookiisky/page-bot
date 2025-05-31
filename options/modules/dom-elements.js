// DOM Elements Manager
// Centralized management of all DOM element references

export const domElements = {
  // Form and main containers
  form: document.getElementById('settingsForm'),
  quickInputsContainer: document.getElementById('quickInputsContainer'),
  quickInputTemplate: document.getElementById('quickInputTemplate'),
  saveNotification: document.getElementById('saveNotification'),
  
  // Content extraction elements
  defaultExtractionMethod: document.getElementById('defaultExtractionMethod'),
  jinaApiKey: document.getElementById('jinaApiKey'),
  jinaResponseTemplate: document.getElementById('jinaResponseTemplate'),
  
  // LLM provider elements
  defaultLlmProvider: document.getElementById('defaultLlmProvider'),
  
  // OpenAI elements
  openaiApiKey: document.getElementById('openaiApiKey'),
  openaiBaseUrl: document.getElementById('openaiBaseUrl'),
  openaiModel: document.getElementById('openaiModel'),
  
  // Gemini elements
  geminiApiKey: document.getElementById('geminiApiKey'),
  geminiModel: document.getElementById('geminiModel'),
  
  // UI settings
  contentDisplayHeight: document.getElementById('contentDisplayHeight'),
  systemPrompt: document.getElementById('systemPrompt'),
  
  // Cache settings elements
  cachedPagesDisplay: document.getElementById('cachedPagesDisplay'),
  cachedChatsDisplay: document.getElementById('cachedChatsDisplay'),
  clearPagesCacheBtn: document.getElementById('clearPagesCacheBtn'),
  clearChatsCacheBtn: document.getElementById('clearChatsCacheBtn'),
  
  // Action buttons
  addQuickInputBtn: document.getElementById('addQuickInputBtn'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn')
};

// DOM element groups for easier management
export const domGroups = {
  jinaApiKeyGroup: document.getElementById('jinaApiKeyGroup'),
  jinaResponseTemplateGroup: document.getElementById('jinaResponseTemplateGroup'),
  openaiSettings: document.getElementById('openaiSettings'),
  geminiSettings: document.getElementById('geminiSettings')
}; 