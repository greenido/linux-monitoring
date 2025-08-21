
const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (error) {
    // dotenv not installed, use environment variables directly
}

// Configuration
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISK_THRESHOLD = 80; // Percentage threshold
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes (in milliseconds)
const ALERT_COOLDOWN = 30 * 60 * 1000; // Don't send alerts more than once every 30 minutes

// File to track last alert time
const LAST_ALERT_FILE = path.join(__dirname, '.last_disk_alert');

function getDiskUsage() {
    try {
        // Get disk usage for root filesystem
        const output = execSync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'", { encoding: 'utf8' });
        return parseInt(output.trim());
    } catch (error) {
        console.error('Error getting disk usage:', error.message);
        return null;
    }
}

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

function setLastAlertTime() {
    try {
        fs.writeFileSync(LAST_ALERT_FILE, Date.now().toString());
    } catch (error) {
        console.error('Error writing last alert time:', error.message);
    }
}

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
        
        // Check if enough time has passed since last alert
        if (now - lastAlertTime >= ALERT_COOLDOWN) {
            sendSlackAlert(diskUsage);
        } else {
            console.log('Disk usage over threshold, but alert cooldown still active');
        }
    }
}

// Validate configuration
if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'YOUR_SLACK_WEBHOOK_URL_HERE') {
    console.error('Please set your Slack webhook URL in the SLACK_WEBHOOK_URL variable');
    process.exit(1);
}

console.log('Disk usage monitor started');
console.log(`Checking every ${CHECK_INTERVAL / 1000 / 60} minutes`);
console.log(`Alert threshold: ${DISK_THRESHOLD}%`);
console.log(`Alert cooldown: ${ALERT_COOLDOWN / 1000 / 60} minutes`);

// Initial check
checkDiskUsage();

// Set up interval for regular checks
setInterval(checkDiskUsage, CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nDisk monitor stopped');
    process.exit(0);
});