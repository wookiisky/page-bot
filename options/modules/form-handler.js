// Form Handler
// Handles form population and UI state management

export class FormHandler {
  
  // Populate form with configuration data
  static populateForm(config, domElements) {
    if (!config) return;
    
    // Content extraction settings
    domElements.defaultExtractionMethod.value = config.defaultExtractionMethod || 'readability';
    domElements.jinaApiKey.value = config.jinaApiKey || '';
    domElements.jinaResponseTemplate.value = config.jinaResponseTemplate || 
      '# {title}\n\n**URL:** {url}\n\n**Description:** {description}\n\n## Content\n\n{content}';
    
    // LLM settings
    domElements.defaultLlmProvider.value = config.llm?.defaultProvider || 'openai';
    
    // OpenAI settings
    if (config.llm?.providers?.openai) {
      domElements.openaiApiKey.value = config.llm.providers.openai.apiKey || '';
      domElements.openaiBaseUrl.value = config.llm.providers.openai.baseUrl || 'https://api.openai.com';
      domElements.openaiModel.value = config.llm.providers.openai.model || 'gpt-3.5-turbo';
    }
    
    // Gemini settings
    if (config.llm?.providers?.gemini) {
      domElements.geminiApiKey.value = config.llm.providers.gemini.apiKey || '';
      domElements.geminiModel.value = config.llm.providers.gemini.model || 'gemini-pro';
    }
    
    // UI settings
    domElements.contentDisplayHeight.value = config.contentDisplayHeight || 300;
    domElements.systemPrompt.value = config.systemPrompt || '';
  }
  
  // Toggle visibility of extraction method specific settings
  static toggleExtractionMethodSettings(domElements, domGroups) {
    const method = domElements.defaultExtractionMethod.value;
    
    // Jina API Key group
    domGroups.jinaApiKeyGroup.style.display = method === 'jina' ? 'block' : 'none';
    
    // Jina Response Template group
    domGroups.jinaResponseTemplateGroup.style.display = method === 'jina' ? 'block' : 'none';
  }
  
  // Toggle visibility of LLM provider specific settings
  static toggleLlmSettings(domElements, domGroups) {
    const provider = domElements.defaultLlmProvider.value;
    
    // OpenAI settings
    domGroups.openaiSettings.style.display = provider === 'openai' ? 'block' : 'none';
    
    // Gemini settings
    domGroups.geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
  }
  
  // Show save notification
  static showSaveNotification(domElements) {
    domElements.saveNotification.classList.add('show');
    
    setTimeout(() => {
      domElements.saveNotification.classList.remove('show');
    }, 3000);
  }
} 