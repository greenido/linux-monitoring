#!/bin/bash

# remote-install.sh
# Remotely installs disk-monitor on a target machine via SSH, preserving all running Docker containers.

set -e

usage() {
  echo "Usage: $0 [-i <private_key>] <user@host> <path/to/install-disk-monitor.sh> [<slack_webhook_url>]"
  exit 1
}

# Parse optional -i <private_key> argument
KEY_ARG=""
if [ "$1" = "-i" ]; then
  if [ -z "$2" ]; then
    usage
  fi
  KEY_ARG="-i $2"
  shift 2
fi

if [ $# -lt 2 ]; then
  usage
fi

REMOTE_HOST="$1"
INSTALL_SCRIPT_PATH="$2"
SLACK_WEBHOOK_URL="$3"

# Extract username from REMOTE_HOST
REMOTE_USER=$(echo "$REMOTE_HOST" | cut -d@ -f1)

# Get list of running Docker containers on remote host
RUNNING_CONTAINERS=$(ssh $KEY_ARG "$REMOTE_HOST" "docker ps -q" 2>/dev/null || echo "")

# Create a temporary directory in the user's home directory
TEMP_DIR=$(ssh $KEY_ARG "$REMOTE_HOST" "mktemp -d ~/disk-monitor-install.XXXXXX" 2>/dev/null || echo "~/disk-monitor-temp")

# Copy the install script and JS scripts to the remote host
echo "Copying files to remote server..."
if ! scp $KEY_ARG "$INSTALL_SCRIPT_PATH" "$REMOTE_HOST:$TEMP_DIR/install-disk-monitor.sh"; then
  echo "Error: Failed to copy install script to remote server"
  exit 1
fi

# Get the absolute path of the install script
SCRIPT_DIR="$(cd "$(dirname "$INSTALL_SCRIPT_PATH")" && pwd)"
# JS files are one level up from the bash-scripts directory
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

if ! scp $KEY_ARG "$PARENT_DIR/disk-monitor.js" "$REMOTE_HOST:$TEMP_DIR/disk-monitor.js"; then
  echo "Error: Failed to copy disk-monitor.js to remote server"
  exit 1
fi

if ! scp $KEY_ARG "$PARENT_DIR/system-health-monitor.js" "$REMOTE_HOST:$TEMP_DIR/system-health-monitor.js"; then
  echo "Error: Failed to copy system-health-monitor.js to remote server"
  exit 1
fi

echo "Files copied successfully to $TEMP_DIR"

# Run the install script on the remote host, passing the Slack webhook if provided
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  ssh -tt $KEY_ARG "$REMOTE_HOST" "export SLACK_WEBHOOK_URL='$SLACK_WEBHOOK_URL'; cd $TEMP_DIR && sudo bash install-disk-monitor.sh"
else
  ssh -tt $KEY_ARG "$REMOTE_HOST" "cd $TEMP_DIR && sudo bash install-disk-monitor.sh"
fi

# Clean up temporary files
ssh $KEY_ARG "$REMOTE_HOST" "rm -rf $TEMP_DIR" 2>/dev/null || true

# Restart any Docker containers that were running before installation
if [ -n "$RUNNING_CONTAINERS" ]; then
  echo "Ensuring all Docker containers are running..."
  ssh $KEY_ARG "$REMOTE_HOST" "echo '$RUNNING_CONTAINERS' | xargs -n 1 docker start || true"
fi

echo "Remote installation complete. All Docker containers should be running."
