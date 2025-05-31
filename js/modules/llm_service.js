// Page Bot LLM Service Module
// Handles calling different LLM APIs

// Create a global llmService object
var llmService = {};

// Create module logger
const llmLogger = logger.createModuleLogger('LLMService');

// Call LLM API with provided messages and config
llmService.callLLM = async function(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  // Log the call (without sensitive data)
  llmLogger.info(`Calling LLM API`, { 
    provider: llmConfig.provider, 
    model: llmConfig.model, 
    messageCount: messages?.length,
    hasSystemPrompt: !!systemPrompt,
    hasImage: !!imageBase64,
    isStreaming: !!(streamCallback && doneCallback)
  });
  
  try {
    switch (llmConfig.provider) {
      case 'gemini':
        // Ensure geminiProvider is loaded
        if (typeof geminiProvider === 'undefined' || typeof geminiProvider.execute !== 'function') {
            llmLogger.error('Gemini provider not loaded correctly.');
            throw new Error('Gemini provider not loaded. Ensure js/modules/llm_provider/gemini_provider.js is included.');
        }
        return await geminiProvider.execute(
          messages, 
          llmConfig, 
          systemPrompt, 
          imageBase64, 
          streamCallback, 
          doneCallback, 
          errorCallback
        );
      case 'openai':
        // Ensure openaiProvider is loaded
        if (typeof openaiProvider === 'undefined' || typeof openaiProvider.execute !== 'function') {
            llmLogger.error('OpenAI provider not loaded correctly.');
            throw new Error('OpenAI provider not loaded. Ensure js/modules/llm_provider/openai_provider.js is included.');
        }
        return await openaiProvider.execute(
          messages, 
          llmConfig, 
          systemPrompt, 
          imageBase64, 
          streamCallback, 
          doneCallback, 
          errorCallback
        );
      default:
        throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
    }
  } catch (error) {
    llmLogger.error(`LLM API call failed`, { provider: llmConfig.provider, error: error.message });
    // Ensure errorCallback is a function before calling it
    if (typeof errorCallback === 'function') {
        errorCallback(error);
    } else {
        llmLogger.error('errorCallback is not a function. Original error:', error.message);
    }
  }
} 