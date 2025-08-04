# System Health Monitor - Test Suite

This document explains how to run the comprehensive test suite for the enhanced system health monitor.

## 🧪 Test Files

### 1. `test-system-health-monitor.js` - Jest Test Suite
A comprehensive Jest-based test suite that covers all functionality with proper mocking.

### 2. `run-tests.js` - Simple Test Runner
A standalone test runner that doesn't require Jest installation.

### 3. `package.json` - Test Configuration
Contains Jest configuration and test scripts.

## 🚀 Running Tests

### Option 1: Using Jest (Recommended)

First, install dependencies:
```bash
npm install
```

Then run the tests:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Option 2: Using Simple Test Runner

Run the standalone test runner:
```bash
node run-tests.js
```

## 📋 Test Coverage

The test suite covers all major components of the system health monitor:

### 🔧 Core Functions
- **`getCpuUsage()`** - CPU percentage retrieval
- **`getTopCpuProcesses()`** - Top CPU-consuming processes
- **`getMemUsage()`** - Memory percentage retrieval
- **`getDetailedMemoryInfo()`** - Detailed memory breakdown
- **`getTopMemoryProcesses()`** - Top memory-consuming processes
- **`getSwapUsage()`** - Swap percentage retrieval
- **`getDetailedSwapInfo()`** - Detailed swap information
- **`getSystemLoad()`** - System load averages
- **`getUptime()`** - System uptime
- **`getDiskUsage()`** - Disk usage information
- **`formatProcessList()`** - Process list formatting

### 🚨 Alert System
- **CPU Alerts** - High CPU usage detection with duration tracking
- **Memory Alerts** - High memory usage with process details
- **Swap Alerts** - High swap usage detection
- **Alert Cooldown** - Prevents spam alerts
- **Slack Integration** - Alert formatting and sending

### 🛡️ Error Handling
- **Command Failures** - Graceful handling of system command errors
- **Malformed Output** - Handling of unexpected command output
- **Network Errors** - Slack API error handling
- **File System Errors** - Alert cooldown file operations

### 🔄 Integration Tests
- **Full Alert Scenarios** - Complete CPU, memory, and swap alert flows
- **System Context** - Uptime, load, and disk information integration
- **Process Details** - Top processes integration in alerts

## 🎯 Test Categories

### 1. **Unit Tests**
- Individual function testing
- Input/output validation
- Error handling verification

### 2. **Integration Tests**
- End-to-end alert scenarios
- System information gathering
- Slack message formatting

### 3. **Error Handling Tests**
- Command execution failures
- Malformed system output
- Network communication errors

### 4. **Edge Case Tests**
- Empty process lists
- Zero swap usage
- Long command names
- Boundary conditions

## 📊 Test Results

### Jest Output Example
```
 PASS  test-system-health-monitor.js
  System Health Monitor Tests
    CPU Usage Tests
      ✓ should get CPU usage correctly
      ✓ should handle CPU usage error gracefully
      ✓ should get top CPU processes correctly
      ✓ should handle malformed ps output gracefully
    Memory Usage Tests
      ✓ should get memory usage correctly
      ✓ should get detailed memory info correctly
      ✓ should get top memory processes correctly
    Swap Usage Tests
      ✓ should get swap usage correctly
      ✓ should handle zero swap correctly
      ✓ should get detailed swap info correctly
    System Information Tests
      ✓ should get system load correctly
      ✓ should get uptime correctly
      ✓ should get disk usage correctly
    Process List Formatting Tests
      ✓ should format process list correctly
      ✓ should truncate long command names
      ✓ should handle empty process list
      ✓ should handle null process list
    Alert Cooldown Tests
      ✓ should respect alert cooldown period
      ✓ should send alert after cooldown period
    CPU Threshold Duration Tests
      ✓ should not alert immediately when CPU goes over threshold
      ✓ should alert after CPU stays over threshold for required duration
    Slack Alert Tests
      ✓ should send Slack alert with correct format
      ✓ should handle Slack API errors gracefully
    Integration Tests
      ✓ should trigger CPU alert with full context
      ✓ should trigger memory alert with full context
      ✓ should trigger swap alert with full context
    Error Handling Tests
      ✓ should handle all command failures gracefully
      ✓ should handle malformed command output gracefully

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        2.145 s
```

### Simple Test Runner Output Example
```
🧪 Running System Health Monitor Tests...

✅ getCpuUsage should return correct CPU percentage
✅ getCpuUsage should handle errors gracefully
✅ getMemUsage should return correct memory percentage
✅ getDetailedMemoryInfo should parse memory info correctly
✅ getTopCpuProcesses should parse process list correctly
✅ getTopMemoryProcesses should parse memory processes correctly
✅ getSwapUsage should return correct swap percentage
✅ getDetailedSwapInfo should parse swap info correctly
✅ getSystemLoad should parse load averages correctly
✅ getUptime should return uptime string
✅ getDiskUsage should parse disk usage correctly
✅ formatProcessList should format processes correctly
✅ formatProcessList should handle empty process list
✅ formatProcessList should truncate long command names
✅ should handle command failures gracefully

📊 Test Results:
✅ Tests Passed: 15
❌ Tests Failed: 0
📈 Total Tests: 15

🎉 All tests passed!
```

## 🔧 Test Configuration

### Jest Configuration (package.json)
```json
{
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "system-health-monitor.js",
      "!**/node_modules/**",
      "!**/coverage/**"
    ],
    "coverageReporters": [
      "text",
      "lcov",
      "html"
    ],
    "testMatch": [
      "**/test-*.js",
      "**/*.test.js"
    ]
  }
}
```

## 🛠️ Mocking Strategy

### System Commands
- **`execSync`** - Mocked to return predefined outputs
- **File System** - Mocked for alert cooldown testing
- **Network** - Mocked for Slack API testing

### Test Data
- **Realistic Output** - Uses actual command output formats
- **Edge Cases** - Tests boundary conditions and errors
- **Integration** - Tests complete alert flows

## 📈 Coverage Goals

- **Function Coverage**: 100% of exported functions tested
- **Branch Coverage**: All error paths and edge cases
- **Integration Coverage**: Complete alert scenarios
- **Error Handling**: All error conditions tested

## 🚀 Continuous Integration

The test suite is designed to run in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    npm install
    npm test
    npm run test:coverage
```

## 🔍 Debugging Tests

### Jest Debug Mode
```bash
# Run specific test file
npm test test-system-health-monitor.js

# Run with verbose output
npm test -- --verbose

# Run specific test
npm test -- -t "should get CPU usage correctly"
```

### Simple Test Runner Debug
```bash
# Run with Node debugger
node --inspect-brk run-tests.js
```

## 📝 Adding New Tests

### For New Functions
1. Add function to exports in `system-health-monitor.js`
2. Create unit tests in `test-system-health-monitor.js`
3. Add integration tests if needed
4. Update `run-tests.js` for simple testing

### Test Structure
```javascript
test('should do something correctly', () => {
    setupMocks();
    // Test setup
    const result = functionToTest();
    expect(result).toBe(expectedValue);
    restoreMocks();
});
```

## 🎯 Best Practices

1. **Mock External Dependencies** - Don't rely on real system commands
2. **Test Error Conditions** - Always test failure scenarios
3. **Use Realistic Data** - Mock with actual command output formats
4. **Test Edge Cases** - Boundary conditions and unusual inputs
5. **Integration Testing** - Test complete workflows
6. **Clear Test Names** - Descriptive test names for easy debugging

## 🔗 Related Files

- `system-health-monitor.js` - Main application
- `test-system-health-monitor.js` - Jest test suite
- `run-tests.js` - Simple test runner
- `package.json` - Test configuration
- `TEST_README.md` - This documentation 