# VPS Migration Guide

## When to Migrate

Move from Railway to VPS when:
- Monthly Railway costs exceed $20/month
- You need persistent background processes
- You want full control over the runtime environment
- You need custom networking (Tailscale, VPN, etc.)

## Recommended VPS Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 10 GB SSD | 20 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

**Providers**: Hetzner ($4/mo), DigitalOcean ($6/mo), Vultr ($5/mo), Contabo ($4/mo)

## Migration Steps

### 1. Provision VPS

```bash
# SSH into your new VPS
ssh root@your-vps-ip

# Create a non-root user
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### 2. Install Dependencies

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Enable pnpm
sudo corepack enable
corepack prepare pnpm@latest --activate

# Git
sudo apt-get install -y git

# Process manager
sudo npm install -g pm2
```

### 3. Clone and Setup

```bash
cd /opt
sudo mkdir affiliate-studio && sudo chown deploy:deploy affiliate-studio
cd affiliate-studio

git clone <repo-url> .
pnpm install
cp .env.example .env
# Edit .env with your production values
nano .env
```

### 4. Build and Run

```bash
# Build production bundle
pnpm run build

# Start with PM2
pm2 start "pnpm start" --name affiliate-studio
pm2 save
pm2 startup
```

### 5. Migrate Data from Railway

```bash
# On Railway, download the SQLite database
# Railway → Service → Volumes → Download

# Copy to VPS
scp claw-empire.sqlite deploy@your-vps-ip:/opt/affiliate-studio/data/
```

### 6. Reverse Proxy (Caddy)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:8790
}
```

```bash
sudo systemctl reload caddy
```

### 7. Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## Docker Alternative

Instead of bare-metal, use Docker Compose:

```bash
# Copy docker-compose.yml and Dockerfile to VPS
# Edit .env
docker compose up -d
```

## Monitoring

```bash
# Check status
pm2 status

# View logs
pm2 logs affiliate-studio

# Monitor resources
pm2 monit
```

## Backup Strategy

```bash
# Cron job for daily SQLite backup
crontab -e
# Add:
0 3 * * * cp /opt/affiliate-studio/data/claw-empire.sqlite /backups/claw-empire-$(date +\%Y\%m\%d).sqlite
```
