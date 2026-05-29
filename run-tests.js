/**
 * Standalone Test Runner for System Health Monitor
 * ------------------------------------------------
 * Allows running all core tests without Jest or external dependencies.
 * - Used for quick validation and CI environments.
 * - Mocks system calls and file operations for safe testing.
 * - See TEST_README.md for more details.
 *
 * How to use:
 *  - Run: `node run-tests.js`
 *  - All main exported functions from system-health-monitor.js are tested
 *  - Output shows pass/fail and error details
 */

const cp = require('child_process');
const fs = require('fs');
const { getLogger } = require('./lib/logger');

const logger = getLogger('run-tests');

// Set up mocks BEFORE importing system-health-monitor so that destructuring uses the mocked functions
const originalExecSync = cp.execSync;
const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;

let mockExecSyncReturnValues = [];
let mockExecSyncCallCount = 0;
let mockFsExistsSync = false;
let mockFsReadFileSync = '0';
let mockFsWriteFileSyncCalled = false;

function mockExecSyncFn(command, options) {
    mockExecSyncCallCount++;
    if (mockExecSyncReturnValues.length > 0) {
        const val = mockExecSyncReturnValues.shift();
        if (val instanceof Error) {
            throw val;
        }
        return val;
    }
    
    // Provide safe, realistic mocked system outputs as defaults
    if (command.includes("top -bn1 | grep 'Cpu(s)'")) {
        return '85.5';
    } else if (command.includes("free | grep Mem")) {
        return '75.3';
    } else if (command.includes("free | grep Swap")) {
        return '35.7';
    } else if (command.includes("free -h")) {
        return `              total        used        free      shared  buff/cache   available
Mem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi
Swap:         8.0Gi       1.2Gi       6.8Gi`;
    } else if (command.includes("ps aux --sort=-%cpu")) {
        return `user1 1234 25.5 10.2 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 15.2 5.1 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    } else if (command.includes("ps aux --sort=-%mem")) {
        return `user1 1234 5.2 25.5 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 3.1 15.2 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    } else if (command.includes("uptime -p")) {
        return 'up 2 days, 3 hours, 45 minutes';
    } else if (command.includes("uptime")) {
        return ' 10:45:30 up 2 days, 3:45, 2 users, load average: 1.25, 1.15, 0.95';
    } else if (command.includes("df -h /")) {
        return '/dev/sda1       100G   75G   20G  79% /';
    }
    return '';
}

function mockExistsSync(path) {
    if (path.includes('.last_health_alert') || path.includes('.last_disk_alert') || path.includes('.env')) {
        return mockFsExistsSync;
    }
    return originalExistsSync(path);
}

function mockReadFileSync(path, encoding) {
    if (path.includes('.last_health_alert') || path.includes('.last_disk_alert') || path.includes('.env')) {
        return mockFsReadFileSync;
    }
    return originalReadFileSync(path, encoding);
}

function mockWriteFileSync(path, data, options) {
    if (path.includes('.last_health_alert') || path.includes('.last_disk_alert')) {
        mockFsWriteFileSyncCalled = true;
        return;
    }
    return originalWriteFileSync(path, data, options);
}

// Override module properties
cp.execSync = mockExecSyncFn;
fs.existsSync = mockExistsSync;
fs.readFileSync = mockReadFileSync;
fs.writeFileSync = mockWriteFileSync;

function resetMocks() {
    mockExecSyncReturnValues = [];
    mockExecSyncCallCount = 0;
    mockFsExistsSync = false;
    mockFsReadFileSync = '0';
    mockFsWriteFileSyncCalled = false;
}

// Now safely import the functions to test
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
    formatProcessList
} = require('./system-health-monitor');

// Simple test runner for system health monitor
logger.info('Running system health monitor standalone tests');

let testsPassed = 0;
let testsFailed = 0;

function test(name, testFunction) {
    try {
        testFunction();
        logger.info({ testName: name }, 'Test passed');
        testsPassed++;
    } catch (error) {
        logger.error({ testName: name, err: error }, 'Test failed');
        testsFailed++;
    }
}

function expect(value) {
    return {
        toBe: (expected) => {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        },
        toBeNull: () => {
            if (value !== null) {
                throw new Error(`Expected ${value} to be null`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(value) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
            }
        },
        toHaveLength: (expected) => {
            if (value.length !== expected) {
                throw new Error(`Expected array to have length ${expected}, but got ${value.length}`);
            }
        },
        toContain: (expected) => {
            if (!value.includes(expected)) {
                throw new Error(`Expected "${value}" to contain "${expected}"`);
            }
        }
    };
}

// Test CPU Usage
test('getCpuUsage should return correct CPU percentage', () => {
    resetMocks();
    mockExecSyncReturnValues = ['85.5'];
    
    const result = getCpuUsage();
    expect(result).toBe(85.5);
});

test('getCpuUsage should handle errors gracefully', () => {
    resetMocks();
    mockExecSyncReturnValues = [new Error('Command failed')];
    
    const result = getCpuUsage();
    expect(result).toBeNull();
});

// Test Memory Usage
test('getMemUsage should return correct memory percentage', () => {
    resetMocks();
    mockExecSyncReturnValues = ['75.3'];
    
    const result = getMemUsage();
    expect(result).toBe(75.3);
});

test('getDetailedMemoryInfo should parse memory info correctly', () => {
    resetMocks();
    const mockFreeOutput = `              total        used        free      shared  buff/cache   available
Mem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi
Swap:         8.0Gi       1.2Gi       6.8Gi`;
    mockExecSyncReturnValues = [mockFreeOutput];
    
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

// Test Process Lists
test('getTopCpuProcesses should parse process list correctly', () => {
    resetMocks();
    const mockPsOutput = `user1 1234 25.5 10.2 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 15.2 5.1 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    mockExecSyncReturnValues = [mockPsOutput];
    
    const result = getTopCpuProcesses(2);
    expect(result).toHaveLength(2);
    expect(result[0].cpu).toBe(25.5);
    expect(result[0].command).toBe('/usr/bin/node app.js');
});

test('getTopMemoryProcesses should parse memory processes correctly', () => {
    resetMocks();
    const mockPsOutput = `user1 1234 5.2 25.5 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 3.1 15.2 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    mockExecSyncReturnValues = [mockPsOutput];
    
    const result = getTopMemoryProcesses(2);
    expect(result).toHaveLength(2);
    expect(result[0].mem).toBe(25.5);
    expect(result[1].mem).toBe(15.2);
});

// Test Swap Usage
test('getSwapUsage should return correct swap percentage', () => {
    resetMocks();
    mockExecSyncReturnValues = ['35.7'];
    
    const result = getSwapUsage();
    expect(result).toBe(35.7);
});

test('getDetailedSwapInfo should parse swap info correctly', () => {
    resetMocks();
    const mockFreeOutput = `              total        used        free      shared  buff/cache   available
Mem:           15Gi       8.2Gi       2.1Gi       0.0Ki       4.7Gi       6.8Gi
Swap:         8.0Gi       1.2Gi       6.8Gi`;
    mockExecSyncReturnValues = [mockFreeOutput];
    
    const result = getDetailedSwapInfo();
    expect(result).toEqual({
        total: '8.0Gi',
        used: '1.2Gi',
        free: '6.8Gi'
    });
});

// Test System Information
test('getSystemLoad should parse load averages correctly', () => {
    resetMocks();
    const mockUptimeOutput = ' 10:45:30 up 2 days, 3:45, 2 users, load average: 1.25, 1.15, 0.95';
    mockExecSyncReturnValues = [mockUptimeOutput];
    
    const result = getSystemLoad();
    expect(result).toEqual({
        '1min': 1.25,
        '5min': 1.15,
        '15min': 0.95
    });
});

test('getUptime should return uptime string', () => {
    resetMocks();
    const mockUptimeOutput = 'up 2 days, 3 hours, 45 minutes';
    mockExecSyncReturnValues = [mockUptimeOutput];
    
    const result = getUptime();
    expect(result).toBe('up 2 days, 3 hours, 45 minutes');
});

test('getDiskUsage should parse disk usage correctly', () => {
    resetMocks();
    const mockDfOutput = '/dev/sda1       100G   75G   20G  79% /';
    mockExecSyncReturnValues = [mockDfOutput];
    
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

// Test Process List Formatting
test('formatProcessList should format processes correctly', () => {
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

test('formatProcessList should handle empty process list', () => {
    const result = formatProcessList([], 'cpu');
    expect(result).toBe('No processes found');
});

test('formatProcessList should truncate long command names', () => {
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

// Test Error Handling
test('should handle command failures gracefully', () => {
    resetMocks();
    mockExecSyncReturnValues = [
        new Error('Command failed'), // getCpuUsage
        new Error('Command failed'), // getTopCpuProcesses
        new Error('Command failed'), // getMemUsage
        new Error('Command failed'), // getDetailedMemoryInfo
        new Error('Command failed'), // getTopMemoryProcesses
        new Error('Command failed'), // getSwapUsage
        new Error('Command failed'), // getDetailedSwapInfo
        new Error('Command failed'), // getSystemLoad
        new Error('Command failed'), // getUptime
        new Error('Command failed')  // getDiskUsage
    ];
    
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

// Print test results
logger.info({
    testsPassed,
    testsFailed,
    totalTests: testsPassed + testsFailed,
}, 'Standalone test summary');

// Restore original modules
cp.execSync = originalExecSync;
fs.existsSync = originalExistsSync;
fs.readFileSync = originalReadFileSync;
fs.writeFileSync = originalWriteFileSync;

if (testsFailed === 0) {
    logger.info('All standalone tests passed');
    process.exit(0);
} else {
    logger.error({ testsFailed }, 'Some standalone tests failed');
    process.exit(1);
}