// Read Bot LLM Service Module
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
        // Optionally, rethrow the error or handle it in a default way
        // throw error; 
    }
  }
}

// Call Gemini API
async function callGemini(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  const apiKey = llmConfig.apiKey;
  const model = llmConfig.model || 'gemini-pro';
  
  if (!apiKey) {
    const error = new Error('Gemini API key is required');
    errorCallback(error);
    return;
  }
  
  try {
    // Build the API URL based on whether it's a streaming request
    let apiUrl;
    if (streamCallback && doneCallback) {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    }
    
    // Build the contents array
    const contents = [];
    
    // Add system prompt as a user message if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      
      // Add an empty assistant response to maintain the conversation flow
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I will analyze the provided content.' }]
      });
    }
    
    // Convert messages to Gemini format
    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : 'user';
      
      // Handle multimodal input (image + text) for the last user message
      if (role === 'user' && imageBase64 && message === messages[messages.length - 1] && model.includes('vision')) {
        // For multi-modal input
        const parts = [];
        
        // Add text if present
        if (message.content) {
          parts.push({ text: message.content });
        }
        
        // Add image
        const imageData = imageBase64.split(',')[1]; // Remove the data:image/xxx;base64, prefix
        parts.push({
          inlineData: {
            mimeType: imageBase64.split(';')[0].split(':')[1], // Extract MIME type
            data: imageData
          }
        });
        
        contents.push({ role, parts });
      } else {
        // Regular text-only message
        contents.push({
          role,
          parts: [{ text: message.content }]
        });
      }
    }
    
    // Build the request body
    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };
    
    // If streaming
    if (streamCallback && doneCallback) {
      await handleGeminiStream(
        apiUrl,
        requestBody,
        streamCallback,
        doneCallback,
        errorCallback
      );
    } else {
      // Non-streaming request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // Extract the response text
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Call the done callback with the full response
      doneCallback(responseText);
    }
  } catch (error) {
    llmLogger.error('Gemini API call failed:', error.message);
    errorCallback(error);
  }
}

// Handle Gemini streaming response
async function handleGeminiStream(apiUrl, requestBody, streamCallback, doneCallback, errorCallback) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API streaming error: ${response.status} - ${errorText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';
    let chunkCount = 0; // Counter for chunks
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      chunkCount++;
      // Decode the chunk and add it to the buffer
      const decodedChunk = decoder.decode(value, { stream: true });
      buffer += decodedChunk;
      
      // Process SSE format
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Stream completed
            doneCallback(fullResponse);
            return;
          }
          
          try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.candidates && parsedData.candidates[0]?.content?.parts?.[0]?.text) {
              const textChunk = parsedData.candidates[0].content.parts[0].text;
              fullResponse += textChunk;
              streamCallback(textChunk);
            }
          } catch (e) {
            llmLogger.error('Error parsing Gemini stream data:', { error: e.message, data });
            // Do not rethrow, continue processing the stream
          }
        }
      }
    }
    
    // If we get here, the stream ended without a [DONE] marker
    doneCallback(fullResponse);
  } catch (error) {
    llmLogger.error('Error handling Gemini stream:', error.message);
    errorCallback(error);
  }
}

// Call OpenAI API
async function callOpenAI(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  const apiKey = llmConfig.apiKey;
  const baseUrl = llmConfig.baseUrl || 'https://api.openai.com';
  const model = llmConfig.model || 'gpt-3.5-turbo';
  
  if (!apiKey) {
    const error = new Error('OpenAI API key is required');
    errorCallback(error);
    return;
  }
  
  try {
    // Build API URL
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    
    // Prepare messages array for OpenAI format
    const openaiMessages = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Convert messages to OpenAI format
    for (const message of messages) {
      // For the last user message, check if there's an image to include
      if (
        message.role === 'user' && 
        imageBase64 && 
        message === messages[messages.length - 1] && 
        ['gpt-4-vision-preview', 'gpt-4o', 'gpt-4o-mini'].includes(model)
      ) {
        // For multi-modal input
        openaiMessages.push({
          role: 'user',
          content: [
            // Text content
            { type: 'text', text: message.content },
            
            // Image content
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
        // Regular text-only message
        openaiMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }
    
    // Build request body
    const requestBody = {
      model: model,
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: !!streamCallback
    };
    
    // Make API request
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
    
    // Handle streaming response
    if (streamCallback) {
      await handleOpenAIStream(response, streamCallback, doneCallback, errorCallback);
    } else {
      // Handle regular response
      const data = await response.json();
      const responseText = data.choices[0].message.content;
      doneCallback(responseText);
    }
  } catch (error) {
    llmLogger.error('OpenAI API call failed:', error.message);
    errorCallback(error);
  }
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
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add it to the buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Stream completed
            doneCallback(fullResponse);
            return;
          }
          
          try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.choices && parsedData.choices[0].delta && parsedData.choices[0].delta.content) {
              const textChunk = parsedData.choices[0].delta.content;
              fullResponse += textChunk;
              streamCallback(textChunk);
            }
          } catch (e) {
            llmLogger.error('Error parsing OpenAI stream data:', { error: e.message, data });
            // Do not rethrow, continue processing the stream
          }
        }
      }
    }
    
    // If we get here, the stream ended without a [DONE] marker
    doneCallback(fullResponse);
  } catch (error) {
    llmLogger.error('Error handling OpenAI stream:', error.message);
    errorCallback(error);
  }
}