/**
============================================================
    Goal: System Health Monitor for Linux Servers
============================================================
    Why:
        - Proactively detect and alert on system resource issues (CPU, memory, swap, disk)
        - Prevent downtime and performance degradation by notifying admins via Slack
        - Provide actionable process details for troubleshooting

    What:
        - Periodically checks system health metrics
        - Sends Slack alerts when thresholds are exceeded
        - Includes top resource-consuming processes in alerts
        - Implements cooldowns and duration checks to avoid alert spam
        - Exports functions for testing and extension
============================================================
*/

const cp = require('child_process');
const axios = require('axios');
const fs = require('fs');

const {
    loadConfig,
    createAlertTracker,
    validateWebhook,
    setupGracefulShutdown,
} = require('./lib/common');
const { getLogger } = require('./lib/logger');

const logger = getLogger('system-health-monitor');

// =====================
// Configuration Section
// =====================
const config = loadConfig();

const SLACK_WEBHOOK_URL          = config.SLACK_WEBHOOK_URL;
const CPU_THRESHOLD              = config.CPU_THRESHOLD;
const MEM_THRESHOLD              = config.MEM_THRESHOLD;
const SWAP_THRESHOLD             = config.SWAP_THRESHOLD;
const CPU_OVER_THRESHOLD_DURATION = config.CPU_OVER_THRESHOLD_DURATION;
const CHECK_INTERVAL             = config.CHECK_INTERVAL;
const ALERT_COOLDOWN             = config.ALERT_COOLDOWN;

// Alert cooldown tracking (persisted to file)
const alertTracker = createAlertTracker('.last_health_alert', logger);


// Get current CPU usage as a percentage
function getCpuUsage() {
    try {
        // Uses 'top' and 'awk' to sum user and system CPU usage
        const output = cp.execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        logger.error({ err: error }, 'Error getting CPU usage');
        return null;
    }
}


// Get top N processes by CPU usage
function getTopCpuProcesses(limit = 5) {
    try {
        // Uses 'ps aux' sorted by CPU, returns process details
        const output = cp.execSync(`ps aux --sort=-%cpu | head -${limit + 1} | tail -${limit}`, { encoding: 'utf8' });
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
        logger.error({ err: error }, 'Error getting top CPU processes');
        return [];
    }
}


// Get current memory usage as a percentage
function getMemUsage() {
    try {
        // Uses 'free' and 'awk' to calculate memory usage
        const output = cp.execSync("free | grep Mem | awk '{print $3/$2 * 100.0}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        logger.error({ err: error }, 'Error getting memory usage');
        return null;
    }
}


// Get detailed memory info (human-readable)
function getDetailedMemoryInfo() {
    try {
        // Uses 'free -h' for breakdown
        const freeOutput = cp.execSync("free -h", { encoding: 'utf8' });
        const lines = freeOutput.split('\n');
        if (lines.length < 2) return null;
        const memLine = lines[1];
        const parts = memLine.trim().split(/\s+/);
        if (parts.length < 7) return null;
        return {
            total: parts[1],
            used: parts[2],
            free: parts[3],
            shared: parts[4],
            cache: parts[5],
            available: parts[6]
        };
    } catch (error) {
        logger.error({ err: error }, 'Error getting detailed memory info');
        return null;
    }
}


// Get top N processes by memory usage
function getTopMemoryProcesses(limit = 5) {
    try {
        // Uses 'ps aux' sorted by memory, returns process details
        const output = cp.execSync(`ps aux --sort=-%mem | head -${limit + 1} | tail -${limit}`, { encoding: 'utf8' });
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
        logger.error({ err: error }, 'Error getting top memory processes');
        return [];
    }
}


// Get current swap usage as a percentage
function getSwapUsage() {
    try {
        // Uses 'free' and 'awk' to calculate swap usage
        const output = cp.execSync("free | grep Swap | awk '{if ($2==0) print 0; else print $3/$2 * 100.0}'", { encoding: 'utf8' });
        return parseFloat(output.trim());
    } catch (error) {
        logger.error({ err: error }, 'Error getting swap usage');
        return null;
    }
}


// Get detailed swap info (human-readable)
function getDetailedSwapInfo() {
    try {
        // Uses 'free -h' for breakdown
        const freeOutput = cp.execSync("free -h", { encoding: 'utf8' });
        const lines = freeOutput.split('\n');
        if (lines.length < 3) return null;
        const swapLine = lines[2];
        const parts = swapLine.trim().split(/\s+/);
        if (parts.length < 4) return null;
        return {
            total: parts[1],
            used: parts[2],
            free: parts[3]
        };
    } catch (error) {
        logger.error({ err: error }, 'Error getting detailed swap info');
        return null;
    }
}


// Get system load averages (1, 5, 15 min)
function getSystemLoad() {
    try {
        // Uses 'uptime' and regex to extract load averages
        const output = cp.execSync("uptime", { encoding: 'utf8' });
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
        logger.error({ err: error }, 'Error getting system load');
        return null;
    }
}


// Get system uptime (pretty format)
function getUptime() {
    try {
        const output = cp.execSync("uptime -p", { encoding: 'utf8' });
        return output.trim();
    } catch (error) {
        logger.error({ err: error }, 'Error getting uptime');
        return null;
    }
}


// Get root disk usage info
function getDiskUsage() {
    try {
        // Uses 'df -h' for root filesystem
        const output = cp.execSync("df -h / | tail -1", { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        if (parts.length < 6) return null;
        return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usagePercent: parts[4],
            mountpoint: parts[5]
        };
    } catch (error) {
        logger.error({ err: error }, 'Error getting disk usage');
        return null;
    }
}


// Get open file descriptors count and limit
function getOpenFileDescriptors() {
    try {
        if (!fs.existsSync('/proc/sys/fs/file-nr')) {
            return null;
        }
        const fileNrContent = fs.readFileSync('/proc/sys/fs/file-nr', 'utf8');
        const parts = fileNrContent.trim().split(/\s+/);
        if (parts.length >= 3) {
            const allocated = parseInt(parts[0], 10);
            const maximum = parseInt(parts[2], 10);
            const usagePercent = maximum > 0 ? (allocated / maximum * 100) : 0;
            return {
                allocated,
                maximum,
                usagePercent: parseFloat(usagePercent.toFixed(2))
            };
        }
        return null;
    } catch (error) {
        logger.error({ err: error }, 'Error getting open file descriptors');
        return null;
    }
}


// Get network bandwidth usage (bytes/sec)
function getNetworkBandwidth() {
    try {
        if (!fs.existsSync('/proc/net/dev')) {
            return null;
        }
        const devContent = fs.readFileSync('/proc/net/dev', 'utf8');
        const lines = devContent.split('\n');
        
        let totalRx = 0;
        let totalTx = 0;
        
        for (const line of lines) {
            if (!line.includes(':')) continue;
            const parts = line.split(':');
            const interfaceName = parts[0].trim();
            // Skip loopback interface
            if (interfaceName === 'lo') continue;
            
            const metrics = parts[1].trim().split(/\s+/);
            if (metrics.length >= 9) {
                totalRx += parseInt(metrics[0], 10);
                totalTx += parseInt(metrics[8], 10);
            }
        }
        
        const now = Date.now();
        const activeSample = (typeof global !== 'undefined' && global.lastNetworkSample !== undefined)
            ? global.lastNetworkSample
            : lastNetworkSample;

        if (!activeSample) {
            const newSample = { timestamp: now, rxBytes: totalRx, txBytes: totalTx };
            if (typeof global !== 'undefined' && global.lastNetworkSample !== undefined) {
                global.lastNetworkSample = newSample;
            } else {
                lastNetworkSample = newSample;
            }
            return { rxBytesPerSec: 0, txBytesPerSec: 0 };
        }
        
        const elapsedSec = (now - activeSample.timestamp) / 1000;
        if (elapsedSec <= 0) {
            return { rxBytesPerSec: 0, txBytesPerSec: 0 };
        }
        
        const rxBytesPerSec = Math.max(0, (totalRx - activeSample.rxBytes) / elapsedSec);
        const txBytesPerSec = Math.max(0, (totalTx - activeSample.txBytes) / elapsedSec);
        
        const newSample = { timestamp: now, rxBytes: totalRx, txBytes: totalTx };
        if (typeof global !== 'undefined' && global.lastNetworkSample !== undefined) {
            global.lastNetworkSample = newSample;
        } else {
            lastNetworkSample = newSample;
        }
        
        return {
            rxBytesPerSec: parseFloat(rxBytesPerSec.toFixed(2)),
            txBytesPerSec: parseFloat(txBytesPerSec.toFixed(2))
        };
    } catch (error) {
        logger.error({ err: error }, 'Error getting network bandwidth');
        return null;
    }
}


// Get disk I/O metrics (reads/writes per sec)
function getDiskIO() {
    try {
        if (!fs.existsSync('/proc/diskstats')) {
            return null;
        }
        const statsContent = fs.readFileSync('/proc/diskstats', 'utf8');
        const lines = statsContent.split('\n');
        
        let totalReads = 0;
        let totalWrites = 0;
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 14) {
                const deviceName = parts[2];
                // Only track actual block devices: sdX, nvmeXnX, vdX, hdX
                if (/^(sd[a-z]|nvme\d+n\d+|vd[a-z]|hd[a-z])$/.test(deviceName)) {
                    totalReads += parseInt(parts[3], 10);
                    totalWrites += parseInt(parts[7], 10);
                }
            }
        }
        
        const now = Date.now();
        const activeSample = (typeof global !== 'undefined' && global.lastDiskIOSample !== undefined)
            ? global.lastDiskIOSample
            : lastDiskIOSample;

        if (!activeSample) {
            const newSample = { timestamp: now, reads: totalReads, writes: totalWrites };
            if (typeof global !== 'undefined' && global.lastDiskIOSample !== undefined) {
                global.lastDiskIOSample = newSample;
            } else {
                lastDiskIOSample = newSample;
            }
            return { readOpsPerSec: 0, writeOpsPerSec: 0 };
        }
        
        const elapsedSec = (now - activeSample.timestamp) / 1000;
        if (elapsedSec <= 0) {
            return { readOpsPerSec: 0, writeOpsPerSec: 0 };
        }
        
        const readOpsPerSec = Math.max(0, (totalReads - activeSample.reads) / elapsedSec);
        const writeOpsPerSec = Math.max(0, (totalWrites - activeSample.writes) / elapsedSec);
        
        const newSample = { timestamp: now, reads: totalReads, writes: totalWrites };
        if (typeof global !== 'undefined' && global.lastDiskIOSample !== undefined) {
            global.lastDiskIOSample = newSample;
        } else {
            lastDiskIOSample = newSample;
        }
        
        return {
            readOpsPerSec: parseFloat(readOpsPerSec.toFixed(2)),
            writeOpsPerSec: parseFloat(writeOpsPerSec.toFixed(2))
        };
    } catch (error) {
        logger.error({ err: error }, 'Error getting disk I/O');
        return null;
    }
}


// Format process list for Slack message
function formatProcessList(processes, type) {
    if (!processes || processes.length === 0) return 'No processes found';
    return processes.map((proc, index) => {
        const shortCommand = proc.command.length > 50 ? proc.command.substring(0, 47) + '...' : proc.command;
        return `${index + 1}. *${shortCommand}*\n   PID: ${proc.pid} | User: ${proc.user} | ${type === 'cpu' ? `CPU: ${proc.cpu}%` : `Memory: ${proc.mem}%`} | RSS: ${proc.rss}`;
    }).join('\n');
}


// Send alert(s) to Slack channel via webhook
async function sendSlackAlert(alerts) {
    const hostname = require('os').hostname();
    const uptime = getUptime();
    const load = getSystemLoad();
    const disk = getDiskUsage();
    const openFiles = getOpenFileDescriptors();
    const netBandwidth = getNetworkBandwidth();
    const diskIO = getDiskIO();

    // Compose main message text with system info
    let messageText = `🚨 *System Health Alert on ${hostname}*`;
    if (uptime) messageText += `\n⏰ Uptime: ${uptime}`;
    if (load) messageText += `\n📊 Load: ${load['1min']} (1m), ${load['5min']} (5m), ${load['15min']} (15m)`;
    if (disk) messageText += `\n💾 Root Disk: ${disk.used}/${disk.size} (${disk.usagePercent})`;
    if (openFiles) {
        messageText += `\n📂 Open Files: ${openFiles.allocated} / ${openFiles.maximum} (${openFiles.usagePercent}%)`;
    }
    if (netBandwidth) {
        const formatSpeed = (bytes) => {
            if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
            if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB/s`;
            return `${bytes.toFixed(0)} B/s`;
        };
        messageText += `\n🌐 Net Bandwidth: RX: ${formatSpeed(netBandwidth.rxBytesPerSec)} | TX: ${formatSpeed(netBandwidth.txBytesPerSec)}`;
    }
    if (diskIO) {
        messageText += `\n💽 Disk I/O: Read: ${diskIO.readOpsPerSec} ops/s | Write: ${diskIO.writeOpsPerSec} ops/s`;
    }

    // Format each alert as a Slack attachment
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
        logger.info({ alertCount: alerts.length, alertTitles: alerts.map(a => a.title) }, 'Slack health alert sent');
        alertTracker.setLastAlertTime();
    } catch (error) {
        logger.error({ err: error, alertCount: alerts.length }, 'Error sending Slack message');
    }
}


// Track when CPU first exceeded threshold
let cpuOverThresholdSince = null;

// State variables for network and disk I/O tracking
let lastNetworkSample = null;
let lastDiskIOSample = null;


/*
  Main health check logic:
    - Checks CPU, memory, swap usage
    - If thresholds exceeded, builds alert(s)
    - For CPU, only alerts if high for >5 min
    - Alerts include top processes and system breakdowns
    - Alerts sent to Slack if cooldown expired
*/
function checkSystemHealth() {
    const alerts = [];
    const cpu = getCpuUsage();
    const mem = getMemUsage();
    const swap = getSwapUsage();
    const now = Date.now();

    // CPU: Only alert if over threshold for more than the configured duration
    if (cpu !== null && cpu >= CPU_THRESHOLD) {
        const thresholdSince = (typeof global !== 'undefined' && global.cpuOverThresholdSince !== undefined) 
            ? global.cpuOverThresholdSince 
            : cpuOverThresholdSince;

        if (!thresholdSince) {
            if (typeof global !== 'undefined' && global.cpuOverThresholdSince !== undefined) {
                global.cpuOverThresholdSince = now;
            } else {
                cpuOverThresholdSince = now;
            }
        }

        const activeSince = (typeof global !== 'undefined' && global.cpuOverThresholdSince !== undefined) 
            ? global.cpuOverThresholdSince 
            : cpuOverThresholdSince;

        if (now - activeSince >= CPU_OVER_THRESHOLD_DURATION) {
            const topProcesses = getTopCpuProcesses(8);
            const processDetails = formatProcessList(topProcesses, 'cpu');
            alerts.push({
                title: '🚀 High CPU Usage Detected',
                value: `*Current CPU Usage: ${cpu.toFixed(1)}%*\n*Threshold: ${CPU_THRESHOLD}%*\n*Duration: ${((now - activeSince) / 60000).toFixed(1)} minutes*\n\n*Top CPU Processes:*\n${processDetails}`,
                fields: [
                    {
                        title: 'System Impact',
                        value: 'High CPU usage can cause system slowdown, increased response times, and potential service degradation.',
                        short: false
                    }
                ]
            });
        } else {
            logger.info({
                cpu,
                cpuThreshold: CPU_THRESHOLD,
                activeMinutes: ((now - activeSince) / 60000).toFixed(1),
            }, 'CPU over threshold, but duration not met yet');
        }
    } else {
        if (typeof global !== 'undefined' && global.cpuOverThresholdSince !== undefined) {
            global.cpuOverThresholdSince = null;
        } else {
            cpuOverThresholdSince = null;
        }
    }

    // Memory: Alert if over threshold
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

    // Swap: Alert if over threshold
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

    // Send alerts if any, respecting cooldown
    if (alerts.length > 0) {
        const lastAlertTime = alertTracker.getLastAlertTime();
        if (now - lastAlertTime >= ALERT_COOLDOWN) {
            sendSlackAlert(alerts);
        } else {
            logger.info({ alertCount: alerts.length }, 'Alert(s) detected, but cooldown still active');
        }
    } else {
        logger.info({ cpu, mem, swap }, 'System health OK');
    }
}


// =====================
// Startup
// =====================
if (require.main === module) {
    validateWebhook(SLACK_WEBHOOK_URL);

    logger.info({
        checkIntervalMinutes: CHECK_INTERVAL / 1000 / 60,
        cpuThresholdPercent: CPU_THRESHOLD,
        memoryThresholdPercent: MEM_THRESHOLD,
        swapThresholdPercent: SWAP_THRESHOLD,
        alertCooldownMinutes: ALERT_COOLDOWN / 1000 / 60,
    }, 'System health monitor started');

    // Initial health check and schedule periodic checks
    checkSystemHealth();
    setInterval(checkSystemHealth, CHECK_INTERVAL);

    setupGracefulShutdown('System health monitor', logger);
}


// Export functions for testing and extension
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
    getOpenFileDescriptors,
    getNetworkBandwidth,
    getDiskIO,
    formatProcessList,
    checkSystemHealth,
    sendSlackAlert
};