#!/usr/bin/env node

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
const CPU_THRESHOLD = 90; // %
const MEM_THRESHOLD = 90; // %
const SWAP_THRESHOLD = 50; // %
const CPU_OVER_THRESHOLD_DURATION = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutes

const LAST_ALERT_FILE = path.join(__dirname, '.last_health_alert');

function getCpuUsage() {
    try {
        const output = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        console.error('Error getting CPU usage:', error.message);
        return null;
    }
}

function getTopCpuProcesses(limit = 5) {
    try {
        const output = execSync(`ps aux --sort=-%cpu | head -${limit + 1} | tail -${limit}`, { encoding: 'utf8' });
        return output.trim().split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
                return {
                    user: parts[0],
                    pid: parts[1],
                    cpu: parseFloat(parts[2]),
                    mem: parseFloat(parts[3]),
                    vsz: parts[4],
                    rss: parts[5],
                    tty: parts[6],
                    stat: parts[7],
                    start: parts[8],
                    time: parts[9],
                    command: parts.slice(10).join(' ')
                };
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        console.error('Error getting top CPU processes:', error.message);
        return [];
    }
}

function getMemUsage() {
    try {
        const output = execSync("free | grep Mem | awk '{print $3/$2 * 100.0}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        console.error('Error getting memory usage:', error.message);
        return null;
    }
}

function getDetailedMemoryInfo() {
    try {
        const freeOutput = execSync("free -h", { encoding: 'utf8' });
        const memLine = freeOutput.split('\n')[1];
        const parts = memLine.trim().split(/\s+/);
        
        return {
            total: parts[1],
            used: parts[2],
            free: parts[3],
            shared: parts[4],
            cache: parts[5],
            available: parts[6]
        };
    } catch (error) {
        console.error('Error getting detailed memory info:', error.message);
        return null;
    }
}

function getTopMemoryProcesses(limit = 5) {
    try {
        const output = execSync(`ps aux --sort=-%mem | head -${limit + 1} | tail -${limit}`, { encoding: 'utf8' });
        return output.trim().split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
                return {
                    user: parts[0],
                    pid: parts[1],
                    cpu: parseFloat(parts[2]),
                    mem: parseFloat(parts[3]),
                    vsz: parts[4],
                    rss: parts[5],
                    tty: parts[6],
                    stat: parts[7],
                    start: parts[8],
                    time: parts[9],
                    command: parts.slice(10).join(' ')
                };
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        console.error('Error getting top memory processes:', error.message);
        return [];
    }
}

function getSwapUsage() {
    try {
        const output = execSync("free | grep Swap | awk '{if ($2==0) print 0; else print $3/$2 * 100.0}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        console.error('Error getting swap usage:', error.message);
        return null;
    }
}

function getDetailedSwapInfo() {
    try {
        const freeOutput = execSync("free -h", { encoding: 'utf8' });
        const swapLine = freeOutput.split('\n')[2];
        const parts = swapLine.trim().split(/\s+/);
        
        return {
            total: parts[1],
            used: parts[2],
            free: parts[3]
        };
    } catch (error) {
        console.error('Error getting detailed swap info:', error.message);
        return null;
    }
}

function getSystemLoad() {
    try {
        const output = execSync("uptime", { encoding: 'utf8' });
        const loadMatch = output.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/);
        if (loadMatch) {
            return {
                '1min': parseFloat(loadMatch[1]),
                '5min': parseFloat(loadMatch[2]),
                '15min': parseFloat(loadMatch[3])
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting system load:', error.message);
        return null;
    }
}

function getUptime() {
    try {
        const output = execSync("uptime -p", { encoding: 'utf8' });
        return output.trim();
    } catch (error) {
        console.error('Error getting uptime:', error.message);
        return null;
    }
}

function getDiskUsage() {
    try {
        const output = execSync("df -h / | tail -1", { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usagePercent: parts[4],
            mountpoint: parts[5]
        };
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

function formatProcessList(processes, type) {
    if (!processes || processes.length === 0) return 'No processes found';
    
    return processes.map((proc, index) => {
        const shortCommand = proc.command.length > 50 ? proc.command.substring(0, 47) + '...' : proc.command;
        return `${index + 1}. *${shortCommand}*\n   PID: ${proc.pid} | User: ${proc.user} | ${type === 'cpu' ? `CPU: ${proc.cpu}%` : `Memory: ${proc.mem}%`} | RSS: ${proc.rss}`;
    }).join('\n');
}

async function sendSlackAlert(alerts) {
    const hostname = require('os').hostname();
    const uptime = getUptime();
    const load = getSystemLoad();
    const disk = getDiskUsage();
    
    let messageText = `🚨 *System Health Alert on ${hostname}*`;
    if (uptime) messageText += `\n⏰ Uptime: ${uptime}`;
    if (load) messageText += `\n📊 Load: ${load['1min']} (1m), ${load['5min']} (5m), ${load['15min']} (15m)`;
    if (disk) messageText += `\n💾 Root Disk: ${disk.used}/${disk.size} (${disk.usagePercent})`;
    
    const attachments = alerts.map(alert => ({
        color: 'danger',
        title: alert.title,
        text: alert.value,
        fields: alert.fields || [],
        ts: Math.floor(Date.now() / 1000)
    }));
    
    const message = {
        text: messageText,
        attachments: attachments
    };
    
    try {
        await axios.post(SLACK_WEBHOOK_URL, message);
        console.log('Slack alert sent:', alerts.map(a => a.title).join(', '));
        setLastAlertTime();
    } catch (error) {
        console.error('Error sending Slack message:', error.message);
    }
}

// Track CPU over-threshold duration
let cpuOverThresholdSince = null;

function checkSystemHealth() {
    const alerts = [];
    const cpu = getCpuUsage();
    const mem = getMemUsage();
    const swap = getSwapUsage();
    const now = Date.now();

    // CPU: Only alert if over threshold for more than 5 minutes
    if (cpu !== null && cpu >= CPU_THRESHOLD) {
        if (!cpuOverThresholdSince) {
            cpuOverThresholdSince = now;
        }
        if (now - cpuOverThresholdSince >= CPU_OVER_THRESHOLD_DURATION) {
            const topProcesses = getTopCpuProcesses(8);
            const processDetails = formatProcessList(topProcesses, 'cpu');
            
            alerts.push({
                title: '🚀 High CPU Usage Detected',
                value: `*Current CPU Usage: ${cpu.toFixed(1)}%*\n*Threshold: ${CPU_THRESHOLD}%*\n*Duration: ${((now - cpuOverThresholdSince) / 60000).toFixed(1)} minutes*\n\n*Top CPU Processes:*\n${processDetails}`,
                fields: [
                    {
                        title: 'System Impact',
                        value: 'High CPU usage can cause system slowdown, increased response times, and potential service degradation.',
                        short: false
                    }
                ]
            });
        } else {
            console.log(`CPU over threshold, but not for 5 minutes yet (${((now-cpuOverThresholdSince)/60000).toFixed(1)} min)`);
        }
    } else {
        cpuOverThresholdSince = null;
    }
    
    if (mem !== null && mem >= MEM_THRESHOLD) {
        const detailedMem = getDetailedMemoryInfo();
        const topProcesses = getTopMemoryProcesses(8);
        const processDetails = formatProcessList(topProcesses, 'memory');
        
        let memoryDetails = `*Current Memory Usage: ${mem.toFixed(1)}%*\n*Threshold: ${MEM_THRESHOLD}%*`;
        
        if (detailedMem) {
            memoryDetails += `\n*Memory Breakdown:*\n• Total: ${detailedMem.total}\n• Used: ${detailedMem.used}\n• Available: ${detailedMem.available}\n• Cache: ${detailedMem.cache}`;
        }
        
        memoryDetails += `\n\n*Top Memory Processes:*\n${processDetails}`;
        
        alerts.push({
            title: '🧠 High Memory Usage Detected',
            value: memoryDetails,
            fields: [
                {
                    title: 'Memory Status',
                    value: detailedMem ? `Used: ${detailedMem.used} | Available: ${detailedMem.available} | Cache: ${detailedMem.cache}` : 'Memory details unavailable',
                    short: true
                },
                {
                    title: 'Potential Issues',
                    value: 'High memory usage may lead to swapping, system slowdown, and potential out-of-memory errors.',
                    short: false
                }
            ]
        });
    }
    
    if (swap !== null && swap >= SWAP_THRESHOLD) {
        const detailedSwap = getDetailedSwapInfo();
        let swapDetails = `*Current Swap Usage: ${swap.toFixed(1)}%*\n*Threshold: ${SWAP_THRESHOLD}%*`;
        
        if (detailedSwap) {
            swapDetails += `\n*Swap Breakdown:*\n• Total: ${detailedSwap.total}\n• Used: ${detailedSwap.used}\n• Free: ${detailedSwap.free}`;
        }
        
        alerts.push({
            title: '💾 High Swap Usage Detected',
            value: swapDetails,
            fields: [
                {
                    title: 'Swap Status',
                    value: detailedSwap ? `Used: ${detailedSwap.used} | Free: ${detailedSwap.free}` : 'Swap details unavailable',
                    short: true
                },
                {
                    title: 'Performance Impact',
                    value: 'High swap usage indicates memory pressure and will significantly slow down system performance.',
                    short: false
                }
            ]
        });
    }

    if (alerts.length > 0) {
        const lastAlertTime = getLastAlertTime();
        if (now - lastAlertTime >= ALERT_COOLDOWN) {
            sendSlackAlert(alerts);
        } else {
            console.log('Alert(s) detected, but cooldown still active.');
        }
    } else {
        console.log('System health OK.');
    }
}

if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'YOUR_SLACK_WEBHOOK_URL_HERE') {
    console.error('Please set your Slack webhook URL in the SLACK_WEBHOOK_URL variable');
    process.exit(1);
}

console.log('☀️☀️☀️ System health monitor started');
console.log(`Checking every ${CHECK_INTERVAL / 1000 / 60} minutes`);
console.log(`CPU threshold: ${CPU_THRESHOLD}%`);
console.log(`Memory threshold: ${MEM_THRESHOLD}%`);
console.log(`Swap threshold: ${SWAP_THRESHOLD}%`);
console.log(`Alert cooldown: ${ALERT_COOLDOWN / 1000 / 60} minutes`);

checkSystemHealth();
setInterval(checkSystemHealth, CHECK_INTERVAL);

process.on('SIGINT', () => {
    console.log('\nSystem health monitor stopped');
    process.exit(0);
});

// Export functions for testing
module.exports = {
    getCpuUsage,
    getTopCpuProcesses,
    getMemUsage,
    getDetailedMemoryInfo,
    getTopMemoryProcesses,
    getSwapUsage,
    getDetailedSwapInfo,
    getSystemLoad,
    getUptime,
    getDiskUsage,
    formatProcessList,
    checkSystemHealth,
    sendSlackAlert
};