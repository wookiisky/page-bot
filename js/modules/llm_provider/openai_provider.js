// OpenAI Provider Module for LLM Service

// Ensure 'logger' object is available globally or imported if using modules
const openaiLogger = logger.createModuleLogger('OpenAIProvider');

var openaiProvider = (function() {
    // Constants
    const DEFAULT_MODEL = 'gpt-3.5-turbo';
    const DEFAULT_BASE_URL = 'https://api.openai.com';
    const DEFAULT_CONFIG = {
        temperature: 0.7,
        max_tokens: 4000
    };
    const VISION_MODELS = ['gpt-4-vision-preview', 'gpt-4o', 'gpt-4o-mini'];

    // Helper function to build API URL
    function buildApiUrl(baseUrl) {
        return `${baseUrl}/v1/chat/completions`;
    }

    // Helper function to build messages array
    function buildMessages(messages, systemPrompt, imageBase64, model) {
        const openaiMessages = [];

        if (systemPrompt) {
            openaiMessages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        for (const message of messages) {
            if (
                message.role === 'user' &&
                imageBase64 &&
                message === messages[messages.length - 1] &&
                VISION_MODELS.includes(model)
            ) {
                openaiMessages.push({
                    role: 'user',
                    content: [
                        { type: 'text', text: message.content },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageBase64,
                                detail: 'auto'
                            }
                        }
                    ]
                });
            } else {
                openaiMessages.push({
                    role: message.role,
                    content: message.content
                });
            }
        }

        return openaiMessages;
    }

    // Handle OpenAI streaming response
    async function handleOpenAIStream(response, streamCallback, doneCallback, errorCallback) {
        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            doneCallback(fullResponse);
                            return;
                        }

                        try {
                            const parsedData = JSON.parse(data);
                            if (parsedData.choices?.[0]?.delta?.content) {
                                const textChunk = parsedData.choices[0].delta.content;
                                fullResponse += textChunk;
                                streamCallback(textChunk);
                            }
                        } catch (e) {
                            openaiLogger.error('Error parsing OpenAI stream data:', { error: e.message, data });
                        }
                    }
                }
            }
            doneCallback(fullResponse);
        } catch (error) {
            openaiLogger.error('Error handling OpenAI stream:', error.message);
            errorCallback(error);
        }
    }

    // Main execution function
    async function execute(
        messages,
        llmConfig,
        systemPrompt,
        imageBase64,
        streamCallback,
        doneCallback,
        errorCallback
    ) {
        const apiKey = llmConfig.apiKey;
        const baseUrl = llmConfig.baseUrl || DEFAULT_BASE_URL;
        const model = llmConfig.model || DEFAULT_MODEL;

        if (!apiKey) {
            const error = new Error('OpenAI API key is required');
            openaiLogger.error(error.message);
            errorCallback(error);
            return;
        }

        try {
            const apiUrl = buildApiUrl(baseUrl);
            const openaiMessages = buildMessages(messages, systemPrompt, imageBase64, model);

            const requestBody = {
                model,
                messages: openaiMessages,
                ...DEFAULT_CONFIG,
                stream: !!streamCallback
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            if (streamCallback) {
                await handleOpenAIStream(response, streamCallback, doneCallback, errorCallback);
            } else {
                const data = await response.json();
                const responseText = data.choices[0].message.content;
                doneCallback(responseText);
            }
        } catch (error) {
            openaiLogger.error('OpenAI API call failed:', error.message);
            errorCallback(error);
        }
    }

    return { execute };
})(); 