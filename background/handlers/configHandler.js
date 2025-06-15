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

async function handleResetConfig(configManager, serviceLogger) {
    serviceLogger.info('Handler: Resetting config to defaults');
    try {
        await configManager.resetConfig();
        return { type: 'CONFIG_RESET' };
    } catch (error) {
        serviceLogger.error('Handler: Error resetting config:', error);
        return { type: 'CONFIG_ERROR', error: error.message || 'Failed to reset config' };
    }
}

async function handleCheckConfigHealth(configManager, serviceLogger) {
    serviceLogger.info('Handler: Checking config health and storage usage');
    try {
        const healthInfo = await configManager.checkStorageUsage();
        return { 
            type: 'CONFIG_HEALTH_CHECKED', 
            healthInfo: healthInfo 
        };
    } catch (error) {
        serviceLogger.error('Handler: Error checking config health:', error);
        return { type: 'CONFIG_ERROR', error: error.message || 'Failed to check config health' };
    }
} 