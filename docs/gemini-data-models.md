# Gemini API Data Models for VIVIM Extension

## Overview
This document outlines the data models required for proper Gemini API integration in the VIVIM Chrome extension, including request/response formats, conversation management, and data feed structures.

## 1. Gemini API Request Format

### Basic Request Structure
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "User message content"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 2048,
    "topP": 1.0,
    "topK": 1,
    "responseMimeType": "text/plain",
    "responseSchema": {
      "type": "object",
      "properties": {
        "field": {"type": "string"}
      }
    },
    "stopSequences": ["stop"],
    "seed": 42
  },
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
  ],
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "function_name",
          "description": "Function description",
          "parameters": {
            "type": "object",
            "properties": {
              "param": {"type": "string"}
            }
          }
        }
      ]
    }
  ],
  "systemInstruction": {
    "role": "user",
    "parts": [{"text": "System prompt"}]
  }
}
```

### Multi-Turn Conversation Format
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "Hello"}]
    },
    {
      "role": "model",
      "parts": [{"text": "Hi there! How can I help?"}]
    },
    {
      "role": "user",
      "parts": [{"text": "Tell me about Python"}]
    }
  ],
  "generationConfig": {
    "temperature": 0.7
  }
}
```

## 2. Gemini API Response Format

### Non-Streaming Response
```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "text": "Model response content"
          }
        ]
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 20,
    "totalTokenCount": 30
  },
  "modelVersion": "gemini-2.0-flash",
  "responseId": "response-uuid"
}
```

### Streaming Response (SSE Format)
```
data: {"candidates":[{"content":{"parts":[{"text":"partial"}],"role":"model"},"index":0}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":15}}

data: {"candidates":[{"content":{"parts":[{"text":" response"}],"role":"model"},"index":0}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":10,"totalTokenCount":20}}
```

## 3. VIVIM Internal Data Models

### Conversation Storage Format
```json
{
  "conversationId": "conv_1234567890_123",
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Hello",
      "timestamp": 1640995200000,
      "model": null,
      "metadata": {
        "contentLength": 5,
        "hasAttachments": false
      }
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Hi there! How can I help you?",
      "timestamp": 1640995260000,
      "model": "gemini-pro",
      "metadata": {
        "contentLength": 25,
        "finishReason": "STOP",
        "usage": {
          "promptTokens": 10,
          "completionTokens": 15,
          "totalTokens": 25
        }
      }
    }
  ],
  "metadata": {
    "provider": "gemini",
    "createdAt": 1640995200000,
    "lastUpdated": 1640995260000,
    "model": "gemini-pro",
    "totalTokens": 25,
    "temperature": 0.7,
    "hasSystemInstruction": false,
    "hasTools": false,
    "conversationFlowValid": true
  }
}
```

### Data Feed Event Format
```json
{
  "timestamp": 1640995260000,
  "eventType": "message:sent",
  "sessionId": "session_abc123",
  "provider": "gemini",
  "data": {
    "role": "user",
    "content": "Hello",
    "contentLength": 5,
    "conversationId": "conv_123",
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 2048
    },
    "conversationHistoryLength": 1,
    "hasSystemInstruction": false,
    "hasTools": false,
    "hasSafetySettings": true
  }
}
```

```json
{
  "timestamp": 1640995270000,
  "eventType": "message:received",
  "sessionId": "session_abc123",
  "provider": "gemini",
  "data": {
    "role": "assistant",
    "content": "Hi there! How can I help you?",
    "contentLength": 25,
    "model": "gemini-pro",
    "conversationId": "conv_123",
    "streamId": "gemini_1640995200000_123",
    "finishReason": "STOP",
    "usage": {
      "promptTokens": 10,
      "completionTokens": 15,
      "totalTokens": 25
    },
    "safetyRatings": [
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
      }
    ]
  }
}
```

## 4. Provider-Specific Data Models

### Auth Store Format
```json
{
  "psid": "auth_token_psid",
  "psidts": "auth_token_psidts",
  "snlm0e": "session_token_snlm0e",
  "updatedAt": 1640995200000
}
```

### Secure Storage Format
```json
{
  "gemini_auth": {
    "psid": "encrypted_psid",
    "psidts": "encrypted_psidts",
    "snlm0e": "encrypted_snlm0e"
  }
}
```

## 5. Streaming Data Models

### Stream Metadata
```json
{
  "streamId": "gemini_1640995200000_123",
  "model": "gemini-pro",
  "provider": "gemini",
  "startTime": 1640995200000,
  "chunks": [
    {
      "index": 0,
      "content": "partial response",
      "timestamp": 1640995260000
    }
  ],
  "accumulatedContent": "full response content",
  "usageData": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 15,
    "totalTokenCount": 25
  },
  "finishReason": "STOP"
}
```

### Chunk Processing Data
```json
{
  "content": "new text chunk",
  "role": "model",
  "model": "gemini-pro",
  "isFinal": false,
  "seq": 1,
  "streamId": "gemini_1640995200000_123",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 5,
    "totalTokens": 15
  }
}
```

## 6. Error Handling Data Models

### Provider Error Format
```json
{
  "error": {
    "name": "APIError",
    "message": "Request failed with status 429",
    "status": 429,
    "type": "rate_limit",
    "retryable": true,
    "retryAfter": 60
  },
  "context": {
    "provider": "gemini",
    "operation": "generateContent",
    "requestId": "req_123",
    "timestamp": 1640995200000
  }
}
```

## 7. Configuration Data Models

### Provider Configuration
```json
{
  "id": "gemini",
  "name": "Gemini",
  "hosts": ["gemini.google.com", "generativelanguage.googleapis.com"],
  "capabilities": {
    "supportsStreaming": true,
    "supportsAuth": true,
    "messageFormat": "google",
    "supportsTools": true,
    "supportsSystemInstructions": true,
    "supportedModels": ["gemini-pro", "gemini-pro-vision", "gemini-2.0-flash"]
  },
  "interceptPatterns": {
    "request": "/(?:generateContent|streamGenerateContent)\\?"
  },
  "defaultConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 2048,
    "topP": 1.0,
    "topK": 1
  }
}
```

## Implementation Notes

1. **Conversation Flow Validation**: Ensure proper user-model alternation in conversation history
2. **Content Extraction**: Handle multiple parts per message (text, images, function calls)
3. **Streaming Processing**: Accumulate streaming chunks and emit complete messages to data feed
4. **Error Recovery**: Implement retry logic for transient failures (rate limits, network issues)
5. **Auth Management**: Securely store and refresh authentication tokens
6. **Usage Tracking**: Monitor token usage for cost management and rate limiting
7. **Safety Compliance**: Handle safety ratings and content filtering appropriately

These data models ensure comprehensive integration with the Gemini API while maintaining compatibility with VIVIM's existing architecture and data feed system.