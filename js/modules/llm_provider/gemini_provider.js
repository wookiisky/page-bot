// Gemini Provider Module for LLM Service

// Ensure 'logger' object is available globally or imported if using modules
const geminiLogger = logger.createModuleLogger('GeminiProvider');

var geminiProvider = (function() {
    // Constants
    const DEFAULT_MODEL = 'gemini-pro';
    const DEFAULT_CONFIG = {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
    };

    // Helper function to build API URL
    function buildApiUrl(model, apiKey, isStreaming) {
        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        const endpoint = isStreaming ? 'streamGenerateContent' : 'generateContent';
        const streamParam = isStreaming ? '&alt=sse' : '';
        return `${baseUrl}/${model}:${endpoint}?key=${apiKey}${streamParam}`;
    }

    // Helper function to build request contents
    function buildContents(messages, systemPrompt, imageBase64, model) {
        const contents = [];
        
        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'I understand. I will analyze the provided content.' }]
            });
        }

        for (const message of messages) {
            const role = message.role === 'assistant' ? 'model' : 'user';
            
            if (role === 'user' && imageBase64 && message === messages[messages.length - 1] && model.includes('vision')) {
                const parts = [];
                if (message.content) {
                    parts.push({ text: message.content });
                }
                const imageData = imageBase64.split(',')[1];
                parts.push({
                    inlineData: {
                        mimeType: imageBase64.split(';')[0].split(':')[1],
                        data: imageData
                    }
                });
                contents.push({ role, parts });
            } else {
                contents.push({
                    role,
                    parts: [{ text: message.content }]
                });
            }
        }
        
        return contents;
    }

    // Handle Gemini streaming response
    async function handleGeminiStream(apiUrl, requestBody, streamCallback, doneCallback, errorCallback) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                geminiLogger.error('handleGeminiStream: Response not OK', { status: response.status, errorText });
                throw new Error(`Gemini API streaming error: ${response.status} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullResponse = '';
            let buffer = '';

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
                            if (parsedData.candidates?.[0]?.content?.parts?.[0]?.text) {
                                const textChunk = parsedData.candidates[0].content.parts[0].text;
                                fullResponse += textChunk;
                                streamCallback(textChunk);
                            }
                        } catch (e) {
                            geminiLogger.error('Error parsing Gemini stream data:', { error: e.message, data });
                        }
                    }
                }
            }
            doneCallback(fullResponse);
        } catch (error) {
            geminiLogger.error('Error handling Gemini stream:', error.message);
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
        const model = llmConfig.model || DEFAULT_MODEL;

        if (!apiKey) {
            const error = new Error('Gemini API key is required');
            geminiLogger.error(error.message);
            errorCallback(error);
            return;
        }

        try {
            const isStreaming = !!(streamCallback && doneCallback);
            const apiUrl = buildApiUrl(model, apiKey, isStreaming);
            const contents = buildContents(messages, systemPrompt, imageBase64, model);
            
            const requestBody = {
                contents,
                generationConfig: { ...DEFAULT_CONFIG }
            };

            if (isStreaming) {
                await handleGeminiStream(apiUrl, requestBody, streamCallback, doneCallback, errorCallback);
            } else {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                const responseText = data.candidates[0].content.parts[0].text;
                doneCallback(responseText);
            }
        } catch (error) {
            geminiLogger.error('Gemini API call failed:', error.message);
            errorCallback(error);
        }
    }

    return { execute };
})(); 