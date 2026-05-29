/**
============================================================
    Goal: Shared Utilities for Linux System Monitors
============================================================
    Why:
        - Eliminate code duplication between disk-monitor and system-health-monitor
        - Provide a single source of truth for configuration, alert tracking, and validation
        - Make thresholds and intervals configurable via environment variables

    What:
        - Loads environment variables from .env file
        - Reads config values from env with sensible defaults
        - Provides alert-file-based cooldown tracking
        - Validates Slack webhook presence
        - Installs a graceful shutdown handler
============================================================
*/

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if present
try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (error) {
    // dotenv not installed, fallback to direct env vars
}

const { getLogger } = require('./logger');
const logger = getLogger('common');


/**
 * Read configuration from environment variables with fallback defaults.
 * Core monitor thresholds and intervals are returned here.
 *
 * @returns {object} Merged configuration object
 */
function loadConfig() {
    return {
        SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/MOCK/WEBHOOK/URL',
        CPU_THRESHOLD:              parseInt(process.env.CPU_THRESHOLD, 10)              || 90,
        MEM_THRESHOLD:              parseInt(process.env.MEM_THRESHOLD, 10)              || 90,
        SWAP_THRESHOLD:             parseInt(process.env.SWAP_THRESHOLD, 10)             || 50,
        DISK_THRESHOLD:             parseInt(process.env.DISK_THRESHOLD, 10)             || 80,
        CHECK_INTERVAL:             parseInt(process.env.CHECK_INTERVAL, 10)             || 5 * 60 * 1000,
        ALERT_COOLDOWN:             parseInt(process.env.ALERT_COOLDOWN, 10)             || 30 * 60 * 1000,
        CPU_OVER_THRESHOLD_DURATION: parseInt(process.env.CPU_OVER_THRESHOLD_DURATION, 10) || 5 * 60 * 1000,
    };
}


/**
 * Create an alert tracker that persists the last-alert timestamp to a file.
 * This allows cooldown logic to survive process restarts.
 *
 * @param {string} filename  Name of the tracking file (e.g. '.last_disk_alert')
 * @returns {{ getLastAlertTime: Function, setLastAlertTime: Function }}
 */
function createAlertTracker(filename, monitorLogger = logger) {
    const filepath = path.join(__dirname, '..', filename);

    function getLastAlertTime() {
        try {
            if (fs.existsSync(filepath)) {
                const timestamp = fs.readFileSync(filepath, 'utf8');
                return parseInt(timestamp, 10);
            }
        } catch (error) {
            monitorLogger.error({ err: error, filepath }, 'Error reading last alert time');
        }
        return 0;
    }

    function setLastAlertTime() {
        try {
            fs.writeFileSync(filepath, Date.now().toString());
        } catch (error) {
            monitorLogger.error({ err: error, filepath }, 'Error writing last alert time');
        }
    }

    return { getLastAlertTime, setLastAlertTime };
}


/**
 * Validate that a Slack webhook URL has been configured.
 * Exits the process with an error message if not.
 *
 * @param {string} url  The webhook URL to validate
 */
function validateWebhook(url) {
    if (!url || url === 'YOUR_SLACK_WEBHOOK_URL_HERE' || url === 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL') {
        logger.fatal('Please set your Slack webhook URL in the SLACK_WEBHOOK_URL environment variable (see .env.example)');
        process.exit(1);
    }
}


/**
 * Install a SIGINT handler for graceful shutdown logging.
 *
 * @param {string} monitorName  Human-readable name shown on exit (e.g. 'Disk monitor')
 */
function setupGracefulShutdown(monitorName, monitorLogger = logger) {
    process.on('SIGINT', () => {
        monitorLogger.info({ signal: 'SIGINT', monitorName }, 'Monitor stopped');
        process.exit(0);
    });
}


module.exports = {
    loadConfig,
    createAlertTracker,
    validateWebhook,
    setupGracefulShutdown,
};
