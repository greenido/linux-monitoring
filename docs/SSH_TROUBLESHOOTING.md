# SSH Connection Troubleshooting Guide

This guide helps you resolve SSH connection issues when using the bulk installation script.

## 🚨 Common SSH Issues

### 1. **Permission denied (publickey)**

This is the most common issue and means the server doesn't have your SSH key in its `authorized_keys` file.

**Symptoms:**
```
debug1: Authentications that can continue: publickey
debug1: No more authentication methods to try.
ubuntu@server.com: Permission denied (publickey).
```

**Solution:**
Use the `fix-ssh-access.sh` script to add your key to the server.

## 🛠️ Tools Provided

### 1. **SSH Diagnostic Script** (`ssh-diagnose.sh`)

Diagnoses SSH connection issues with detailed output.

```bash
# Basic diagnosis
./ssh-diagnose.sh server.example.com

# Verbose diagnosis
./ssh-diagnose.sh -v server.example.com

# Test with different username
./ssh-diagnose.sh -u admin server.example.com

# Test with different port
./ssh-diagnose.sh -p 2222 server.example.com
```

### 2. **SSH Access Fix Script** (`fix-ssh-access.sh`)

Helps add your SSH key to servers that need it.

```bash
# Get manual instructions
./fix-ssh-access.sh server.example.com

# Use password authentication (if sshpass is installed)
./fix-ssh-access.sh -m password server.example.com
```

### 3. **Enhanced Bulk Install Script** (`bulk-install.sh`)

Now includes better error handling and troubleshooting tips.

```bash
# Test SSH connections only
./bulk-install.sh --test

# Use verbose output
./bulk-install.sh --verbose

# Use different username
./bulk-install.sh --user admin
```

## 🔧 Step-by-Step Resolution

### Step 1: Diagnose the Issue

```bash
./ssh-diagnose.sh -v server.example.com
```

This will tell you exactly what's wrong with the SSH connection.

### Step 2: Fix SSH Access

If the issue is missing SSH key:

```bash
./fix-ssh-access.sh server.example.com
```

This will provide you with:
- Your public key to add to the server
- Step-by-step instructions
- Alternative methods

### Step 3: Add the Key to the Server

**Option A: Manual Method**
1. Connect to the server using password:
   ```bash
   ssh ubuntu@server.example.com
   ```

2. Add your public key:
   ```bash
   mkdir -p ~/.ssh
   echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDcPey5WYhXsRogKLEgF1pm7KlGuDwiBvk14q2Wa42NChuVN+ubN/M9RUzVPlQYV98BdOvso5XIy7hBx9PKiK7ybJT3DF6Hkx3tt+inAf2IXqKSze8QE4nGE/BJVrjVdmfDay8dR6AKpeIqlcag5jie7H5FxgcSSJVDaeMk1HxYuGK0HDdI/MMSy82/Q88elckXUBWfK3GO4jQrTa531tQ7W9BldgHJcTupj4G4Y5+GfHz9MFLTc1rQhMxx1pGf4r10i/kf9CgQNtPS6sdxUDaIcIFFbMfvfHGw9a1okOm1ToasHyRDNyJeoCwmju+wbcFghUlnaphyJftcmfecOwhN' >> ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

**Option B: Using ssh-copy-id**
```bash
ssh-copy-id -i ~/.ssh/your-key.pem ubuntu@server.example.com
```

### Step 4: Test the Connection

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@server.example.com "echo 'SSH connection successful'"
```

### Step 5: Run Bulk Installation

Once SSH access is working:

```bash
./bulk-install.sh
```

## 🚀 Quick Fix Workflow

For a server with SSH issues:

1. **Diagnose:**
   ```bash
   ./ssh-diagnose.sh -v SERVER_NAME
   ```

2. **Get fix instructions:**
   ```bash
   ./fix-ssh-access.sh SERVER_NAME
   ```

3. **Add key to server** (follow the instructions provided)

4. **Test connection:**
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@SERVER_NAME
   ```

5. **Add server back to servers.txt** (remove the # comment)

6. **Run bulk install:**
   ```bash
   ./bulk-install.sh
   ```

## 🔍 Other Common Issues

### Wrong Username

Some servers use different usernames:
- `admin` instead of `ubuntu`
- `root` instead of `ubuntu`
- Custom usernames

**Solution:**
```bash
./bulk-install.sh --user admin
```

### Wrong Port

Some servers use non-standard SSH ports:
- Port 2222
- Port 22022
- Custom ports

**Solution:**
```bash
./ssh-diagnose.sh -p 2222 SERVER_NAME
```

### Server Down

If the server is completely unreachable:
- Check if the server is running
- Check firewall settings
- Check network connectivity

**Test:**
```bash
ping SERVER_NAME
nc -z -w5 SERVER_NAME 22
```

## 📋 Server Status Tracking

Update your `servers.txt` file to track server status:

```txt
# Production Servers
# server1.example.com  # SSH key needs to be added
server2.example.com
server3.example.com
app.example.com
api.example.com

# Staging Servers
staging1.example.com
staging2.example.com
staging3.example.com
staging4.example.com

# Development Servers
# dev.example.com  # Server down
```

## 🎯 Best Practices

1. **Test SSH connections first:**
   ```bash
   ./bulk-install.sh --test
   ```

2. **Use verbose mode for debugging:**
   ```bash
   ./bulk-install.sh --verbose
   ```

3. **Fix servers one by one** and add them back to the list

4. **Keep a log** of which servers have issues and why

5. **Use consistent SSH keys** across all servers

## 🆘 Getting Help

If you're still having issues:

1. Run the diagnostic script with verbose output
2. Check the server's SSH configuration
3. Verify the server is running and accessible
4. Check if the server allows key authentication
5. Try connecting with password authentication first

## 📞 Support Commands

```bash
# Check SSH key format
ssh-keygen -l -f ~/.ssh/your-key.pem

# Test SSH connection with different options
ssh -v -i ~/.ssh/your-key.pem -o ConnectTimeout=10 ubuntu@SERVER_NAME

# Check if public key exists
ls -la ~/.ssh/your-key.pem*

# Generate public key from private key
ssh-keygen -y -f ~/.ssh/your-key.pem
``` 