/**
============================================================
    Goal: Disk Usage Monitor for Linux Servers
============================================================
    Why:
        - Proactively detect and alert on high disk usage
        - Prevent outages due to full disks by notifying admins via Slack
        - Automate monitoring and reduce manual checks

    What:
        - Periodically checks root disk usage
        - Sends Slack alerts when usage exceeds threshold
        - Implements cooldown to avoid alert spam
        - Tracks last alert time in a file
============================================================
*/

const cp = require('child_process');
const axios = require('axios');

const {
    loadConfig,
    createAlertTracker,
    validateWebhook,
    setupGracefulShutdown,
} = require('./lib/common');
const { getLogger } = require('./lib/logger');

const logger = getLogger('disk-monitor');

// =====================
// Configuration Section
// =====================
const config = loadConfig();

const SLACK_WEBHOOK_URL = config.SLACK_WEBHOOK_URL;
const DISK_THRESHOLD    = config.DISK_THRESHOLD;
const CHECK_INTERVAL    = config.CHECK_INTERVAL;
const ALERT_COOLDOWN    = config.ALERT_COOLDOWN;

// Alert cooldown tracking (persisted to file)
const alertTracker = createAlertTracker('.last_disk_alert', logger);


// Get disk usage percentage for root filesystem
function getDiskUsage() {
    try {
        // Uses 'df -h' and 'awk' to extract usage %
        const output = cp.execSync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'", { encoding: 'utf8' });
        return parseInt(output.trim());
    } catch (error) {
        logger.error({ err: error }, 'Error getting disk usage');
        return null;
    }
}


// Send alert to Slack channel via webhook
async function sendSlackAlert(diskUsage) {
    const hostname = require('os').hostname();
    const message = {
        text: `🚨 Disk Usage Alert`,
        attachments: [
            {
                color: 'danger',
                fields: [
                    {
                        title: 'Server',
                        value: hostname,
                        short: true
                    },
                    {
                        title: 'Disk Usage',
                        value: `${diskUsage}%`,
                        short: true
                    },
                    {
                        title: 'Threshold',
                        value: `${DISK_THRESHOLD}%`,
                        short: true
                    },
                    {
                        title: 'Time',
                        value: new Date().toISOString(),
                        short: true
                    }
                ]
            }
        ]
    };

    try {
        await axios.post(SLACK_WEBHOOK_URL, message);
        logger.info({ diskUsage, threshold: DISK_THRESHOLD }, 'Slack disk alert sent');
        alertTracker.setLastAlertTime();
    } catch (error) {
        logger.error({ err: error, diskUsage }, 'Error sending Slack message');
    }
}


/*
  Main disk check logic:
    - Checks root disk usage
    - If usage exceeds threshold, checks cooldown
    - Sends Slack alert if allowed
*/
function checkDiskUsage() {
    const diskUsage = getDiskUsage();
    if (diskUsage === null) {
        logger.warn('Could not retrieve disk usage');
        return;
    }
    logger.info({ diskUsage }, 'Disk usage sampled');
    if (diskUsage >= DISK_THRESHOLD) {
        const lastAlertTime = alertTracker.getLastAlertTime();
        const now = Date.now();
        // Only send alert if cooldown expired
        if (now - lastAlertTime >= ALERT_COOLDOWN) {
            sendSlackAlert(diskUsage);
        } else {
            logger.info({ diskUsage, threshold: DISK_THRESHOLD }, 'Disk usage over threshold, but alert cooldown still active');
        }
    }
}


// =====================
// Startup
// =====================
if (require.main === module) {
    validateWebhook(SLACK_WEBHOOK_URL);

    logger.info({
        checkIntervalMinutes: CHECK_INTERVAL / 1000 / 60,
        alertThresholdPercent: DISK_THRESHOLD,
        alertCooldownMinutes: ALERT_COOLDOWN / 1000 / 60,
    }, 'Disk usage monitor started');

    // Initial disk check and schedule periodic checks
    checkDiskUsage();
    setInterval(checkDiskUsage, CHECK_INTERVAL);

    setupGracefulShutdown('Disk monitor', logger);
}


// Export functions for testing and extension
module.exports = {
    getDiskUsage,
    sendSlackAlert,
    checkDiskUsage
};