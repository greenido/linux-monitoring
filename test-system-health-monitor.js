/**
============================================================
    Goal: Automated Tests for System Health Monitor
============================================================
    Why:
        - Ensure reliability and correctness of health monitoring logic
        - Catch regressions and edge cases before deployment
        - Provide confidence for refactoring and extension

    What:
        - Mocks system commands, file operations, and Slack API
        - Tests all exported functions from system-health-monitor.js
        - Covers normal, error, and edge cases for CPU, memory, swap, disk, and alerting
        - Uses Jest for mocking and assertions
============================================================
*/
jest.mock('axios');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Mock axios for Slack alert testing
const axios = require('axios');
jest.mock('axios');

// Import functions to test from main monitor
const {
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
} = require('./system-health-monitor');


// =====================
// Test Suite for Health Monitor
// =====================
describe('System Health Monitor Tests', () => {
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Reset all mocks and global state before each test
        jest.clearAllMocks();

        // Mock execSync to avoid real system calls, return canned data
        mockExecSync = jest.spyOn(require('child_process'), 'execSync').mockImplementation((command, options) => {
            // ...existing code...
            // (see below for command-specific mock returns)
            if (command.includes("top -bn1 | grep 'Cpu(s)'")) {
                return '85.5';
            } else if (command.includes("free | grep Mem")) {
                return '75.3';
            } else if (command.includes("free | grep Swap")) {
                return '35.7';
            } else if (command.includes("free -h")) {
                return `              total        used        free      shared  buff/cache   available\nMem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi\nSwap:         8.0Gi       1.2Gi       6.8Gi`;
            } else if (command.includes("ps aux --sort=-%cpu")) {
                return `user1 1234 25.5 10.2 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js\nuser2 5678 15.2 5.1 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py\nuser3 9012 8.7 3.2 456789 12345 pts/2 S+ 10:32 0:01 /usr/bin/bash`;
            } else if (command.includes("ps aux --sort=-%mem")) {
                return `user1 1234 5.2 25.5 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js\nuser2 5678 3.1 15.2 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
            } else if (command.includes("uptime")) {
                return ' 10:45:30 up 2 days, 3:45, 2 users, load average: 1.25, 1.15, 0.95';
            } else if (command.includes("uptime -p")) {
                return 'up 2 days, 3 hours, 45 minutes';
            } else if (command.includes("df -h /")) {
                return '/dev/sda1       100G   75G   20G  79% /';
            }
            return '';
        });

        // Mock fs for alert file operations
        mockFs = {
            existsSync: jest.fn(),
            readFileSync: jest.fn(),
            writeFileSync: jest.fn()
        };
        jest.spyOn(fs, 'existsSync').mockImplementation(mockFs.existsSync);
        jest.spyOn(fs, 'readFileSync').mockImplementation(mockFs.readFileSync);
        jest.spyOn(fs, 'writeFileSync').mockImplementation(mockFs.writeFileSync);

        // Mock axios for Slack API
        axios.post.mockResolvedValue({ status: 200 });

        // Reset global CPU threshold timer
        global.cpuOverThresholdSince = null;
    });

    afterEach(() => {
        // Restore all mocks after each test
        jest.restoreAllMocks();
    });


    // =====================
    // CPU Usage Tests
    // =====================
    describe('CPU Usage Tests', () => {
        test('should get CPU usage correctly', () => {
            const result = getCpuUsage();
            // Should parse mocked value
            expect(result).toBe(85.5);
            expect(mockExecSync).toHaveBeenCalledWith(
                "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'",
                { encoding: 'utf8' }
            );
        });

        test('should handle CPU usage error gracefully', () => {
            // Simulate command failure
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Command failed');
            });
            const result = getCpuUsage();
            expect(result).toBeNull();
        });

        test('should get top CPU processes correctly', () => {
            const result = getTopCpuProcesses(3);
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                user: 'user1',
                pid: '1234',
                cpu: 25.5,
                mem: 10.2,
                vsz: '1234567',
                rss: '89012',
                tty: 'pts/0',
                stat: 'S+',
                start: '10:30',
                time: '0:05',
                command: '/usr/bin/node app.js'
            });
        });

        test('should handle malformed ps output gracefully', () => {
            // Simulate malformed output
            mockExecSync.mockImplementationOnce(() => 'invalid output format');
            const result = getTopCpuProcesses(3);
            expect(result).toEqual([]);
        });
    });


    // =====================
    // Memory Usage Tests
    // =====================
    describe('Memory Usage Tests', () => {
        test('should get memory usage correctly', () => {
            const result = getMemUsage();
            expect(result).toBe(75.3);
            expect(mockExecSync).toHaveBeenCalledWith(
                "free | grep Mem | awk '{print $3/$2 * 100.0}'",
                { encoding: 'utf8' }
            );
        });

        test('should get detailed memory info correctly', () => {
            const result = getDetailedMemoryInfo();
            expect(result).toEqual({
                total: '15Gi',
                used: '8.2Gi',
                free: '2.1Gi',
                shared: '0.0Ki',
                cache: '4.7Gi',
                available: '6.8Gi'
            });
        });

        test('should get top memory processes correctly', () => {
            const result = getTopMemoryProcesses(2);
            expect(result).toHaveLength(2);
            expect(result[0].mem).toBe(25.5);
            expect(result[1].mem).toBe(15.2);
        });
    });


    // =====================
    // Swap Usage Tests
    // =====================
    describe('Swap Usage Tests', () => {
        test('should get swap usage correctly', () => {
            const result = getSwapUsage();
            expect(result).toBe(35.7);
        });

        test('should handle zero swap correctly', () => {
            mockExecSync.mockImplementationOnce(() => '0');
            const result = getSwapUsage();
            expect(result).toBe(0);
        });

        test('should get detailed swap info correctly', () => {
            const result = getDetailedSwapInfo();
            expect(result).toEqual({
                total: '8.0Gi',
                used: '1.2Gi',
                free: '6.8Gi'
            });
        });
    });


    // =====================
    // System Information Tests
    // =====================
    describe('System Information Tests', () => {
        test('should get system load correctly', () => {
            const result = getSystemLoad();
            expect(result).toEqual({
                '1min': 1.25,
                '5min': 1.15,
                '15min': 0.95
            });
        });

        test('should get uptime correctly', () => {
            const result = getUptime();
            expect(result).toBe('up 2 days, 3 hours, 45 minutes');
        });

        test('should get disk usage correctly', () => {
            const result = getDiskUsage();
            expect(result).toEqual({
                filesystem: '/dev/sda1',
                size: '100G',
                used: '75G',
                available: '20G',
                usagePercent: '79%',
                mountpoint: '/'
            });
        });
    });


    // =====================
    // Process List Formatting Tests
    // =====================
    describe('Process List Formatting Tests', () => {
        test('should format process list correctly', () => {
            const processes = [
                {
                    user: 'user1',
                    pid: '1234',
                    cpu: 25.5,
                    mem: 10.2,
                    rss: '89012',
                    command: '/usr/bin/node app.js'
                },
                {
                    user: 'user2',
                    pid: '5678',
                    cpu: 15.2,
                    mem: 5.1,
                    rss: '32109',
                    command: '/usr/bin/python script.py'
                }
            ];
            const result = formatProcessList(processes, 'cpu');
            expect(result).toContain('1. */usr/bin/node app.js*');
            expect(result).toContain('PID: 1234 | User: user1 | CPU: 25.5%');
            expect(result).toContain('2. */usr/bin/python script.py*');
            expect(result).toContain('PID: 5678 | User: user2 | CPU: 15.2%');
        });

        test('should truncate long command names', () => {
            const processes = [
                {
                    user: 'user1',
                    pid: '1234',
                    cpu: 25.5,
                    mem: 10.2,
                    rss: '89012',
                    command: '/usr/bin/very/long/path/to/a/very/long/command/name/that/exceeds/fifty/characters'
                }
            ];
            const result = formatProcessList(processes, 'cpu');
            expect(result).toContain('1. */usr/bin/very/long/path/to/a/very/long/command/...*');
        });

        test('should handle empty process list', () => {
            const result = formatProcessList([], 'cpu');
            expect(result).toBe('No processes found');
        });

        test('should handle null process list', () => {
            const result = formatProcessList(null, 'cpu');
            expect(result).toBe('No processes found');
        });
    });


    // =====================
    // Alert Cooldown Tests
    // =====================
    describe('Alert Cooldown Tests', () => {
        test('should respect alert cooldown period', () => {
            const now = Date.now();
            const lastAlertTime = now - (15 * 60 * 1000); // 15 minutes ago
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(lastAlertTime.toString());
            mockExecSync.mockReturnValue('95.0');
            const result = checkSystemHealth();
            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should send alert after cooldown period', () => {
            const now = Date.now();
            const lastAlertTime = now - (35 * 60 * 1000); // 35 minutes ago (cooldown is 30 min)
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(lastAlertTime.toString());
            mockExecSync.mockReturnValue('95.0');
            const result = checkSystemHealth();
            expect(axios.post).toHaveBeenCalled();
        });
    });


    // =====================
    // CPU Threshold Duration Tests
    // =====================
    describe('CPU Threshold Duration Tests', () => {
        test('should not alert immediately when CPU goes over threshold', () => {
            mockExecSync.mockReturnValue('95.0');
            const result = checkSystemHealth();
            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should alert after CPU stays over threshold for required duration', () => {
            const now = Date.now();
            const overThresholdSince = now - (6 * 60 * 1000); // 6 minutes ago
            mockExecSync.mockReturnValue('95.0');
            global.cpuOverThresholdSince = overThresholdSince;
            const result = checkSystemHealth();
            expect(axios.post).toHaveBeenCalled();
        });
    });


    // =====================
    // Slack Alert Tests
    // =====================
    describe('Slack Alert Tests', () => {
        test('should send Slack alert with correct format', async () => {
            const alerts = [
                {
                    title: '🚀 High CPU Usage Detected',
                    value: 'CPU usage is 95%',
                    fields: [
                        {
                            title: 'System Impact',
                            value: 'High CPU usage can cause slowdown',
                            short: false
                        }
                    ]
                }
            ];
            // Mock system info for Slack message
            mockExecSync
                .mockReturnValueOnce('up 2 days, 3 hours') // uptime
                .mockReturnValueOnce(' 10:45:30 up 2 days, 3:45, 2 users, load average: 1.25, 1.15, 0.95') // load
                .mockReturnValueOnce('/dev/sda1       100G   75G   20G  79% /'); // disk
            await sendSlackAlert(alerts);
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    text: expect.stringContaining('🚨 *System Health Alert on'),
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            color: 'danger',
                            title: '🚀 High CPU Usage Detected',
                            text: 'CPU usage is 95%'
                        })
                    ])
                })
            );
        });

        test('should handle Slack API errors gracefully', async () => {
            axios.post.mockRejectedValue(new Error('Slack API error'));
            const alerts = [
                {
                    title: 'Test Alert',
                    value: 'Test value'
                }
            ];
            await expect(sendSlackAlert(alerts)).resolves.not.toThrow();
        });
    });


    // =====================
    // Integration Tests
    // =====================
    describe('Integration Tests', () => {
        test('should trigger CPU alert with full context', () => {
            const now = Date.now();
            const overThresholdSince = now - (6 * 60 * 1000);
            // Mock all the data needed for a CPU alert
            mockExecSync
                .mockReturnValueOnce('95.0') // CPU usage
                .mockReturnValueOnce(`user1 1234 25.5 10.2 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js\nuser2 5678 15.2 5.1 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`) // top processes
                .mockReturnValueOnce('75.0') // memory usage (below threshold)
                .mockReturnValueOnce('25.0'); // swap usage (below threshold)
            global.cpuOverThresholdSince = overThresholdSince;
            const result = checkSystemHealth();
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            title: '🚀 High CPU Usage Detected',
                            text: expect.stringContaining('Current CPU Usage: 95.0%')
                        })
                    ])
                })
            );
        });

        test('should trigger memory alert with full context', () => {
            // Mock memory alert scenario
            mockExecSync
                .mockReturnValueOnce('75.0') // CPU usage (below threshold)
                .mockReturnValueOnce('95.0') // memory usage
                .mockReturnValueOnce(`              total        used        free      shared  buff/cache   available\nMem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi\nSwap:         8.0Gi       1.2Gi       6.8Gi`) // detailed memory
                .mockReturnValueOnce(`user1 1234 5.2 25.5 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js\nuser2 5678 3.1 15.2 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`) // top memory processes
                .mockReturnValueOnce('25.0'); // swap usage (below threshold)
            const result = checkSystemHealth();
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            title: '🧠 High Memory Usage Detected',
                            text: expect.stringContaining('Current Memory Usage: 95.0%')
                        })
                    ])
                })
            );
        });

        test('should trigger swap alert with full context', () => {
            // Mock swap alert scenario
            mockExecSync
                .mockReturnValueOnce('75.0') // CPU usage (below threshold)
                .mockReturnValueOnce('75.0') // memory usage (below threshold)
                .mockReturnValueOnce('75.0') // swap usage
                .mockReturnValueOnce(`              total        used        free      shared  buff/cache   available\nMem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi\nSwap:         8.0Gi       6.0Gi       2.0Gi`); // detailed swap
            const result = checkSystemHealth();
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            title: '💾 High Swap Usage Detected',
                            text: expect.stringContaining('Current Swap Usage: 75.0%')
                        })
                    ])
                })
            );
        });
    });


    // =====================
    // Error Handling Tests
    // =====================
    describe('Error Handling Tests', () => {
        test('should handle all command failures gracefully', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Command failed');
            });
            // All functions should return null or empty arrays on error
            expect(getCpuUsage()).toBeNull();
            expect(getTopCpuProcesses()).toEqual([]);
            expect(getMemUsage()).toBeNull();
            expect(getDetailedMemoryInfo()).toBeNull();
            expect(getTopMemoryProcesses()).toEqual([]);
            expect(getSwapUsage()).toBeNull();
            expect(getDetailedSwapInfo()).toBeNull();
            expect(getSystemLoad()).toBeNull();
            expect(getUptime()).toBeNull();
            expect(getDiskUsage()).toBeNull();
        });

        test('should handle malformed command output gracefully', () => {
            mockExecSync.mockReturnValue('malformed output');
            expect(getTopCpuProcesses()).toEqual([]);
            expect(getTopMemoryProcesses()).toEqual([]);
            expect(getDetailedMemoryInfo()).toBeNull();
            expect(getDetailedSwapInfo()).toBeNull();
            expect(getSystemLoad()).toBeNull();
            expect(getDiskUsage()).toBeNull();
        });
    });
});


// Run tests if this file is executed directly
if (require.main === module) {
    console.log('Running System Health Monitor Tests...');
    // This would typically use a test runner like Jest
    // For now, we'll just export the test functions
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
        formatProcessList
    };
}