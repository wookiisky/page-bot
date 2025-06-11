// DOM Elements Manager
// Centralized management of all DOM element references

export const domElements = {
  // Form and main containers
  form: document.getElementById('settingsForm'),
  quickInputsContainer: document.getElementById('quickInputsContainer'),
  quickInputTemplate: document.getElementById('quickInputTemplate'),
  
  // Content extraction elements
  defaultExtractionMethod: document.getElementById('defaultExtractionMethod'),
  jinaApiKey: document.getElementById('jinaApiKey'),
  jinaResponseTemplate: document.getElementById('jinaResponseTemplate'),
  
  // LLM model elements
  defaultModelSelect: document.getElementById('defaultModelSelect'),
  modelsContainer: document.getElementById('modelsContainer'),
  
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
  exportConfigBtn: document.getElementById('exportConfigBtn'),
  importConfigBtn: document.getElementById('importConfigBtn'),
  importConfigFile: document.getElementById('importConfigFile'),
  resetBtn: document.getElementById('resetBtn')
};

// DOM element groups for easier management
export const domGroups = {
  jinaApiKeyGroup: document.getElementById('jinaApiKeyGroup'),
  jinaResponseTemplateGroup: document.getElementById('jinaResponseTemplateGroup')
}; 