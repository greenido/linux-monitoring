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

// Node.js modules for system commands, HTTP requests, file operations, and path handling
const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if present
try {
        require('dotenv').config();
} catch (error) {
        // dotenv not installed, fallback to direct env vars
}

// =====================
// Configuration Section
// =====================
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; // Slack webhook for alerts
const DISK_THRESHOLD = 80; // Disk usage % threshold
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 min
const ALERT_COOLDOWN = 30 * 60 * 1000; // Wait 30 min between alerts

// File to track last alert timestamp
const LAST_ALERT_FILE = path.join(__dirname, '.last_disk_alert');


// Get disk usage percentage for root filesystem
function getDiskUsage() {
    try {
        // Uses 'df -h' and 'awk' to extract usage %
        const output = execSync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'", { encoding: 'utf8' });
        return parseInt(output.trim());
    } catch (error) {
        console.error('Error getting disk usage:', error.message);
        return null;
    }
}


// Read last alert timestamp from file
function getLastAlertTime() {
    try {
        if (fs.existsSync(LAST_ALERT_FILE)) {
            const timestamp = fs.readFileSync(LAST_ALERT_FILE, 'utf8');
            return parseInt(timestamp);
        }
    } catch (error) {
        console.error('Error reading last alert time:', error.message);
    }
    return 0;
}


// Write current timestamp to last alert file
function setLastAlertTime() {
    try {
        fs.writeFileSync(LAST_ALERT_FILE, Date.now().toString());
    } catch (error) {
        console.error('Error writing last alert time:', error.message);
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
        console.log(`Slack alert sent: Disk usage at ${diskUsage}%`);
        setLastAlertTime();
    } catch (error) {
        console.error('Error sending Slack message:', error.message);
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
        console.log('Could not retrieve disk usage');
        return;
    }
    console.log(`Current disk usage: ${diskUsage}%`);
    if (diskUsage >= DISK_THRESHOLD) {
        const lastAlertTime = getLastAlertTime();
        const now = Date.now();
        // Only send alert if cooldown expired
        if (now - lastAlertTime >= ALERT_COOLDOWN) {
            sendSlackAlert(diskUsage);
        } else {
            console.log('Disk usage over threshold, but alert cooldown still active');
        }
    }
}


// Ensure Slack webhook is set before starting
if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'YOUR_SLACK_WEBHOOK_URL_HERE') {
    console.error('Please set your Slack webhook URL in the SLACK_WEBHOOK_URL variable');
    process.exit(1);
}

// Startup logs for visibility
console.log('Disk usage monitor started');
console.log(`Checking every ${CHECK_INTERVAL / 1000 / 60} minutes`);
console.log(`Alert threshold: ${DISK_THRESHOLD}%`);
console.log(`Alert cooldown: ${ALERT_COOLDOWN / 1000 / 60} minutes`);

// Initial disk check and schedule periodic checks
checkDiskUsage();
setInterval(checkDiskUsage, CHECK_INTERVAL);

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
    console.log('\nDisk monitor stopped');
    process.exit(0);
});