// background/handlers/tabActivationHandler.js

// Ensure necessary global variables (like serviceLogger, isRestrictedPage, safeSendMessage) 
// are available from service-worker.js or passed as parameters.

async function handleTabActivated(activeInfo, serviceLogger, isRestrictedPage, safeSendMessage) {
    const { tabId } = activeInfo;
    serviceLogger.info('Tab activated, tabId:', tabId);

    try {
        // Phase 1: Attempt to disable the side panel for the newly activated tab.
        try {
            await chrome.sidePanel.setOptions({
                tabId: tabId,
                enabled: false
            });
        } catch (error) {
            serviceLogger.warn('Error initially setting side panel to "disabled" for tab:', tabId, error.message);
        }

        // Phase 2: Get tab details.
        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
        } catch (getTabError) {
            serviceLogger.error('Failed to get tab details for tabId:', tabId, getTabError.message);
            return; // Exit if tab details cannot be retrieved
        }

        if (!tab) {
            serviceLogger.warn('Tab object not retrieved for tabId:', tabId, '(after get call, but no error thrown). Side panel remains disabled.');
            return;
        }

        const currentUrl = tab.url;
        const tabTitle = tab.title ? tab.title.substring(0, 70) + (tab.title.length > 70 ? '...' : '') : undefined;
        serviceLogger.info('Processing activated tab:', { tabId, url: currentUrl, title: tabTitle });

        // Phase 3: Conditionally re-enable the side panel after a short delay.
        setTimeout(async () => {
            try {
                if (!isRestrictedPage(currentUrl)) {
                    await chrome.sidePanel.setOptions({
                        tabId: tabId,
                        enabled: true
                    });
                } else {
                    // For restricted pages, panel remains disabled.
                }
            } catch (error) {
                serviceLogger.warn('Error in conditional re-enabling of side panel for tab:', { tabId, url: currentUrl }, error.message);
            }
        }, 100); // 100ms delay

        // Phase 4: Notify the sidebar about the tab change if URL is available.
        if (currentUrl) {
            safeSendMessage({
                type: 'TAB_CHANGED',
                url: currentUrl
            });
        } else {
            serviceLogger.info('Tab activated but URL is undefined. Not sending TAB_CHANGED message.', { tabId });
        }

    } catch (error) {
        serviceLogger.error('Critical error in onActivated listener for tabId:', tabId, error);
    }
} 