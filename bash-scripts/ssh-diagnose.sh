#!/bin/bash

# SSH Connection Diagnostic Script
# This script helps diagnose SSH connection issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

print_success() {
    print_status "$GREEN" "$1"
}

print_error() {
    print_status "$RED" "$1"
}

print_warning() {
    print_status "$YELLOW" "$1"
}

print_info() {
    print_status "$BLUE" "$1"
}

show_usage() {
    echo "Usage: $0 [OPTIONS] SERVER"
    echo ""
    echo "Options:"
    echo "  -k, --key KEY       SSH key path (default: ~/.ssh/your-key.pem)"
    echo "  -u, --user USER     SSH username (default: ubuntu)"
    echo "  -p, --port PORT     SSH port (default: 22)"
    echo "  -v, --verbose       Verbose SSH output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 server.example.com"
    echo "  $0 -u admin -k ~/.ssh/my-key.pem server.example.com"
    echo "  $0 -v -p 2222 myserver.com"
}

# Default values
SSH_KEY_PATH="~/.ssh/your-key.pem"
SSH_USERNAME="ubuntu"
SSH_PORT="22"
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--key)
            SSH_KEY_PATH="$2"
            shift 2
            ;;
        -u|--user)
            SSH_USERNAME="$2"
            shift 2
            ;;
        -p|--port)
            SSH_PORT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            SERVER="$1"
            shift
            ;;
    esac
done

if [[ -z "$SERVER" ]]; then
    print_error "Server address is required"
    show_usage
    exit 1
fi

# Main diagnostic function
diagnose_ssh() {
    local server="$1"
    
    print_info "=== SSH Connection Diagnostic for $server ==="
    print_info "SSH Key: $SSH_KEY_PATH"
    print_info "Username: $SSH_USERNAME"
    print_info "Port: $SSH_PORT"
    print_info "Server: $server"
    echo ""
    
    # Expand SSH key path
    SSH_KEY_PATH=$(eval echo "$SSH_KEY_PATH")
    
    # Check if SSH key exists
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        print_error "SSH key not found: $SSH_KEY_PATH"
        exit 1
    fi
    
    # Check SSH key permissions
    local key_perms=$(stat -f "%Lp" "$SSH_KEY_PATH" 2>/dev/null || stat -c "%a" "$SSH_KEY_PATH" 2>/dev/null)
    if [[ "$key_perms" != "600" ]]; then
        print_warning "SSH key permissions should be 600, current: $key_perms"
        print_info "Fixing permissions..."
        chmod 600 "$SSH_KEY_PATH"
    else
        print_success "SSH key permissions are correct (600)"
    fi
    
    # Test basic connectivity
    print_info "Testing basic connectivity to $server:$SSH_PORT..."
    if nc -z -w5 "$server" "$SSH_PORT" 2>/dev/null; then
        print_success "Port $SSH_PORT is open on $server"
    else
        print_error "Cannot connect to port $SSH_PORT on $server"
        print_info "This could mean:"
        print_info "  - Server is down"
        print_info "  - Firewall is blocking port $SSH_PORT"
        print_info "  - SSH is not running on port $SSH_PORT"
        return 1
    fi
    
    # Test SSH connection
    print_info "Testing SSH connection..."
    
    local ssh_opts="-i $SSH_KEY_PATH -p $SSH_PORT -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no"
    
    if [[ "$VERBOSE" == true ]]; then
        print_info "Running SSH with verbose output..."
        ssh -v $ssh_opts "$SSH_USERNAME@$server" "echo 'SSH connection successful'" 2>&1
    else
        if ssh $ssh_opts "$SSH_USERNAME@$server" "echo 'SSH connection successful'" 2>/dev/null; then
            print_success "SSH connection successful!"
            return 0
        else
            print_error "SSH connection failed"
        fi
    fi
    
    # Provide troubleshooting steps
    echo ""
    print_warning "=== Troubleshooting Steps ==="
    print_info "1. Check if the server is running and accessible"
    print_info "2. Verify your SSH key is added to the server's authorized_keys:"
    print_info "   ssh-copy-id -i $SSH_KEY_PATH $SSH_USERNAME@$server"
    print_info "3. Check if the server uses a different username"
    print_info "4. Verify the server's SSH configuration allows key authentication"
    print_info "5. Try connecting with password authentication first:"
    print_info "   ssh -p $SSH_PORT $SSH_USERNAME@$server"
    print_info "6. Check server logs: sudo journalctl -u ssh"
    print_info "7. Try with different SSH options:"
    print_info "   ssh -v -i $SSH_KEY_PATH -p $SSH_PORT $SSH_USERNAME@$server"
    
    return 1
}

# Run diagnostic
diagnose_ssh "$SERVER" 