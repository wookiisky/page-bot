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
    
    // LLM settings - handled by ModelManager
    if (config.llm?.defaultModelId && domElements.defaultModelSelect) {
      domElements.defaultModelSelect.value = config.llm.defaultModelId;
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
  
  // Toggle visibility of LLM provider specific settings (deprecated - kept for compatibility)
  static toggleLlmSettings(domElements, domGroups) {
    // This method is no longer needed with the new model management system
    // Kept for backward compatibility
  }
} 