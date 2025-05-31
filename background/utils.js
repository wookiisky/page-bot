// background/utils.js

// This file can house utility functions used across the background scripts.
// Ensure serviceLogger is available or passed if needed by any functions here.

// Helper function to safely send messages to the runtime (e.g., sidebar)
function safeSendMessage(message, serviceLogger) {
    // Check if chrome.runtime exists and has a sendMessage method
    if (chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage(
            message,
            () => {
                if (chrome.runtime.lastError) {
                    // Log a debug message as this is often expected (e.g. sidebar closed)
                    if (serviceLogger && typeof serviceLogger.debug === 'function') {
                        serviceLogger.debug('safeSendMessage: Destination unavailable or error: ', chrome.runtime.lastError.message);
                    } else {
                        // console.debug('safeSendMessage: Destination unavailable or error: ', chrome.runtime.lastError.message);
                    }
                }
            }
        );
    } else {
        if (serviceLogger && typeof serviceLogger.error === 'function') {
            serviceLogger.error('safeSendMessage: chrome.runtime.sendMessage is not available.');
        } else {
            // console.error('safeSendMessage: chrome.runtime.sendMessage is not available.');
        }
    }
}

// Helper function to safely send messages to tabs
function safeSendTabMessage(tabId, message, serviceLogger, callback) {
    if (chrome.tabs && typeof chrome.tabs.sendMessage === 'function') {
        chrome.tabs.sendMessage(
            tabId,
            message,
            (response) => {
                if (chrome.runtime.lastError) {
                    if (serviceLogger && typeof serviceLogger.debug === 'function') {
                        serviceLogger.debug(`safeSendTabMessage error to tab ${tabId}: ${chrome.runtime.lastError.message}`);
                    }
                    if (callback) callback(null, chrome.runtime.lastError); // Pass error to callback
                    return;
                }
                if (callback) callback(response, null); // Pass response to callback
            }
        );
    } else {
        const errorMsg = 'safeSendTabMessage: chrome.tabs.sendMessage is not available.';
        if (serviceLogger && typeof serviceLogger.error === 'function') {
            serviceLogger.error(errorMsg);
        }
        if (callback) callback(null, new Error(errorMsg));
    }
}

// Helper function to check if URL is a restricted Chrome internal page
function isRestrictedPage(url) {
    if (!url) return true; // Treat undefined/null URLs as restricted

    const restrictedPrefixes = [
        'chrome://',
        'chrome-extension://',
        'edge://',
        'about:',
        'moz-extension://',
        'chrome-search://',
        'chrome-devtools://',
        'devtools://'
    ];

    return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

// Helper function to check if current page allows side panel
// Note: This function might need serviceLogger if we want to log from here.
// For now, keeping it self-contained.
async function checkSidePanelAllowed(serviceLogger, forUrl = null) {
    try {
        let urlToTest = forUrl;

        if (!urlToTest) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                if (serviceLogger) serviceLogger.warn('checkSidePanelAllowed: No active tab found.');
                return false;
            }
            if (!tab.url) {
                // This can happen for new tabs, etc.
                if (serviceLogger) serviceLogger.warn('checkSidePanelAllowed: Active tab URL is undefined.');
                return isRestrictedPage(tab.url); // Let isRestrictedPage handle undefined
            }
            urlToTest = tab.url;
        }

        const allowed = !isRestrictedPage(urlToTest);
        if (serviceLogger) {
            serviceLogger.info(`Side panel ${allowed ? 'allowed' : 'not allowed'} for page: ${urlToTest}`);
        }
        return allowed;
    } catch (error) {
        if (serviceLogger) {
            serviceLogger.error('Error checking side panel permission:', error);
        }
        return false; // Default to not allowed on error
    }
}

// If these functions are to be used by other files imported via importScripts,
// they need to be available in the global scope of the service worker.
// This happens automatically if this script is imported. 