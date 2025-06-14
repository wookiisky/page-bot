// background/handlers/sendLlmMessageHandler.js

// Utility function to truncate message content showing first and last 50 characters
function truncateContent(content, maxChars = 50) {
    if (!content || typeof content !== 'string') {
        return content;
    }
    
    if (content.length <= maxChars * 2) {
        return content;
    }
    
    const start = content.substring(0, maxChars);
    const end = content.substring(content.length - maxChars);
    return `${start}...${end}`;
}

// Utility function to create truncated messages JSON for logging
function createTruncatedMessagesForLog(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }
    
    return messages.map(msg => ({
        role: msg.role,
        content: truncateContent(msg.content)
    }));
}

async function handleSendLlmMessage(data, serviceLogger, configManager, storage, llmService, loadingStateCache, safeSendMessage) {
    const { messages, systemPromptTemplate, extractedPageContent, imageBase64, currentUrl, selectedModel, tabId /*, extractionMethod */ } = data.payload;
    // extractionMethod is in data.payload but not directly used by this handler, so commented out to avoid unused variable warnings.

    const config = await configManager.getConfig();
    
    // Use selected model or fall back to default
    let llmConfig;
    if (selectedModel && selectedModel.id) {
        // Use the selected model configuration
        llmConfig = {
            provider: selectedModel.provider,
            apiKey: selectedModel.apiKey,
            model: selectedModel.model
        };
        
        // Add provider-specific fields
        if (selectedModel.provider === 'openai' && selectedModel.baseUrl) {
            llmConfig.baseUrl = selectedModel.baseUrl;
        }
        
        serviceLogger.info(`Using selected model: ${selectedModel.name} (${selectedModel.provider})`);
    } else {
        // Fall back to default model from config
        const defaultModelId = config.llm?.defaultModelId;
        const defaultModel = config.llm?.models?.find(model => model.id === defaultModelId);
        
        if (defaultModel) {
            llmConfig = {
                provider: defaultModel.provider,
                apiKey: defaultModel.apiKey,
                model: defaultModel.model
            };
            
            if (defaultModel.provider === 'openai' && defaultModel.baseUrl) {
                llmConfig.baseUrl = defaultModel.baseUrl;
            }
            
            serviceLogger.info(`Using default model: ${defaultModel.name} (${defaultModel.provider})`);
        } else {
            // Legacy fallback for old configuration format
            llmConfig = {
                provider: config.llm?.defaultProvider || 'openai',
                ...config.llm?.providers?.[config.llm?.defaultProvider || 'openai']
            };
            serviceLogger.warn('Using legacy configuration format');
        }
    }

    const systemPrompt = systemPromptTemplate.replace('{CONTENT}', extractedPageContent || '');

    // let assistantResponse = ''; // Not needed here as response is handled via callbacks
    // let error = null; // Error is handled in errorCallback

    try {
        // Save loading state to cache if tabId is provided
        if (currentUrl && tabId) {
            const loadingInfo = {
                messageCount: messages ? messages.length : 0,
                hasImage: !!imageBase64,
                selectedModel: selectedModel?.name || 'default',
                provider: llmConfig.provider
            };
            
            await loadingStateCache.saveLoadingState(currentUrl, tabId, loadingInfo);
            serviceLogger.info('Loading state saved to cache', { currentUrl, tabId });
        }
        
        // Log the messages being sent to LLM in JSON format with truncated content
        const truncatedMessages = createTruncatedMessagesForLog(messages);
        serviceLogger.info('Calling LLM with messages JSON:', truncatedMessages);
        serviceLogger.info('System prompt:', truncateContent(systemPrompt));
        
        const streamCallback = (chunk) => {
            if (chunk !== undefined && chunk !== null) {
                safeSendMessage({ type: 'LLM_STREAM_CHUNK', chunk });
            }
        };

        const doneCallback = async (fullResponse) => {
            serviceLogger.info('LLM stream finished. Full response received in handler.');
            safeSendMessage({ type: 'LLM_STREAM_END', fullResponse });

            // Update loading state to completed
            if (currentUrl && tabId) {
                await loadingStateCache.completeLoadingState(currentUrl, tabId, fullResponse);
                serviceLogger.info('Loading state updated to completed', { currentUrl, tabId });
            }

            if (currentUrl && messages) {
                // Use tab-specific URL for saving chat history
                const tabSpecificUrl = tabId ? `${currentUrl}#${tabId}` : currentUrl;
                const updatedMessages = [
                    ...messages,
                    { role: 'assistant', content: fullResponse }
                ];
                await storage.saveChatHistory(tabSpecificUrl, updatedMessages);
                serviceLogger.info('Chat history updated and saved by handler for tab-specific URL:', tabSpecificUrl);
            } else {
                serviceLogger.warn('Handler could not save chat history: missing currentUrl or messages in payload.');
            }
        };

        const errorCallback = async (err) => {
            const errorMessage = err.message || 'Error calling LLM';
            safeSendMessage({ type: 'LLM_ERROR', error: errorMessage });
            
            // Update loading state to error
            if (currentUrl && tabId) {
                await loadingStateCache.errorLoadingState(currentUrl, tabId, errorMessage);
                serviceLogger.info('Loading state updated to error', { currentUrl, tabId, error: errorMessage });
            }
        };

        // Call the LLM service - this is an async operation but we don't await it here
        // because the actual response is handled by callbacks.
        llmService.callLLM(
            messages,
            llmConfig,
            systemPrompt,
            imageBase64,
            streamCallback,
            doneCallback,
            errorCallback
        );

        // Indicate that the request has been received and processing has started.
        // The actual result will be sent via stream/done/error callbacks.
        return { type: 'LLM_REQUEST_INITIATED' }; // Changed from LLM_REQUEST_RECEIVED for clarity

    } catch (err) {
        serviceLogger.error('Critical error initiating LLM call in handler:', err);
        // This catch block handles errors in the setup of the callLLM, not from the LLM call itself (handled by errorCallback)
        return { type: 'LLM_SETUP_ERROR', error: err.message || 'Error setting up LLM call' };
    }
} 