# Loading State Cache Implementation

## Overview

This implementation adds persistent loading state caching to the Page Bot extension, allowing users to see previous execution results when switching between quick tabs, even if the LLM request is still in progress.

## Key Features

1. **Persistent Loading State**: Loading states are cached when LLM calls are initiated
2. **Background Processing**: LLM requests continue processing in the background
3. **Timeout Handling**: Loading states auto-cancel after 10 minutes
4. **UI State Restoration**: Switching tabs restores the appropriate loading/result state

## Implementation Details

### 1. Loading State Cache Module (`js/modules/loading_state_cache.js`)

- **Purpose**: Manages loading states for LLM calls with timeout handling
- **Key Functions**:
  - `saveLoadingState()`: Save loading state when LLM call starts
  - `completeLoadingState()`: Update state when LLM call completes
  - `errorLoadingState()`: Update state when LLM call fails
  - `getLoadingState()`: Retrieve loading state with timeout check
  - `clearLoadingState()`: Clear state for specific tab

### 2. Service Worker Updates

- **Import**: Added loading state cache module to service worker
- **Handler**: Created `getLoadingStateHandler.js` and `clearLoadingStateHandler.js`
- **Message Types**: Added `GET_LOADING_STATE` and `CLEAR_LOADING_STATE` support

### 3. LLM Message Handler Updates (`background/handlers/sendLlmMessageHandler.js`)

- **Loading State Tracking**: Saves loading state when LLM call starts
- **Completion Handling**: Updates state to 'completed' when LLM responds
- **Error Handling**: Updates state to 'error' when LLM call fails
- **Tab ID Support**: Includes tab ID in all loading state operations

### 4. Chat Manager Updates (`sidebar/modules/chat-manager.js`)

- **Tab ID Passing**: Passes current tab ID with LLM requests
- **Clear Functionality**: Clears loading states when conversation is cleared

### 5. Tab Manager Updates (`sidebar/components/tab-manager.js`)

- **Loading State Restoration**: Checks cached loading states when switching tabs
- **UI State Restoration**: Restores appropriate UI based on cached state:
  - Loading: Shows spinner
  - Timeout: Shows timeout message
  - Error: Shows error message
  - Completed: Shows normal chat history

## Usage Flow

1. **User sends message**: Loading state is saved to cache with timestamp
2. **Tab switching**: User can switch to other tabs while LLM processes
3. **Background processing**: LLM request continues in service worker
4. **State updates**: Loading state is updated when LLM completes/errors
5. **Tab restoration**: When user returns to tab, appropriate UI is restored

## Timeout Handling

- **Duration**: 10 minutes from initial request
- **Auto-cancel**: Loading states automatically change to 'timeout' status
- **UI Message**: Shows timeout message to user

## Error Handling

- **LLM Errors**: Captured and stored in loading state cache
- **Network Errors**: Handled gracefully with error state
- **Missing Data**: Proper validation and error messages

## Storage Keys

- **Format**: `readBotLoadingState_{normalizedUrl}#{tabId}`
- **Scope**: Per-tab loading states
- **Cleanup**: States are cleared when conversations are cleared

## Benefits

1. **Better UX**: Users can see previous results when switching tabs
2. **No Lost Work**: LLM processing continues in background
3. **Timeout Safety**: Prevents stuck loading states
4. **Error Recovery**: Clear error messages for failed requests

## Dependencies

- Chrome Extension API (storage, runtime messaging)
- Existing storage module for chat history
- Tab manager for tab switching
- Chat manager for message handling

## Testing

To test the implementation:

1. Send a message in a quick tab
2. Switch to another tab while LLM is processing
3. Switch back to original tab
4. Verify that loading state is restored correctly
5. Wait for LLM response and verify completion state 