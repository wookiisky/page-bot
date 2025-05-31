// background/handlers/configHandler.js

async function handleGetConfig(configManager, serviceLogger) {
    serviceLogger.info('Handler: Getting config');
    try {
        const config = await configManager.getConfig();
        return { 
            type: 'CONFIG_LOADED', 
            config: config 
        };
    } catch (error) {
        serviceLogger.error('Handler: Error getting config:', error);
        return { type: 'CONFIG_ERROR', error: error.message || 'Failed to get config' };
    }
}

async function handleSaveConfig(data, configManager, serviceLogger) {
    serviceLogger.info('Handler: Saving config');
    try {
        await configManager.saveConfig(data.config);
        return { type: 'CONFIG_SAVED' };
    } catch (error) {
        serviceLogger.error('Handler: Error saving config:', error);
        return { type: 'CONFIG_ERROR', error: error.message || 'Failed to save config' };
    }
} 