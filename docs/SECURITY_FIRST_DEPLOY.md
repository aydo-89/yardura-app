## Security-first droplet workflow (prevents repeat DO compromise reports)

### Why this doc exists
Fresh public Droplets are scanned constantly. If SSH (22) is open to the world, attackers can exploit vulnerabilities or brute-force weak setups within minutes. We also observed real compromise indicators on a droplet (attacker-installed `hping3`, a persistence unit `supdate.service`, and malware binaries under `/etc/de`).

### Non-negotiables
- **Attach a DigitalOcean Cloud Firewall BEFORE you ever SSH in.**
- **Restrict inbound SSH (22) to your current public IP (/32) only.**
- **Disable root SSH login** and use a non-root `deploy` user.
- **Lock down outbound traffic (egress)** to stop the droplet being used for UDP/TCP floods.
- **Rotate all secrets** after any suspected compromise.

### Step 0 — DigitalOcean account hardening
- Enable **2FA**.
- Rotate/remove any **API tokens** you don’t need.
- Review account members + SSH keys and remove anything unexpected.

### Step 1 — Create droplet + attach Cloud Firewall immediately
Create the droplet, then in DigitalOcean:
- Networking → Firewalls → Create/Update firewall
- Attach it to the droplet

Inbound rules:
- **SSH (TCP 22)**: `YOUR_PUBLIC_IP/32` only
- **HTTP (TCP 80)**: `0.0.0.0/0` and `::/0`
- **HTTPS (TCP 443)**: `0.0.0.0/0` and `::/0`

Outbound rules:
- Allow all (Cloud Firewall outbound is optional). We enforce outbound via UFW in provisioning.

### Step 2 — Provision (locks SSH + UFW + egress)
From your Mac:

```bash
./provision.sh <DROPLET_IP> <YOUR_PUBLIC_IP>/32
```

What provisioning does:
- Creates `deploy` user
- Disables password auth
- Disables root SSH login + restricts `AllowUsers` to deploy
- Enables fail2ban
- Enables UFW with:
  - inbound: 22 (your IP), 80/443
  - outbound: DNS/NTP/HTTP/HTTPS + 6543/tcp

### Step 3 — Deploy

```bash
./deploy.sh
```

### Step 4 — Rotate secrets
Rotate and update server `.env` (then redeploy):
- `NEXTAUTH_SECRET`
- OpenAI API key
- Twilio auth token / keys
- Supabase service role key

### If you get another DO abuse email
Assume compromise.
- Power off droplet.
- Snapshot for forensics only if you need it.
- Destroy and rebuild.
- Re-check Cloud Firewall: SSH must be **your IP only**.
- Consider using a VPN with stable egress IP (Tailscale exit node, etc.) so SSH restriction is reliable.
