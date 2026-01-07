#!/bin/bash

# Yardura Server Provisioning Script
# Usage: ./provision.sh <SERVER_IP> [SSH_ALLOW_CIDR]
# Example: ./provision.sh 137.184.165.166 203.0.113.10/32

SERVER=$1
KEY_PATH='/Users/aydendunham/.ssh/id_ed25519'
DEPLOY_USER="deploy"
SSH_ALLOW_CIDR=${2:-""}

if [ -z "$SERVER" ]; then
  echo "Usage: ./provision.sh <SERVER_IP> [SSH_ALLOW_CIDR]"
  exit 1
fi

echo "🚀 Provisioning server at $SERVER..."

# Add host key to known_hosts to avoid manual verification
ssh-keyscan -H "$SERVER" >> ~/.ssh/known_hosts 2>/dev/null

# Determine which SSH user we can use (root may be disabled after first hardening).
SSH_TARGET_USER=""
if ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=no "root@$SERVER" "echo ok" >/dev/null 2>&1; then
  SSH_TARGET_USER="root"
elif ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=no "$DEPLOY_USER@$SERVER" "echo ok" >/dev/null 2>&1; then
  SSH_TARGET_USER="$DEPLOY_USER"
else
  echo "❌ Unable to SSH into $SERVER as root or $DEPLOY_USER using $KEY_PATH"
  echo "   - Confirm you added the correct public key in DigitalOcean"
  echo "   - Confirm Cloud Firewall allows SSH from your IP"
  echo "   - Try: ssh -i $KEY_PATH $DEPLOY_USER@$SERVER"
  exit 1
fi

echo "🔐 Using SSH user: $SSH_TARGET_USER@$SERVER"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "$SSH_TARGET_USER@$SERVER" "
  set -e
  SSH_ALLOW_CIDR=\"$SSH_ALLOW_CIDR\"
  export DEBIAN_FRONTEND=noninteractive
  SUDO=''
  if [ \"\$(id -u)\" != \"0\" ]; then
    SUDO='sudo'
  fi

  # If we are not root, we need non-interactive sudo to proceed.
  # If sudo prompts for a password, provisioning cannot continue over non-interactive SSH.
  if [ \"\$SUDO\" = \"sudo\" ]; then
    # Use an allow-listed sudo command as the check (some sudoers setups don't allow `sudo true`).
    if ! sudo -n /bin/mkdir -p /tmp/sudo-nopasswd-check >/dev/null 2>&1; then
      echo \"❌ deploy user cannot sudo non-interactively yet.\"
      echo \"   Fix (one-time), then re-run provision.sh:\"
      echo \"\"
      echo \"   Option A (recommended): DigitalOcean Droplet Console as root:\"
      echo \"     cat > /etc/sudoers.d/deploy-automation <<'EOF'\"\n\"deploy ALL=(ALL) NOPASSWD: /bin/mkdir, /bin/chown, /bin/chmod, /bin/cp, /bin/rm, /bin/ln, /usr/bin/find, /usr/bin/apt-get, /usr/bin/npm, /usr/bin/tee, /usr/bin/sed, /usr/bin/curl, /usr/sbin/ufw, /usr/sbin/nginx, /bin/systemctl, /usr/bin/journalctl, /usr/sbin/usermod, /usr/sbin/adduser, /bin/bash\"\n\"EOF\"
      echo \"     chmod 440 /etc/sudoers.d/deploy-automation\"
      echo \"     usermod -aG sudo deploy\"
      echo \"\"
      echo \"   Option B (no Console needed; works if 'sudo cp' is already passwordless):\"
      echo \"     ssh $DEPLOY_USER@$SERVER\"
      echo \"     cat > /tmp/deploy-automation <<'EOF'\"\n\"deploy ALL=(ALL) NOPASSWD: /bin/mkdir, /bin/chown, /bin/chmod, /bin/cp, /bin/rm, /bin/ln, /usr/bin/find, /usr/bin/apt-get, /usr/bin/npm, /usr/bin/tee, /usr/bin/sed, /usr/bin/curl, /usr/sbin/ufw, /usr/sbin/nginx, /bin/systemctl, /usr/bin/journalctl, /usr/sbin/usermod, /usr/sbin/adduser, /bin/bash\"\n\"EOF\"
      echo \"     sudo cp /tmp/deploy-automation /etc/sudoers.d/deploy-automation\"
      echo \"     sudo chmod 440 /etc/sudoers.d/deploy-automation\"
      echo \"\"
      exit 2
    fi
  fi
  
  echo '📦 Updating system packages...'
  \$SUDO apt-get update
  # Avoid interactive dpkg prompts (e.g. sshd_config). Keep local config by default.
  \$SUDO apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
  
  echo '📦 Installing essential tools...'
  \$SUDO apt-get install -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold curl git unzip ufw fail2ban nginx certbot python3-certbot-nginx unattended-upgrades

  echo '🤖 Ensuring DigitalOcean droplet agent is installed and running...'
  # DO Console relies on the droplet-agent. The website can be up while the console hangs if this agent is down.
  # On DigitalOcean images it is often preinstalled, but we defensively ensure it is enabled.
  \$SUDO apt-get install -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold droplet-agent 2>/dev/null || true
  \$SUDO systemctl enable --now droplet-agent 2>/dev/null || true
  \$SUDO systemctl restart droplet-agent 2>/dev/null || true
  
  echo '📦 Installing Node.js 20...'
  curl -fsSL https://deb.nodesource.com/setup_20.x | \$SUDO bash -
  \$SUDO apt-get install -y nodejs
  
  echo '📦 Installing PM2...'
  \$SUDO npm install -g pm2

  # Note: Redis is handled by Upstash (cloud Redis), no local install needed

  echo '🛡️  Configuring fail2ban to avoid banning the allowed SSH CIDR (if provided)...'
  # IMPORTANT: If SSH_ALLOW_CIDR is provided, we ensure fail2ban never bans it.
  # This prevents the "SSH authenticates then immediately disconnects" experience caused by bans.
  if [ -n \"\$SSH_ALLOW_CIDR\" ]; then
    cat << EOF | \$SUDO tee /etc/fail2ban/jail.d/sshd.local >/dev/null
[sshd]
enabled = true
ignoreip = 127.0.0.1/8 ::1 \$SSH_ALLOW_CIDR
bantime = 1h
findtime = 10m
maxretry = 6
EOF
    \$SUDO systemctl restart fail2ban 2>/dev/null || true
  fi

  echo '👤 Creating non-root deploy user ($DEPLOY_USER)...'
  if ! id -u $DEPLOY_USER >/dev/null 2>&1; then
    \$SUDO adduser --disabled-password --gecos '' $DEPLOY_USER
  fi
  \$SUDO usermod -aG sudo $DEPLOY_USER
  \$SUDO mkdir -p /home/$DEPLOY_USER/.ssh
  if [ -f /root/.ssh/authorized_keys ]; then
    \$SUDO cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys
  fi
  \$SUDO chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  \$SUDO chmod 700 /home/$DEPLOY_USER/.ssh
  \$SUDO chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true

  echo '🔑 Configuring passwordless sudo for deploy automation (limited commands)...'
  cat << 'EOF' | \$SUDO tee /etc/sudoers.d/deploy-automation >/dev/null
deploy ALL=(ALL) NOPASSWD: /bin/mkdir, /bin/chown, /bin/chmod, /bin/cp, /bin/rm, /bin/ln, /usr/bin/find, /usr/bin/apt-get, /usr/bin/npm, /usr/bin/tee, /usr/bin/sed, /usr/bin/curl, /usr/bin/certbot, /usr/sbin/ufw, /usr/sbin/nginx, /bin/systemctl, /usr/bin/systemctl, /usr/bin/journalctl, /usr/sbin/usermod, /usr/sbin/adduser, /bin/bash
EOF
  \$SUDO chmod 440 /etc/sudoers.d/deploy-automation

  echo '🔐 Hardening SSH (disable password auth, reduce brute-force)...'
  SSHD=/etc/ssh/sshd_config
  \$SUDO cp \$SSHD \$SSHD.bak.\$(date +%Y%m%d_%H%M%S)
  # Disable password auth (key-only)
  \$SUDO sed -i 's/^#\\?PasswordAuthentication\\s\\+.*/PasswordAuthentication no/' \$SSHD
  \$SUDO sed -i 's/^#\\?KbdInteractiveAuthentication\\s\\+.*/KbdInteractiveAuthentication no/' \$SSHD
  \$SUDO sed -i 's/^#\\?ChallengeResponseAuthentication\\s\\+.*/ChallengeResponseAuthentication no/' \$SSHD
  \$SUDO sed -i 's/^#\\?PubkeyAuthentication\\s\\+.*/PubkeyAuthentication yes/' \$SSHD
  # Disable root SSH login entirely (use deploy user + sudo)
  if grep -q '^#\\?PermitRootLogin' \$SSHD; then
    \$SUDO sed -i 's/^#\\?PermitRootLogin\\s\\+.*/PermitRootLogin no/' \$SSHD
  else
    echo 'PermitRootLogin no' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  # Allow only the deploy user to SSH
  if grep -q '^#\\?AllowUsers' \$SSHD; then
    \$SUDO sed -i 's/^#\\?AllowUsers\\s\\+.*/AllowUsers $DEPLOY_USER/' \$SSHD
  else
    echo 'AllowUsers $DEPLOY_USER' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  # Disable forwarding features we don't need
  if grep -q '^#\\?AllowTcpForwarding' \$SSHD; then
    \$SUDO sed -i 's/^#\\?AllowTcpForwarding\\s\\+.*/AllowTcpForwarding no/' \$SSHD
  else
    echo 'AllowTcpForwarding no' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  if grep -q '^#\\?X11Forwarding' \$SSHD; then
    \$SUDO sed -i 's/^#\\?X11Forwarding\\s\\+.*/X11Forwarding no/' \$SSHD
  else
    echo 'X11Forwarding no' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  # Reduce brute-force effectiveness
  if grep -q '^#\\?MaxAuthTries' \$SSHD; then
    \$SUDO sed -i 's/^#\\?MaxAuthTries\\s\\+.*/MaxAuthTries 3/' \$SSHD
  else
    echo 'MaxAuthTries 3' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  if grep -q '^#\\?LoginGraceTime' \$SSHD; then
    \$SUDO sed -i 's/^#\\?LoginGraceTime\\s\\+.*/LoginGraceTime 20/' \$SSHD
  else
    echo 'LoginGraceTime 20' | \$SUDO tee -a \$SSHD >/dev/null
  fi
  \$SUDO systemctl restart ssh || \$SUDO systemctl restart sshd
  
  echo '🔥 Configuring Firewall (UFW)...'
  if [ -n \"\$SSH_ALLOW_CIDR\" ]; then
    echo \"Restricting SSH to: \$SSH_ALLOW_CIDR\"
    \$SUDO ufw allow from \$SSH_ALLOW_CIDR to any port 22 proto tcp
  else
    \$SUDO ufw allow OpenSSH
  fi
  \$SUDO ufw allow 'Nginx Full'
  # Egress lockdown: prevents the droplet from being used to spray arbitrary UDP/TCP floods if compromised.
  # Allow only what the app typically needs (DNS, NTP, HTTP/HTTPS, and Supabase pooler port).
  \$SUDO ufw default deny outgoing
  \$SUDO ufw allow out 53/tcp
  \$SUDO ufw allow out 53/udp
  \$SUDO ufw allow out 123/udp
  \$SUDO ufw allow out 80/tcp
  \$SUDO ufw allow out 443/tcp
  # Supabase pooled Postgres commonly uses 6543, direct connection uses 5432
  \$SUDO ufw allow out 6543/tcp
  \$SUDO ufw allow out 5432/tcp
  # Redis (Upstash) uses 6379
  \$SUDO ufw allow out 6379/tcp
  # Enable IPv6 in UFW (required for Supabase direct connection)
  \$SUDO sed -i 's/^IPV6=no/IPV6=yes/' /etc/default/ufw 2>/dev/null || true
  \$SUDO ufw --force enable

  echo '🛡️ Enabling Fail2ban for SSH...'
  cat << 'EOF' | \$SUDO tee /etc/fail2ban/jail.d/sshd.local >/dev/null
[sshd]
enabled = true
port = ssh
maxretry = 5
findtime = 10m
bantime = 1h
EOF
  \$SUDO systemctl enable fail2ban
  \$SUDO systemctl restart fail2ban

  echo '🔄 Enabling automatic security updates...'
  # Avoid `dpkg-reconfigure` here; it can try to prompt even when DEBIAN_FRONTEND=noninteractive.
  # The package is installed above; enabling the service is sufficient.
  \$SUDO systemctl enable --now unattended-upgrades 2>/dev/null || true

  echo '🌐 Configuring IPv6 (required for Supabase direct connection)...'
  # Supabase direct database only has IPv6. We need IPv6 enabled on the droplet.
  # Fetch IPv6 info from DigitalOcean metadata
  IPV6_ADDR=\$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv6/address 2>/dev/null || echo '')
  IPV6_GW=\$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv6/gateway 2>/dev/null || echo '')
  
  if [ -n \"\$IPV6_ADDR\" ] && [ -n \"\$IPV6_GW\" ]; then
    echo \"Found IPv6: \$IPV6_ADDR via \$IPV6_GW\"
    cat << NETPLAN_EOF | \$SUDO tee /etc/netplan/60-ipv6.yaml >/dev/null
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - \$IPV6_ADDR/64
      routes:
        - to: default
          via: \$IPV6_GW
NETPLAN_EOF
    \$SUDO chmod 600 /etc/netplan/60-ipv6.yaml
    \$SUDO bash -c 'netplan apply' || echo 'Warning: netplan apply failed, IPv6 may need manual config'
    sleep 2
    # Verify
    if ip -6 addr show eth0 | grep -q \"\$IPV6_ADDR\"; then
      echo '✅ IPv6 configured successfully'
    else
      echo '⚠️ IPv6 address not showing yet - may take a moment'
    fi
  else
    echo '⚠️ IPv6 not enabled in DigitalOcean. Enable it in Droplet > Networking > Public IPv6 and re-run.'
  fi
  
  echo '📂 Setting up directory structure...'
  \$SUDO mkdir -p /var/www/insightscoop
  \$SUDO chown -R deploy:deploy /var/www/insightscoop
  \$SUDO chmod -R 755 /var/www/insightscoop
  
  echo '🌐 Configuring Nginx...'
  cat << 'EOF' | \$SUDO tee /etc/nginx/sites-available/getinsightscoop.com >/dev/null
server {
    listen 80;
server_name getinsightscoop.com www.getinsightscoop.com;

    # Increase body size limit for file uploads (videos can be 50-100MB+)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Also set body size for proxy (videos need more space)
        client_max_body_size 100M;
        
        # Increase timeouts for large uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

  # Enable the site
  \$SUDO ln -sf /etc/nginx/sites-available/getinsightscoop.com /etc/nginx/sites-enabled/
  \$SUDO rm -f /etc/nginx/sites-enabled/default
  \$SUDO nginx -t
  \$SUDO systemctl reload nginx

  echo '✅ Provisioning complete!'
  echo ''
  echo '👉 NEXT STEPS:'
  echo '   1. If IPv6 was not configured (metadata unavailable), enable it in DigitalOcean:'
  echo '      Droplet > Networking > Public IPv6 Address > Enable'
  echo '      Then power cycle the droplet and re-run this script.'
  echo '   2. Run ./deploy.sh to push the code.'
  echo '   3. After deploy, run: certbot --nginx -d getinsightscoop.com -d www.getinsightscoop.com'
  echo ''
  echo '🔐 Security: SSH passwords disabled, root login disabled. Use deploy@SERVER with SSH key.'
  echo '🌐 IPv6: Required for Supabase direct connection (PostGIS).'
"



  echo '📂 Setting up directory structure...'
  \$SUDO mkdir -p /var/www/insightscoop
  \$SUDO chown -R deploy:deploy /var/www/insightscoop
  \$SUDO chmod -R 755 /var/www/insightscoop
  
  echo '🌐 Configuring Nginx...'
  cat << 'EOF' | \$SUDO tee /etc/nginx/sites-available/getinsightscoop.com >/dev/null
server {
    listen 80;
server_name getinsightscoop.com www.getinsightscoop.com;

    # Increase body size limit for file uploads (videos can be 50-100MB+)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Also set body size for proxy (videos need more space)
        client_max_body_size 100M;
        
        # Increase timeouts for large uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

  # Enable the site
  \$SUDO ln -sf /etc/nginx/sites-available/getinsightscoop.com /etc/nginx/sites-enabled/
  \$SUDO rm -f /etc/nginx/sites-enabled/default
  \$SUDO nginx -t
  \$SUDO systemctl reload nginx

  echo '✅ Provisioning complete!'
  echo ''
  echo '👉 NEXT STEPS:'
  echo '   1. If IPv6 was not configured (metadata unavailable), enable it in DigitalOcean:'
  echo '      Droplet > Networking > Public IPv6 Address > Enable'
  echo '      Then power cycle the droplet and re-run this script.'
  echo '   2. Run ./deploy.sh to push the code.'
  echo '   3. After deploy, run: certbot --nginx -d getinsightscoop.com -d www.getinsightscoop.com'
  echo ''
  echo '🔐 Security: SSH passwords disabled, root login disabled. Use deploy@SERVER with SSH key.'
  echo '🌐 IPv6: Required for Supabase direct connection (PostGIS).'
"

