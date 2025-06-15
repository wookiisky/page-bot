# Background LLM Continuation - Testing Guide

## Quick Test Scenarios

### Scenario 1: Basic Loading State Restoration
1. **Setup**: Open Page Bot on any webpage
2. **Action**: Send a message to the AI
3. **Test**: Immediately switch to another tab/page 
4. **Expected**: Sidebar closes, LLM continues processing in background
5. **Verification**: Return to original page and open sidebar
6. **Result**: Should see loading spinner if still processing, or completed response if finished

### Scenario 2: Cross-Tab Response Delivery
1. **Setup**: Have Page Bot processing a request (loading spinner visible)
2. **Action**: Switch to a different tab
3. **Wait**: Allow LLM request to complete (typically 10-30 seconds)
4. **Test**: Return to original tab and reopen sidebar
5. **Expected**: Should see the completed AI response, not stuck in loading state

### Scenario 3: Error State Preservation
1. **Setup**: Configure an invalid API key or trigger an LLM error
2. **Action**: Send a message that will cause an error
3. **Test**: Switch pages before error appears
4. **Verification**: Return to page and open sidebar
5. **Result**: Should display the error message, not show loading forever

### Scenario 4: Timeout Handling
1. **Setup**: Send a very complex request (long processing time)
2. **Action**: Switch pages and wait >10 minutes
3. **Test**: Return to original page
4. **Expected**: Should show "Request timed out after 10 minutes" message

### Scenario 5: Quick Tab Integration
1. **Setup**: Use Quick Tab functionality (e.g., "Summarize" tab)
2. **Action**: Click summarize, then immediately switch pages
3. **Test**: Return to page and check the summarize tab
4. **Expected**: Loading state should be restored in the correct tab, not the default chat tab

## Development Testing Commands

```bash
# Load extension in developer mode
# 1. Open Chrome Extensions page (chrome://extensions/)
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select the extension directory

# Monitor background script logs
# 1. Go to chrome://extensions/
# 2. Find your extension
# 3. Click "background page" link (or "service worker")
# 4. Open DevTools console to see background logs

# Monitor sidebar logs  
# 1. Open sidebar
# 2. Right-click in sidebar
# 3. Select "Inspect" 
# 4. Check console for sidebar-specific logs
```

## Debugging Checklist

### If Loading State Is Not Restored:
- [ ] Check browser console for JavaScript errors
- [ ] Verify `currentUrl` and `currentTabId` are set correctly
- [ ] Confirm loading state is saved in chrome.storage.local
- [ ] Check if `checkAndRestoreCurrentTabLoadingState()` is being called

### If Response Doesn't Appear After Completion:
- [ ] Verify background script `broadcastLoadingStateUpdate()` is called
- [ ] Check if sidebar is receiving `LOADING_STATE_UPDATE` messages
- [ ] Confirm `handleLoadingStateUpdate()` is processing the message
- [ ] Check if tab/URL matching logic is working correctly

### If Multiple Tabs Show Wrong States:
- [ ] Verify tab ID isolation in loading state keys
- [ ] Check URL normalization consistency
- [ ] Confirm message broadcasting only targets correct tabs

## Manual Testing Workflow

### Phase 1: Basic Functionality
1. Test normal message flow (without page switching)
2. Verify loading states are being cached
3. Check that loading states can be retrieved

### Phase 2: Page Switch Testing  
1. Test immediate page switch after sending message
2. Test delayed page switch (during processing)
3. Test multiple page switches during single request

### Phase 3: Edge Cases
1. Test with multiple tabs of same page
2. Test with restricted pages (chrome://)
3. Test with very long responses
4. Test with network interruptions

### Phase 4: Integration Testing
1. Test with different Quick Tab types
2. Test with different LLM providers
3. Test with different content extraction methods
4. Test chat history preservation

## Expected Log Messages

### Successful Flow:
```
[PageDataManager] Loading page data for URL: https://example.com, TabId: 123
[PageDataManager] Checking loading state for URL: https://example.com, TabId: 123, ActiveTab: chat
[TabManager] Found cached loading state for tab chat: loading
[TabManager] Restored loading UI for tab chat
[Sidebar] Received LOADING_STATE_UPDATE: {status: 'completed', ...}
[Sidebar] Handling completed LLM response from background broadcast
```

### Error Flow:
```
[PageDataManager] Found cached loading state for current tab: error
[TabManager] Restored error message for tab chat
```

## Performance Considerations

- Loading state checks add ~100ms to page load time
- Stream reconnection monitoring uses minimal CPU (5-second intervals)
- Background broadcasting is lightweight (only to relevant tabs)
- Auto-cleanup prevents memory leaks after 15 minutes

## Common Issues & Solutions

### Issue: "Loading state not found"
**Solution**: Ensure message was sent with proper tab ID and URL

### Issue: "Response appears in wrong tab"
**Solution**: Check activeTabId logic in tab manager

### Issue: "Multiple loading spinners"
**Solution**: Verify loading state cleanup on completion

### Issue: "Stuck in loading forever"
**Solution**: Check timeout handling and error callback execution

## Success Criteria

✅ **Loading states persist across page switches**  
✅ **Completed responses appear automatically when returning**  
✅ **Error states are preserved and displayed**  
✅ **Timeout handling works correctly (10-minute limit)**  
✅ **No memory leaks or stuck states**  
✅ **Compatible with existing Quick Tab functionality**  
✅ **Multiple tabs handle states independently**  

## Rollback Plan

If issues arise, the feature can be safely disabled by:
1. Removing `checkAndRestoreCurrentTabLoadingState()` calls
2. Removing `LOADING_STATE_UPDATE` message handling  
3. Removing `broadcastLoadingStateUpdate()` calls

The extension will continue to work normally with existing Quick Tab switching functionality. 