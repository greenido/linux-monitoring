# Linux System Health Monitor 🎉

Why?
Well... I built it as we needed a simple/quick solution to monitor our servers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](./docs/TEST_README.md)

What?
This is NodeJS monitoring suite for Linux servers that provides real-time system health monitoring with intelligent alerts. 
The suite includes two main monitoring services:

- **🖥️ System Health Monitor**: Monitors CPU, memory, and swap usage with detailed process information
- **💾 Disk Monitor**: Tracks disk usage across filesystems with threshold-based alerts
- **🌐 Extended Host Metrics**: Adds open file descriptor usage, network bandwidth, and disk I/O telemetry
- **📢 Smart Alerts**: Sends rich Slack notifications with system context and top processes
- **🔧 Bulk Deployment**: Install across multiple servers simultaneously with robust SSH handling

## 📚 Table of Contents

- [📁 Project Structure](#-project-structure)
- [✨ Features](#-features)
- [🆕 Today's Updates](#-todays-updates)
- [⚡ Quick Start](#-quick-start)
- [📋 Prerequisites](#prerequisites)
- [🚀 Installation](#-installation)
- [🌐 Bulk Installation](#-bulk-installation-to-multiple-servers)
- [⚙️ Configuration](#-configuration)
- [🎯 Usage](#-usage)
- [🧪 Testing](#-testing)
- [🔧 SSH Troubleshooting](#-ssh-troubleshooting)
- [🗑️ Uninstall](#-uninstall)
- [❗ Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📞 Contact](#-contact)

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/public-linux-monitor.git
cd public-linux-monitor

# 2. Single server installation
chmod +x bash-scripts/install-disk-monitor.sh
sudo bash-scripts/install-disk-monitor.sh

# 3. Bulk installation to multiple servers
chmod +x bash-scripts/bulk-install.sh
bash-scripts/bulk-install.sh -k ~/.ssh/your-key.pem -u ubuntu -s <slack-webhook-url>
```

## 📁 Project Structure

```text
public-linux-monitor/
├── 📊 Monitoring Scripts
│   ├── system-health-monitor.js    # Main system health monitoring service
│   ├── disk-monitor.js             # Disk usage monitoring service
│   └── run-tests.js                # Standalone test runner
├── 🧩 Shared Utilities
│   └── lib/
│       ├── common.js               # Shared config, cooldown, webhook, and shutdown helpers
│       └── logger.js               # Structured JSON/pretty logger (Pino)
├── 🔧 Installation & Deployment
│   ├── bash-scripts/
│   │   ├── install-disk-monitor.sh # Single server installation
│   │   ├── bulk-install.sh         # Multi-server deployment
│   │   ├── remote-install.sh       # Remote installation helper
│   │   ├── servers.txt             # Target servers list
│   │   ├── ssh-diagnose.sh         # SSH troubleshooting
│   │   └── fix-ssh-access.sh       # SSH key setup automation
├── 🧪 Testing & Documentation
│   ├── test-system-health-monitor.js # Jest tests for system-health monitor
│   ├── test-disk-monitor.js        # Jest tests for disk monitor
│   ├── docs/TEST_README.md         # Comprehensive testing guide
│   ├── docs/SSH_TROUBLESHOOTING.md # SSH setup and debugging
│   └── README.md                  # This file
└── ⚙️ Configuration
    ├── package.json               # Node.js dependencies and scripts
    ├── .env.example              # Environment variables template
    └── .gitignore                # Git ignore patterns
```

## ✨ Features

- 🔍 **Multi-metric Monitoring**: CPU, memory, swap, and disk usage tracking
- 🌐 **Host-Level Telemetry**: Open file descriptors (`/proc/sys/fs/file-nr`), network RX/TX bandwidth (`/proc/net/dev`), and disk I/O ops/sec (`/proc/diskstats`)
- 📊 **Rich Context Alerts**: Slack notifications include top processes, system load, uptime, and resource breakdowns
- ⚡ **Smart Thresholds**: Configurable alerting thresholds with cooldown periods
- 🧩 **Shared Utility Layer**: Common configuration, webhook validation, cooldown tracking, and graceful shutdown logic in `lib/common.js`
- 🪵 **Structured Logging**: Monitor logs now use Pino with machine-friendly JSON output and optional pretty mode
- 🚀 **Systemd Integration**: Automatic startup and service management
- 🔧 **Bulk Deployment**: Install across multiple servers with one command
- 🛡️ **Robust SSH Handling**: Automated SSH troubleshooting and key management
- 🧪 **Comprehensive Testing**: Full test suite with Jest and standalone runner
- 📈 **Production Ready**: Designed for enterprise Linux environments

## 🆕 Today's Updates

### 1. New runtime metrics in system health alerts

- Added **open file descriptors** usage and percentage reporting.
- Added **network bandwidth** reporting (RX/TX bytes per second).
- Added **disk I/O** reporting (read/write operations per second).
- Included these metrics directly in Slack alert context to make triage faster.

### 2. Monitor refactor with shared utilities

- Extracted common monitor logic into `lib/common.js`.
- Both monitors now share:
   - Environment/config loading (`dotenv` + defaults)
   - Alert cooldown file tracking
   - Slack webhook validation
   - Graceful shutdown handling

### 3. Structured logging rollout

- Added `lib/logger.js` with Pino-based logger creation.
- Migrated monitor logs from `console.*` to structured logger calls.
- Added support for:
   - `LOG_LEVEL` (default: `info`)
   - `LOG_FORMAT` (`json` default, `pretty` optional)

### 4. Testing improvements

- Added a dedicated Jest suite for disk monitor: `test-disk-monitor.js`.
- Expanded system-health tests for the new telemetry functions.
- Ensured monitor functions are exported for direct unit testing.

## Prerequisites

- Ubuntu/Debian-based Linux system (for monitoring)
- Node.js and npm (installed automatically by the script)
- Slack workspace with an [Incoming Webhook](https://api.slack.com/messaging/webhooks)
- Root (sudo) access
- For bulk install: SSH access to all target servers, and your SSH private key
- For MacOS users: The bulk install script works on MacOS, but ensure your SSH key is loaded and accessible

## 🚀 Installation

### Single Server Installation

1. **Clone the repository** to your server:
   ```bash
   git clone https://github.com/your-org/public-linux-monitor.git
   cd public-linux-monitor
   ```

2. **Configure environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your Slack webhook URL and custom thresholds
   ```

3. **Run the installation script**:
   ```bash
   chmod +x bash-scripts/install-disk-monitor.sh
   sudo bash-scripts/install-disk-monitor.sh
   ```

4. **Enter your Slack webhook URL** when prompted (if not set in .env).

**What the installer does:**
- ✅ Installs Node.js and npm if missing
- ✅ Sets up monitoring services in `/opt/disk-monitor`
- ✅ Installs all dependencies (`axios`, `dotenv`, `pino`, `pino-pretty`)
- ✅ Configures Slack webhook for both monitors
- ✅ Creates and starts systemd services: `disk-monitor` and `system-health-monitor`
- ✅ Enables services for automatic startup on boot

## 🌐 Bulk Installation to Multiple Servers

Deploy the monitoring suite across multiple servers simultaneously using the bulk installer:

### Setup Process

1. **Prepare your server list:**
   ```bash
   # Edit bash-scripts/servers.txt with your target servers
   vim bash-scripts/servers.txt
   ```
   - One server (IP or domain) per line
   - Lines starting with `#` are treated as comments
   - Example:

     ```text
     # Production servers
     192.168.1.10
     web-server-01.example.com
     db-server.example.com
     # web-server-02.example.com  # commented out
     ```

2. **Run the bulk installer:**
   ```bash
   chmod +x bash-scripts/bulk-install.sh
   bash-scripts/bulk-install.sh -k ~/.ssh/your-key.pem -u ubuntu -s <slack-webhook-url>
   ```

### Bulk Installer Options

| Option | Description | Example |
|--------|-------------|---------|
| `-k` | SSH private key path | `-k ~/.ssh/my-key.pem` |
| `-u` | SSH username | `-u ubuntu` |
| `-s` | Slack webhook URL | `-s https://hooks.slack.com/...` |
| `-t` | Test SSH connections only (no install) | `-t` |
| `-v` | Verbose output | `-v` |
| `--help` | Show all available options | `--help` |

### Example Commands

```bash
# Test SSH connections before installing
bash-scripts/bulk-install.sh -k ~/.ssh/key.pem -u ubuntu -t -v

# Install with custom settings
bash-scripts/bulk-install.sh -k ~/.ssh/key.pem -u admin -s <webhook> -v

# Use different server list file
bash-scripts/bulk-install.sh -f custom-servers.txt -k ~/.ssh/key.pem -u root -s <webhook>
```

### SSH Troubleshooting

- 🔧 **Issues?** See [`docs/SSH_TROUBLESHOOTING.md`](./docs/SSH_TROUBLESHOOTING.md) for comprehensive diagnostics
- 🛠️ **Auto-fix:** Use `bash-scripts/ssh-diagnose.sh` and `bash-scripts/fix-ssh-access.sh`

## ⚙️ Configuration

### Environment Variables

The monitoring services can be configured using environment variables via a `.env` file:

```bash
# Copy the example configuration
cp .env.example .env
```

**Available Configuration Options:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SLACK_WEBHOOK_URL` | *required* | Your Slack incoming webhook URL |
| `DISK_THRESHOLD` | `80` | Disk usage alert threshold (%) |
| `CPU_THRESHOLD` | `90` | CPU usage alert threshold (%) |
| `MEM_THRESHOLD` | `90` | Memory usage alert threshold (%) |
| `SWAP_THRESHOLD` | `50` | Swap usage alert threshold (%) |
| `CHECK_INTERVAL` | `300000` | Check interval in milliseconds (5 minutes) |
| `ALERT_COOLDOWN` | `1800000` | Cooldown between alerts in milliseconds (30 minutes) |
| `CPU_OVER_THRESHOLD_DURATION` | `300000` | CPU must be over threshold for this duration before alerting (5 minutes) |
| `LOG_LEVEL` | `info` | Logging level for monitor output (e.g. `debug`, `info`, `warn`, `error`) |
| `LOG_FORMAT` | `json` | Log format (`json` for machine parsing, `pretty` for human-readable development logs) |
| `LOG_LEVEL` | `info` | Log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `LOG_FORMAT` | `json` | Output format: `json` for machine-readable logs, `pretty` for local readability |

### Logging Output

- Default output is newline-delimited JSON (NDJSON), which works well with CloudWatch, ELK/OpenSearch, Datadog, and other log ingestion pipelines.
- Set `LOG_FORMAT=pretty` for local troubleshooting to get human-friendly logs.
- Set `LOG_LEVEL` to control verbosity without code changes.

### Runtime Configuration

**After Installation:**

- Configuration files are located in `/opt/disk-monitor/`
- Services read environment variables on startup
- Restart services after changing configuration:

  ```bash
  sudo systemctl restart disk-monitor system-health-monitor
  ```

### Slack Webhook Setup

1. **Create a Slack App**: Go to [api.slack.com/apps](https://api.slack.com/apps)
2. **Enable Incoming Webhooks**: In your app settings
3. **Add Webhook to Workspace**: Choose your channel
4. **Copy Webhook URL**: Use in `SLACK_WEBHOOK_URL` configuration

### Advanced Configuration

For more advanced configurations, edit the service files directly:
- **System Health Monitor**: `/opt/disk-monitor/system-health-monitor.js`
- **Disk Monitor**: `/opt/disk-monitor/disk-monitor.js`

**Common Customizations:**

- Change alert message format
- Add additional metrics
- Modify process filtering logic
- Customize notification schedules

## 🎯 Usage

### Service Management

**Check service status:**
```bash
# Check both services
sudo systemctl status disk-monitor system-health-monitor

# Check individual services
sudo systemctl status disk-monitor
sudo systemctl status system-health-monitor
```

**View real-time logs:**
```bash
# Follow logs for both services
sudo journalctl -u disk-monitor -u system-health-monitor -f

# Individual service logs
journalctl -u disk-monitor -f
journalctl -u system-health-monitor -f

# View recent logs (last 100 lines)
journalctl -u disk-monitor -n 100
journalctl -u system-health-monitor -n 100
```

**Service control:**
```bash
# Start services
sudo systemctl start disk-monitor system-health-monitor

# Stop services
sudo systemctl stop disk-monitor system-health-monitor

# Restart services (after configuration changes)
sudo systemctl restart disk-monitor system-health-monitor

# Enable/disable automatic startup
sudo systemctl enable disk-monitor system-health-monitor
sudo systemctl disable disk-monitor system-health-monitor
```

### Monitoring Commands

**Manual health check:**
```bash
# Run system health check once
cd /opt/disk-monitor
node system-health-monitor.js

# Run disk check once
node disk-monitor.js
```

**Check thresholds without alerts:**
```bash
# View current system stats
top -bn1 | head -20
free -h
df -h
```

## 🧪 Testing

The project includes a comprehensive test suite covering all monitoring logic, alert systems, and error handling scenarios.

### Quick Test Run

```bash
# Install test dependencies
npm install

# Run all tests (Jest)
npm test

# Run simple test runner (no Jest required)
node run-tests.js
```

### Test Options

**Jest-based testing:**
```bash
# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npm test test-system-health-monitor.js
npm test test-disk-monitor.js

# Run tests with verbose output
npm test -- --verbose
```

**Standalone test runner:**
```bash
# Simple test runner with detailed output
node run-tests.js

# Debug mode
node --inspect-brk run-tests.js
```

### Test Coverage

**Core Functionality:**
- ✅ CPU usage monitoring and process tracking
- ✅ Memory usage monitoring with detailed breakdowns
- ✅ Swap usage monitoring and reporting
- ✅ Disk usage monitoring across filesystems
- ✅ System load and uptime reporting
- ✅ Open file descriptor pressure monitoring
- ✅ Network bandwidth sampling (RX/TX)
- ✅ Disk I/O sampling (read/write ops/sec)

**Alert System:**
- ✅ Threshold-based alerting logic
- ✅ Alert cooldown mechanisms
- ✅ CPU duration-based alerting
- ✅ Slack message formatting
- ✅ Structured logging behavior
- ✅ Error handling and recovery

**Edge Cases:**
- ✅ Malformed system command output
- ✅ Network connectivity issues
- ✅ File system errors
- ✅ Empty process lists
- ✅ Boundary conditions

📖 **Detailed Testing Guide**: See [`docs/TEST_README.md`](./docs/TEST_README.md) for comprehensive testing documentation.

## 🔧 SSH Troubleshooting

Having SSH connection issues during bulk installation? We've got you covered:

### Quick Diagnostics

**Use our automated tools:**
```bash
# Diagnose SSH connection issues
bash-scripts/ssh-diagnose.sh

# Automatically fix common SSH problems
bash-scripts/fix-ssh-access.sh
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 🚫 **Permission denied** | Check SSH key permissions: `chmod 600 ~/.ssh/your-key.pem` |
| 🔑 **Key not found** | Verify key path and add to SSH agent: `ssh-add ~/.ssh/your-key.pem` |
| 🌐 **Connection refused** | Check if SSH service is running on target server |
| ⏰ **Connection timeout** | Verify network connectivity and firewall settings |
| 👤 **Wrong username** | Use correct username for your Linux distribution (ubuntu, admin, root) |

📖 **Comprehensive Guide**: See [`docs/SSH_TROUBLESHOOTING.md`](./docs/SSH_TROUBLESHOOTING.md) for detailed troubleshooting steps.

## 🗑️ Uninstall

To completely remove the monitoring services:

```bash
# Stop and disable services
sudo systemctl stop disk-monitor system-health-monitor
sudo systemctl disable disk-monitor system-health-monitor

# Remove service files
sudo rm /etc/systemd/system/disk-monitor.service
sudo rm /etc/systemd/system/system-health-monitor.service

# Remove application directory
sudo rm -rf /opt/disk-monitor

# Reload systemd configuration
sudo systemctl daemon-reload

# Verify removal
sudo systemctl status disk-monitor system-health-monitor
```

**Optional cleanup:**
```bash
# Remove Node.js if installed only for monitoring
# (Be careful - this may affect other applications)
sudo apt remove nodejs npm  # Ubuntu/Debian
```

## ❗ Troubleshooting

### Common Issues

**🔴 Alerts not working:**
- ✅ Verify Slack webhook URL is correct and active
- ✅ Test webhook: `curl -X POST -H 'Content-type: application/json' --data '{"text":"Test"}' YOUR_WEBHOOK_URL`
- ✅ Check service logs: `journalctl -u system-health-monitor -u disk-monitor -f`

**🔴 Services not starting:**
- ✅ Ensure Node.js is installed: `node --version`
- ✅ Check Node.js path: `which node` (should be `/usr/bin/node`)
- ✅ Verify file permissions: `ls -la /opt/disk-monitor/`
- ✅ Check service status: `sudo systemctl status disk-monitor system-health-monitor`

**🔴 High CPU/memory alerts:**
- ✅ Review alert thresholds in configuration
- ✅ Check if thresholds are appropriate for your system
- ✅ Verify system is not actually experiencing issues

**🔴 SSH/bulk install issues:**
- ✅ See [SSH Troubleshooting](#-ssh-troubleshooting) section above
- ✅ Ensure SSH key has correct permissions (`chmod 600`)
- ✅ Verify SSH agent is running and key is loaded
- ✅ Test SSH connection manually: `ssh -i ~/.ssh/key.pem user@server`

**🔴 Permission errors:**
- ✅ Run installation script with `sudo`
- ✅ Ensure current user has sudo privileges
- ✅ Check file ownership: `sudo chown -R root:root /opt/disk-monitor`

### Getting Help

**Debug logging:**
```bash
# Enable verbose logging for services
sudo journalctl -u disk-monitor -u system-health-monitor -f --no-pager

# Test scripts manually
cd /opt/disk-monitor
sudo -u nobody node system-health-monitor.js
```

**System information:**
```bash
# Gather system info for troubleshooting
uname -a
node --version
npm --version
systemctl --version
free -h
df -h
```

## 🤝 Contributing

We welcome contributions to improve the Linux System Health Monitor! Here's how you can get involved:

### 🚀 Quick Start for Contributors

1. **Fork the repository** and clone your fork:
   ```bash
   git clone https://github.com/your-username/public-linux-monitor.git
   cd public-linux-monitor
   ```

2. **Set up your development environment**:
   ```bash
   npm install
   cp .env.example .env  # Configure your environment variables
   ```

3. **Run the test suite** to ensure everything works:
   ```bash
   npm test
   # or use the standalone runner
   node run-tests.js
   ```

### 🛠️ Development Setup

**Prerequisites for Development:**
- Node.js 14+ and npm
- Linux environment (for full testing)
- Access to a Slack workspace for webhook testing

**Environment Configuration:**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 🧪 Testing

We maintain comprehensive test coverage. Before submitting changes:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run the simple test runner (no Jest required)
node run-tests.js
```

See [docs/TEST_README.md](./docs/TEST_README.md) for detailed testing documentation.

### 📝 Code Standards

**JavaScript/Node.js:**
- Use ES6+ features where appropriate
- Follow consistent indentation (2 spaces)
- Include JSDoc comments for functions
- Handle errors gracefully with try-catch blocks
- Use meaningful variable and function names

**Bash Scripts:**
- Include shebang `#!/bin/bash`
- Use proper error handling with `set -e`
- Add comments for complex logic
- Follow consistent indentation (2 spaces)
- Test scripts on different Linux distributions

### 🔧 Areas for Contribution

**High Priority:**
- 🐛 Bug fixes and error handling improvements
- 📊 Additional monitoring metrics (network, I/O, processes)
- 🔔 Support for additional notification channels (email, Teams, Discord)
- 🐧 Support for additional Linux distributions (RHEL, CentOS, Alpine)

**Medium Priority:**
- 📈 Performance optimizations
- 🎨 UI/dashboard for monitoring data
- 📱 Mobile notifications
- 🔐 Enhanced security features

**Documentation & Testing:**
- 📚 Improve documentation and examples
- 🧪 Expand test coverage
- 🐳 Docker/container support
- 📦 Package manager integration (apt, yum, etc.)

### 🚦 Submission Process

1. **Create an issue** first to discuss major changes
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** with appropriate tests
4. **Run the test suite**: `npm test`
5. **Test on a Linux system** if possible
6. **Commit with clear messages**: 
   ```bash
   git commit -m "feat: add email notification support"
   # or
   git commit -m "fix: handle edge case in CPU parsing"
   ```
7. **Push and create a Pull Request**

### 📋 Pull Request Guidelines

**Before submitting:**
- ✅ All tests pass (`npm test`)
- ✅ Code follows project standards
- ✅ Documentation updated if needed
- ✅ Changes tested on Linux environment
- ✅ Commit messages are clear and descriptive

**PR Description should include:**
- 🎯 **Purpose**: What problem does this solve?
- 🔄 **Changes**: What was modified?
- 🧪 **Testing**: How was this tested?
- 📸 **Screenshots**: If UI changes (optional)
- 🔗 **Related Issues**: Link any related issues

### 🐛 Bug Reports

When reporting bugs, please include:

```markdown
**Environment:**
- OS: Ubuntu 20.04
- Node.js version: 16.14.0
- Monitor version: (git commit hash)

**Expected Behavior:**
What should happen?

**Actual Behavior:**
What actually happens?

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Logs:**
```bash
# Include relevant logs from:
journalctl -u system-health-monitor -f
# or
journalctl -u disk-monitor -f
```

**Additional Context:**
Any other relevant information
```

### 💡 Feature Requests

For new features, please provide:
- **Use Case**: Why is this needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: What other approaches did you consider?
- **Implementation Ideas**: Technical suggestions (optional)

### 🏷️ Commit Message Format

We follow conventional commit format:

```text
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(monitoring): add network bandwidth monitoring
fix(alerts): handle undefined process names gracefully
docs(readme): update installation instructions
test(cpu): add edge case tests for CPU parsing
```

### 🌟 Recognition

Contributors will be:
- Added to a CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Given credit in documentation for major features

### 📞 Getting Help with Contributing

- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Issues**: Report bugs via GitHub Issues
- 📧 **Direct Contact**: For security issues or major contributions

### 📄 License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

## 📞 Contact

For issues, suggestions, or contributions:
- 🔗 **GitHub Issues**: Report bugs and feature requests
- 💬 **GitHub Discussions**: Ask questions and share ideas
- 📧 **Maintainer**: Contact the project maintainer for security issues
