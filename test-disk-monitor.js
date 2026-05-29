/**
============================================================
    Goal: Automated Tests for Disk Monitor
============================================================
    Why:
        - Ensure reliability and correctness of disk monitoring logic
        - Catch regressions and edge cases before deployment
        - Provide confidence for refactoring and extension

    What:
        - Mocks system commands, file operations, and Slack API
        - Tests all exported functions from disk-monitor.js
        - Covers normal, error, and cooldown cases for disk usage monitoring
        - Uses Jest for mocking and assertions
============================================================
*/

jest.mock('axios');

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import functions to test
const {
    getDiskUsage,
    sendSlackAlert,
    checkDiskUsage
} = require('./disk-monitor');

describe('Disk Monitor Tests', () => {
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Reset all mocks and global state before each test
        jest.clearAllMocks();

        // Mock execSync to avoid real system calls
        mockExecSync = jest.spyOn(cp, 'execSync').mockImplementation((command, options) => {
            if (command.includes("df -h /")) {
                return '85%';
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
    });

    afterEach(() => {
        // Restore all mocks after each test
        jest.restoreAllMocks();
    });

    // =====================
    // Disk Usage Parsing Tests
    // =====================
    describe('getDiskUsage', () => {
        test('should parse disk usage percentage correctly', () => {
            const result = getDiskUsage();
            expect(result).toBe(85);
            expect(mockExecSync).toHaveBeenCalledWith(
                "df -h / | awk 'NR==2 {print $5}' | sed 's/%//'",
                { encoding: 'utf8' }
            );
        });

        test('should handle execSync failure gracefully by returning null', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('df failed');
            });
            const result = getDiskUsage();
            expect(result).toBeNull();
        });
    });

    // =====================
    // Slack Alert Tests
    // =====================
    describe('sendSlackAlert', () => {
        test('should send correct JSON payload to Slack webhook', async () => {
            mockFs.writeFileSync.mockImplementation(() => {});

            await sendSlackAlert(85);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    text: '🚨 Disk Usage Alert',
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            color: 'danger',
                            fields: expect.arrayContaining([
                                expect.objectContaining({ title: 'Disk Usage', value: '85%' }),
                                expect.objectContaining({ title: 'Threshold', value: '80%' })
                            ])
                        })
                    ])
                })
            );
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.last_disk_alert'),
                expect.any(String)
            );
        });

        test('should handle Slack API error gracefully without throwing', async () => {
            axios.post.mockRejectedValueOnce(new Error('Network error'));
            mockFs.writeFileSync.mockImplementation(() => {});

            await expect(sendSlackAlert(85)).resolves.not.toThrow();
        });
    });

    // =====================
    // Alerting and Cooldown Logic
    // =====================
    describe('checkDiskUsage', () => {
        test('should do nothing if disk usage is below threshold', () => {
            mockExecSync.mockReturnValue('75%');
            checkDiskUsage();
            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should trigger alert if usage is over threshold and cooldown expired', () => {
            mockExecSync.mockReturnValue('85%');
            const now = Date.now();
            const lastAlertTime = now - (35 * 60 * 1000); // 35 minutes ago (cooldown is 30 min)

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(lastAlertTime.toString());

            checkDiskUsage();

            expect(axios.post).toHaveBeenCalled();
        });

        test('should trigger alert if no previous alert has been recorded', () => {
            mockExecSync.mockReturnValue('85%');
            mockFs.existsSync.mockReturnValue(false); // No file recorded

            checkDiskUsage();

            expect(axios.post).toHaveBeenCalled();
        });

        test('should respect cooldown and NOT alert if threshold exceeded too soon', () => {
            mockExecSync.mockReturnValue('85%');
            const now = Date.now();
            const lastAlertTime = now - (15 * 60 * 1000); // 15 minutes ago (cooldown is 30 min)

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(lastAlertTime.toString());

            checkDiskUsage();

            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should handle disk usage parsing failure gracefully', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Command failed');
            });
            checkDiskUsage();
            expect(axios.post).not.toHaveBeenCalled();
        });
    });
});
