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

const { execSync } = require('child_process');
const fs = require('fs');

// Simple test runner for system health monitor
console.log('🧪 Running System Health Monitor Tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, testFunction) {
    try {
        testFunction();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }

function expect(value) {
    return {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        },
        toBeNull: () => {
            if (value !== null) {
                throw new Error(`Expected ${value} to be null`);
            }
        },
        function test(name, testFunction) {
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
                throw new Error(`Expected ${value} to contain ${expected}`);
            }
        }
    };

// Mock execSync for testing
const originalExecSync = require('child_process').execSync;
let mockExecSyncReturnValues = [];
let mockExecSyncCallCount = 0;

function mockExecSync(command, options) {
    mockExecSyncCallCount++;
    if (mockExecSyncReturnValues.length > 0) {
        return mockExecSyncReturnValues.shift();
    }
    return originalExecSync(command, options);
}

// Mock fs for testing
const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;

let mockFsExistsSync = false;
let mockFsReadFileSync = '0';
let mockFsWriteFileSyncCalled = false;

        function expect(value) {
function mockExistsSync(path) {
    return mockFsExistsSync;
}

function mockReadFileSync(path, encoding) {
    return mockFsReadFileSync;
}

function mockWriteFileSync(path, data) {
    mockFsWriteFileSyncCalled = true;
}

// Test helper functions
function setupMocks() {
    require('child_process').execSync = mockExecSync;
    fs.existsSync = mockExistsSync;
    fs.readFileSync = mockReadFileSync;
    fs.writeFileSync = mockWriteFileSync;
    mockExecSyncCallCount = 0;
    mockExecSyncReturnValues = [];
    mockFsExistsSync = false;
    mockFsReadFileSync = '0';
    mockFsWriteFileSyncCalled = false;
}

function restoreMocks() {
    require('child_process').execSync = originalExecSync;
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    fs.writeFileSync = originalWriteFileSync;
}

// Import the functions to test
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

// Test CPU Usage
test('getCpuUsage should return correct CPU percentage', () => {
    setupMocks();
    mockExecSyncReturnValues = ['85.5'];
    
    const result = getCpuUsage();
    expect(result).toBe(85.5);
    
    restoreMocks();
});

test('getCpuUsage should handle errors gracefully', () => {
    setupMocks();
    mockExecSyncReturnValues = [new Error('Command failed')];
    
    const result = getCpuUsage();
    expect(result).toBeNull();
    
    restoreMocks();
});

// Test Memory Usage

test('getMemUsage should return correct memory percentage', () => {
    setupMocks();
    mockExecSyncReturnValues = ['75.3'];
    
    const result = getMemUsage();
    expect(result).toBe(75.3);
    
    restoreMocks();
});

test('getDetailedMemoryInfo should parse memory info correctly', () => {
    setupMocks();
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
    
    restoreMocks();
});

// Test Process Lists
test('getTopCpuProcesses should parse process list correctly', () => {
    setupMocks();
    const mockPsOutput = `user1 1234 25.5 10.2 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 15.2 5.1 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    mockExecSyncReturnValues = [mockPsOutput];
    
    const result = getTopCpuProcesses(2);
    expect(result).toHaveLength(2);
    expect(result[0].cpu).toBe(25.5);
    expect(result[0].command).toBe('/usr/bin/node app.js');
    
    restoreMocks();
});

test('getTopMemoryProcesses should parse memory processes correctly', () => {
    setupMocks();
    const mockPsOutput = `user1 1234 5.2 25.5 1234567 89012 pts/0 S+ 10:30 0:05 /usr/bin/node app.js
user2 5678 3.1 15.2 987654 32109 pts/1 R+ 10:31 0:02 /usr/bin/python script.py`;
    mockExecSyncReturnValues = [mockPsOutput];
    
    const result = getTopMemoryProcesses(2);
    expect(result).toHaveLength(2);
    expect(result[0].mem).toBe(25.5);
    expect(result[1].mem).toBe(15.2);
    
    restoreMocks();
});

// Test Swap Usage
test('getSwapUsage should return correct swap percentage', () => {
    setupMocks();
    mockExecSyncReturnValues = ['35.7'];
    
    const result = getSwapUsage();
    expect(result).toBe(35.7);
    
    restoreMocks();
});

test('getDetailedSwapInfo should parse swap info correctly', () => {
    setupMocks();
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
    
    restoreMocks();
});

// Test System Information
test('getSystemLoad should parse load averages correctly', () => {
    setupMocks();
    const mockUptimeOutput = ' 10:45:30 up 2 days, 3:45, 2 users, load average: 1.25, 1.15, 0.95';
    mockExecSyncReturnValues = [mockUptimeOutput];
    
    const result = getSystemLoad();
    expect(result).toEqual({
        '1min': 1.25,
        '5min': 1.15,
        '15min': 0.95
    });
    
    restoreMocks();
});

test('getUptime should return uptime string', () => {
    setupMocks();
    const mockUptimeOutput = 'up 2 days, 3 hours, 45 minutes';
    mockExecSyncReturnValues = [mockUptimeOutput];
    
    const result = getUptime();
    expect(result).toBe('up 2 days, 3 hours, 45 minutes');
    
    restoreMocks();
});

test('getDiskUsage should parse disk usage correctly', () => {
    setupMocks();
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
    
    restoreMocks();
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
    expect(result).toContain('1. */usr/bin/very/long/path/to/a/very/long/command/name/that/exceeds/fifty/characters...*');
});

// Test Error Handling
test('should handle command failures gracefully', () => {
    setupMocks();
    mockExecSyncReturnValues = [new Error('Command failed')];
    
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
    
    restoreMocks();
});

// Print test results
console.log('\n📊 Test Results:');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Total Tests: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
} 