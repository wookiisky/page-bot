// background/handlers/sendLlmMessageHandler.js

async function handleSendLlmMessage(data, serviceLogger, configManager, storage, llmService, safeSendMessage) {
    const { messages, systemPromptTemplate, extractedPageContent, imageBase64, currentUrl /*, extractionMethod */ } = data.payload;
    // extractionMethod is in data.payload but not directly used by this handler, so commented out to avoid unused variable warnings.

    const config = await configManager.getConfig();
    const llmConfig = {
        provider: config.llm.defaultProvider,
        ...config.llm.providers[config.llm.defaultProvider]
    };

    const systemPrompt = systemPromptTemplate.replace('{CONTENT}', extractedPageContent || '');

    // let assistantResponse = ''; // Not needed here as response is handled via callbacks
    // let error = null; // Error is handled in errorCallback

    try {
        const streamCallback = (chunk) => {
            if (chunk !== undefined && chunk !== null) {
                safeSendMessage({ type: 'LLM_STREAM_CHUNK', chunk });
            }
        };

        const doneCallback = async (fullResponse) => {
            serviceLogger.info('LLM stream finished. Full response received in handler.');
            safeSendMessage({ type: 'LLM_STREAM_END', fullResponse });

            if (currentUrl && messages) {
                const updatedMessages = [
                    ...messages,
                    { role: 'assistant', content: fullResponse }
                ];
                await storage.saveChatHistory(currentUrl, updatedMessages);
                serviceLogger.info('Chat history updated and saved by handler for URL:', currentUrl);
            } else {
                serviceLogger.warn('Handler could not save chat history: missing currentUrl or messages in payload.');
            }
        };

        const errorCallback = (err) => {
            // error = err; // No need to assign to a local variable if only sending message
            safeSendMessage({ type: 'LLM_ERROR', error: err.message || 'Error calling LLM' });
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