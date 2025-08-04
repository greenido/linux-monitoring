#!/bin/bash

# SSH Access Fix Script
# This script helps fix SSH access issues by adding SSH keys to servers

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
    echo "  -m, --method METHOD Method to add key (password|manual)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Methods:"
    echo "  password  - Use password authentication to add the key"
    echo "  manual    - Provide manual instructions"
    echo ""
    echo "Examples:"
    echo "  $0 -m password server.example.com"
    echo "  $0 -m manual -u admin server.example.com"
}

# Default values
SSH_KEY_PATH="~/.ssh/your-key.pem"
SSH_USERNAME="ubuntu"
SSH_PORT="22"
METHOD="manual"

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
        -m|--method)
            METHOD="$2"
            shift 2
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

if [[ "$METHOD" != "password" && "$METHOD" != "manual" ]]; then
    print_error "Invalid method: $METHOD. Use 'password' or 'manual'"
    exit 1
fi

# Main function
fix_ssh_access() {
    local server="$1"
    
    print_info "=== SSH Access Fix for $server ==="
    print_info "SSH Key: $SSH_KEY_PATH"
    print_info "Username: $SSH_USERNAME"
    print_info "Port: $SSH_PORT"
    print_info "Method: $METHOD"
    echo ""
    
    # Expand SSH key path
    SSH_KEY_PATH=$(eval echo "$SSH_KEY_PATH")
    
    # Check if SSH key exists
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        print_error "SSH key not found: $SSH_KEY_PATH"
        exit 1
    fi
    
    # Get the public key
    local pubkey_file="${SSH_KEY_PATH}.pub"
    if [[ ! -f "$pubkey_file" ]]; then
        print_info "Public key not found, generating from private key..."
        ssh-keygen -y -f "$SSH_KEY_PATH" > "$pubkey_file"
        print_success "Generated public key: $pubkey_file"
    fi
    
    local public_key=$(cat "$pubkey_file")
    
    if [[ "$METHOD" == "password" ]]; then
        print_info "Attempting to add SSH key using password authentication..."
        
        # Try to use ssh-copy-id with password
        if command -v sshpass >/dev/null 2>&1; then
            print_info "sshpass found, attempting automated key addition..."
            read -s -p "Enter password for $SSH_USERNAME@$server: " password
            echo
            
            if sshpass -p "$password" ssh-copy-id -i "$pubkey_file" -p "$SSH_PORT" "$SSH_USERNAME@$server" 2>/dev/null; then
                print_success "SSH key added successfully!"
                test_connection "$server"
            else
                print_error "Failed to add SSH key automatically"
                print_manual_instructions "$server" "$public_key"
            fi
        else
            print_warning "sshpass not found. Please install it or use manual method."
            print_manual_instructions "$server" "$public_key"
        fi
    else
        print_manual_instructions "$server" "$public_key"
    fi
}

# Function to test SSH connection
test_connection() {
    local server="$1"
    
    print_info "Testing SSH connection..."
    if ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no "$SSH_USERNAME@$server" "echo 'SSH connection successful'" 2>/dev/null; then
        print_success "SSH connection successful! You can now use the bulk install script."
    else
        print_error "SSH connection still failed after adding the key"
        print_info "Please check the server's SSH configuration"
    fi
}

# Function to print manual instructions
print_manual_instructions() {
    local server="$1"
    local public_key="$2"
    
    echo ""
    print_warning "=== Manual SSH Key Addition Instructions ==="
    print_info "1. Connect to the server using password authentication:"
    print_info "   ssh -p $SSH_PORT $SSH_USERNAME@$server"
    print_info ""
    print_info "2. Add your public key to the authorized_keys file:"
    print_info "   mkdir -p ~/.ssh"
    print_info "   echo '$public_key' >> ~/.ssh/authorized_keys"
    print_info "   chmod 700 ~/.ssh"
    print_info "   chmod 600 ~/.ssh/authorized_keys"
    print_info ""
    print_info "3. Or use ssh-copy-id (if you have password access):"
    print_info "   ssh-copy-id -i $SSH_KEY_PATH -p $SSH_PORT $SSH_USERNAME@$server"
    print_info ""
    print_info "4. Test the connection:"
    print_info "   ssh -i $SSH_KEY_PATH -p $SSH_PORT $SSH_USERNAME@$server"
    echo ""
    print_info "Your public key to add:"
    echo "$public_key"
    echo ""
}

# Run the fix
fix_ssh_access "$SERVER" 