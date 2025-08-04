#!/bin/bash

# Bulk Server Installation Script
# This script reads a list of servers and installs the disk monitor on each one

set -e  # Exit on any error

# Configuration
SSH_KEY_PATH="~/.ssh/your-key.pem"
SLACK_WEBHOOK_URL=""  # Set this to your Slack webhook URL
SERVERS_FILE="servers.txt"
LOG_FILE="bulk-install.log"
INSTALL_SCRIPT="bash-scripts/install-disk-monitor.sh"
SSH_USERNAME="ubuntu"

# Expand SSH key path early (before any functions that use it)
SSH_KEY_PATH=$(eval echo "$SSH_KEY_PATH")

# Detect if we're running from bash-scripts/ directory and adjust paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVERS_FILE="$SCRIPT_DIR/servers.txt"
LOG_FILE="$SCRIPT_DIR/bulk-install.log"
if [[ "$(basename "$SCRIPT_DIR")" == "bash-scripts" ]]; then
    # We're in bash-scripts/, so go up one level to project root
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    INSTALL_SCRIPT="$SCRIPT_DIR/install-disk-monitor.sh"
else
    # We're in project root
    PROJECT_ROOT="$SCRIPT_DIR"
    INSTALL_SCRIPT="$SCRIPT_DIR/bash-scripts/install-disk-monitor.sh"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to log messages
log_message() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
    print_status "$BLUE" "$message"
}

# Function to print success message
print_success() {
    print_status "$GREEN" "$1"
}

# Function to print error message
print_error() {
    print_status "$RED" "$1"
}

# Function to print warning message
print_warning() {
    print_status "$YELLOW" "$1"
}

# Function to check if a file exists
check_file_exists() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        print_error "Error: File '$file' not found!"
        exit 1
    fi
}

# Function to validate server format
validate_server() {
    local server="$1"
    # Check if server has a valid format (IP or domain)
    if [[ ! "$server" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        print_warning "Warning: Server '$server' may not be in a valid format"
        return 1
    fi
    return 0
}

# Function to test SSH connection
test_ssh_connection() {
    local server="$1"
    local timeout=10
    
    print_status "$BLUE" "Testing SSH connection to $server..."
    
    # Try with verbose output first to diagnose issues
    if [[ "$VERBOSE" == true ]]; then
        print_status "$BLUE" "Attempting SSH connection with verbose output..."
        ssh -v -i "$SSH_KEY_PATH" -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$SSH_USERNAME@$server" "echo 'SSH connection successful'" 2>&1 | head -10
    fi
    
    # Use macOS-compatible SSH connection test
    if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$SSH_USERNAME@$server" "echo 'SSH connection successful'" 2>/dev/null; then
        print_success "SSH connection to $server successful"
        return 0
    else
        print_error "SSH connection to $server failed"
        
        # Try to provide helpful error information
        print_status "$YELLOW" "Troubleshooting tips for $server:"
        print_status "$YELLOW" "1. Check if the server is running and accessible"
        print_status "$YELLOW" "2. Verify your SSH key is added to the server's authorized_keys"
        print_status "$YELLOW" "3. Check if the server uses a different username (not 'ubuntu')"
        print_status "$YELLOW" "4. Verify the server's SSH configuration allows key authentication"
        print_status "$YELLOW" "5. Try connecting manually: ssh -i $SSH_KEY_PATH $SSH_USERNAME@$server"
        
        return 1
    fi
}

# Function to install on a single server
install_on_server() {
    local server="$1"
    local server_number="$2"
    local total_servers="$3"
    
    print_status "$BLUE" "Installing on server $server_number/$total_servers: $server"
    log_message "Starting installation on server $server_number/$total_servers: $server"
    
    # Test SSH connection first
    if ! test_ssh_connection "$server"; then
        print_error "Skipping $server due to SSH connection failure"
        log_message "FAILED: SSH connection failed for $server"
        return 1
    fi
    
    # Run the installation
    if "$SCRIPT_DIR/remote-install.sh" -i "$SSH_KEY_PATH" "$SSH_USERNAME@$server" "$INSTALL_SCRIPT" "$SLACK_WEBHOOK_URL"; then
        print_success "Installation completed successfully on $server"
        log_message "SUCCESS: Installation completed on $server"
        return 0
    else
        print_error "Installation failed on $server"
        log_message "FAILED: Installation failed on $server"
        return 1
    fi
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --file FILE     Server list file (default: servers.txt)"
    echo "  -k, --key KEY       SSH key path (default: ~/.ssh/your-key.pem)"
    echo "  -u, --user USER     SSH username (default: ubuntu)"
    echo "  -s, --slack URL     Slack webhook URL"
    echo "  -t, --test          Test SSH connections only (don't install)"
    echo "  -v, --verbose       Verbose output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Server list file format:"
    echo "  One server per line (IP address or domain name)"
    echo "  Lines starting with # are treated as comments"
    echo "  Empty lines are ignored"
    echo ""
    echo "Example servers.txt:"
    echo "  # Production servers"
    echo "  server1.example.com"
    echo "  192.168.1.100"
    echo "  # Staging servers"
    echo "  staging.example.com"
}

# Parse command line arguments
VERBOSE=false
TEST_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            SERVERS_FILE="$2"
            shift 2
            ;;
        -k|--key)
            SSH_KEY_PATH="$2"
            SSH_KEY_PATH=$(eval echo "$SSH_KEY_PATH")
            shift 2
            ;;
        -u|--user)
            SSH_USERNAME="$2"
            shift 2
            ;;
        -s|--slack)
            SLACK_WEBHOOK_URL="$2"
            shift 2
            ;;
        -t|--test)
            TEST_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main script execution
main() {
    print_status "$BLUE" "=== Bulk Server Installation Script ==="
    print_status "$BLUE" "SSH Key: $SSH_KEY_PATH"
    print_status "$BLUE" "Servers File: $SERVERS_FILE"
    print_status "$BLUE" "Log File: $LOG_FILE"
    print_status "$BLUE" "Test Only: $TEST_ONLY"
    print_status "$BLUE" "Verbose: $VERBOSE"
    echo ""
    
    # Check if required files exist
    check_file_exists "$SERVERS_FILE"
    check_file_exists "$INSTALL_SCRIPT"
    check_file_exists "$SCRIPT_DIR/remote-install.sh"
    
    # Verify SSH key exists
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        print_error "SSH key not found: $SSH_KEY_PATH"
        exit 1
    fi
    
    # Set proper permissions for SSH key
    chmod 600 "$SSH_KEY_PATH" 2>/dev/null || print_warning "Could not set SSH key permissions"
    
    # Read and validate servers
    print_status "$BLUE" "Reading server list from $SERVERS_FILE..."
    
    # Filter out comments and empty lines, then validate
    servers=()
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]]; then
            continue
        fi
        
        # Trim whitespace
        server=$(echo "$line" | xargs)
        
        if validate_server "$server"; then
            servers+=("$server")
        else
            print_warning "Skipping invalid server: $server"
        fi
    done < "$SERVERS_FILE"
    
    if [[ ${#servers[@]} -eq 0 ]]; then
        print_error "No valid servers found in $SERVERS_FILE"
        exit 1
    fi
    
    print_success "Found ${#servers[@]} valid servers"
    
    # Display servers
    print_status "$BLUE" "Servers to process:"
    for i in "${!servers[@]}"; do
        echo "  $((i+1)). ${servers[i]}"
    done
    echo ""
    
    # Confirm before proceeding
    if [[ "$TEST_ONLY" == false ]]; then
        read -p "Do you want to proceed with installation on ${#servers[@]} servers? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "$YELLOW" "Installation cancelled by user"
            exit 0
        fi
    fi
    
    # Initialize counters
    successful=0
    failed=0
    total=${#servers[@]}
    
    # Process each server
    for i in "${!servers[@]}"; do
        server="${servers[i]}"
        server_number=$((i+1))
        
        echo ""
        print_status "$BLUE" "Processing server $server_number/$total: $server"
        
        if [[ "$TEST_ONLY" == true ]]; then
            if test_ssh_connection "$server"; then
                ((successful++))
            else
                ((failed++))
            fi
        else
            if install_on_server "$server" "$server_number" "$total"; then
                ((successful++))
            else
                ((failed++))
            fi
        fi
        
        # Add a small delay between servers
        if [[ $i -lt $((total-1)) ]]; then
            sleep 2
        fi
    done
    
    # Print summary
    echo ""
    print_status "$BLUE" "=== Installation Summary ==="
    print_success "Successful: $successful"
    if [[ $failed -gt 0 ]]; then
        print_error "Failed: $failed"
    fi
    print_status "$BLUE" "Total: $total"
    
    # Log summary
    log_message "SUMMARY: Successful=$successful, Failed=$failed, Total=$total"
    
    if [[ $failed -eq 0 ]]; then
        print_success "All installations completed successfully!"
        exit 0
    else
        print_warning "Some installations failed. Check the log file for details: $LOG_FILE"
        exit 1
    fi
}

# Run main function
main "$@" 