#!/bin/bash

# Disk Monitor Installation Script
# This script installs and sets up the disk usage monitoring service
#
# Make the script executable and run it:
# chmod +x install-disk-monitor.sh
# sudo ./install-disk-monitor.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/disk-monitor"
SERVICE_NAME="disk-monitor"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to install Node.js and npm
install_nodejs() {
    print_status "Installing Node.js and npm..."
    
    # Update package list
    apt update
    
    # Install Node.js and npm
    apt install -y nodejs npm
    
    # Verify installation
    NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
    NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
    
    print_success "Node.js version: $NODE_VERSION"
    print_success "npm version: $NPM_VERSION"
}

# Function to create installation directory and files
setup_application() {
    print_status "Setting up application directory..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Create package.json
    cat > package.json << EOF
{
  "name": "disk-monitor",
  "version": "1.0.0",
  "description": "Disk usage monitoring service with Slack notifications",
  "main": "disk-monitor.js",
  "scripts": {
    "start": "node disk-monitor.js"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
EOF
    
    # If disk-monitor.js exists in the installer's directory, use it instead of generating a new one
    INSTALLER_DIR=$(dirname "$0")
    SRC_JS="$(realpath "$INSTALLER_DIR/disk-monitor.js")"
    DST_JS="$(realpath "$INSTALL_DIR/disk-monitor.js" 2>/dev/null || echo '')"
    if [[ ! -f "$DST_JS" || "$SRC_JS" != "$DST_JS" ]]; then
        cp "$SRC_JS" "$INSTALL_DIR/"
    fi
    chmod +x "$INSTALL_DIR/disk-monitor.js"
    
    SRC_SYSJS="$(realpath "$INSTALLER_DIR/system-health-monitor.js")"
    DST_SYSJS="$(realpath "$INSTALL_DIR/system-health-monitor.js" 2>/dev/null || echo '')"
    if [[ ! -f "$DST_SYSJS" || "$SRC_SYSJS" != "$DST_SYSJS" ]]; then
        cp "$SRC_SYSJS" "$INSTALL_DIR/"
    fi
    chmod +x "$INSTALL_DIR/system-health-monitor.js"
    
    print_success "Application files created in $INSTALL_DIR"
}

# Function to install npm dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    cd "$INSTALL_DIR"
    npm install
    print_success "Dependencies installed successfully"
}

# Function to create systemd service
create_service() {
    print_status "Creating systemd service..."
    # Create disk-monitor service
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Disk Usage Monitor with Slack Notifications
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node disk-monitor.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    # Create system-health-monitor service
    cat > "/etc/systemd/system/system-health-monitor.service" << EOF
[Unit]
Description=System Health Monitor with Slack Notifications
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node system-health-monitor.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    print_success "Service files created at $SERVICE_FILE and /etc/systemd/system/system-health-monitor.service"
}

# Function to enable and start service
start_service() {
    print_status "Enabling and starting service..."
    
    # Enable and start both services
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl enable system-health-monitor
    systemctl start "$SERVICE_NAME"
    systemctl start system-health-monitor
    # Check both services
    if systemctl is-active --quiet "$SERVICE_NAME" && systemctl is-active --quiet system-health-monitor; then
        print_success "Both services started successfully!"
    else
        print_error "Failed to start one or both services"
        systemctl status "$SERVICE_NAME"
        systemctl status system-health-monitor
        exit 1
    fi
}

# Function to show service status and logs
show_status() {
    echo ""
    print_status "Service Status:"
    systemctl status "$SERVICE_NAME" --no-pager
    systemctl status system-health-monitor --no-pager
    echo ""
    print_status "Recent logs (disk-monitor):"
    journalctl -u "$SERVICE_NAME" -n 10 --no-pager
    echo ""
    print_status "Recent logs (system-health-monitor):"
    journalctl -u system-health-monitor -n 10 --no-pager
    echo ""
    print_status "To view live logs, run:"
    echo "journalctl -u $SERVICE_NAME -f"
    echo "journalctl -u system-health-monitor -f"
    echo ""
    print_status "To stop the services, run:"
    echo "sudo systemctl stop $SERVICE_NAME"
    echo "sudo systemctl stop system-health-monitor"
    echo ""
    print_status "To restart the services, run:"
    echo "sudo systemctl restart $SERVICE_NAME"
    echo "sudo systemctl restart system-health-monitor"
}

# Main installation process
main() {
    echo "========================================"
    echo "    Disk Monitor Installation Script    "
    echo "========================================"
    
    check_root
    install_nodejs
    setup_application
    install_dependencies
    create_service
    start_service
    show_status
    
    echo ""
    print_success "Installation completed successfully!"
    print_success "The disk monitor is now running and will check disk usage every 5 minutes."
    print_success "You'll receive Slack notifications when disk usage exceeds 80%."
}

# Run main function
main "$@"