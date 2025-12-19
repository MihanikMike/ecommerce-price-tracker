# AWS Deployment Guide

Step-by-step guide to deploy E-Commerce Price Tracker on AWS EC2 (Ubuntu).

## Prerequisites

- AWS Free Tier account
- EC2 instance (Ubuntu 22.04/24.04 LTS)
- S3 bucket (for backups)
- SSH key pair (.pem file)

---

## Phase 1: EC2 Instance Setup

### 1.1 Configure Security Groups

In AWS Console → EC2 → Security Groups, add these inbound rules:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Your IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | 3000 | 0.0.0.0/0 | Health server (optional) |
| Custom TCP | 3002 | 0.0.0.0/0 | API server (optional, use Nginx instead) |

### 1.2 Connect to EC2

```bash
# Make key readable only by you
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

---

## Phase 2: Install Dependencies

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x
npm --version
```

### 2.3 Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.4 Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# In psql, run:
CREATE USER price_tracker_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE price_tracker OWNER price_tracker_user;
GRANT ALL PRIVILEGES ON DATABASE price_tracker TO price_tracker_user;
\q
```

### 2.5 Install Additional Tools

```bash
# Git
sudo apt install -y git

# PM2 (Process Manager)
sudo npm install -g pm2

# Nginx (Reverse Proxy)
sudo apt install -y nginx

# Playwright dependencies (for scraping)
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libpango-1.0-0 libcairo2
```

---

## Phase 3: Deploy Application

### 3.1 Clone Repository

```bash
cd ~
git clone https://github.com/MihanikMike/ecommerce-price-tracker.git
cd ecommerce-price-tracker
```

### 3.2 Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
npm run build
cd ..

# Install Playwright browsers
npx playwright install chromium
```

### 3.3 Create Environment File

```bash
nano .env
```

Add configuration:

```bash
# Database Configuration
PG_HOST=localhost
PG_PORT=5432
PG_USER=price_tracker_user
PG_PASSWORD=your_secure_password_here
PG_DATABASE=price_tracker
PG_POOL_MAX=10
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000

# Application
NODE_ENV=production
PORT=3000
API_PORT=3002
LOG_LEVEL=info

# Scraper Configuration
SCRAPER_RETRIES=3
SCRAPER_MIN_DELAY=2000
SCRAPER_MAX_DELAY=4000
SCRAPER_TIMEOUT=30000
SCRAPER_HEADLESS=true
SCRAPER_USE_PROXY=false

# Email (optional)
EMAIL_ENABLED=false
# EMAIL_PROVIDER=smtp
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_email
# SMTP_PASS=your_password
# PRICE_ALERT_EMAIL_RECIPIENTS=you@example.com

# Caching (without Redis)
CACHE_ENABLED=true
```

Save: `Ctrl+X`, then `Y`, then `Enter`

### 3.4 Run Database Migrations

```bash
npm run migrate
```

---

## Phase 4: Configure Nginx

### 4.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/price-tracker
```

Add:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or use EC2 public IP

    # Frontend (static files)
    location / {
        root /home/ubuntu/ecommerce-price-tracker/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check proxy
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 4.2 Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/price-tracker /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Phase 5: Start Application with PM2

### 5.1 Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'price-tracker-api',
      script: 'src/index.js',
      args: 'api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'price-tracker-monitor',
      script: 'src/index.js',
      args: 'monitor',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 */6 * * *',  // Restart every 6 hours
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 5.2 Start Application

```bash
# Start all apps
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with sudo)
```

### 5.3 PM2 Useful Commands

```bash
pm2 status          # View running processes
pm2 logs            # View logs
pm2 logs --lines 100  # View last 100 lines
pm2 restart all     # Restart all apps
pm2 stop all        # Stop all apps
pm2 monit           # Real-time monitoring
```

---

## Phase 6: S3 Backup Setup (Optional)

### 6.1 Install AWS CLI

```bash
sudo apt install -y awscli
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Region: us-east-1 (or your region)
# Output format: json
```

### 6.2 Create Backup Script

```bash
nano ~/backup-db.sh
```

Add:

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/price_tracker_backup_$TIMESTAMP.sql"
S3_BUCKET="your-s3-bucket-name"

# Create backup
PGPASSWORD=your_secure_password_here pg_dump -h localhost -U price_tracker_user price_tracker > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://$S3_BUCKET/backups/

# Remove local backup
rm ${BACKUP_FILE}.gz

echo "Backup completed: ${BACKUP_FILE}.gz"
```

```bash
chmod +x ~/backup-db.sh
```

### 6.3 Schedule Daily Backups

```bash
crontab -e
```

Add:

```
0 2 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backup.log 2>&1
```

---

## Phase 7: SSL/HTTPS with Let's Encrypt (Optional)

### 7.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 7.3 Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot adds auto-renewal to cron automatically
```

---

## Phase 8: Monitoring & Maintenance

### 8.1 View Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### 8.2 Check System Resources

```bash
# Memory usage
free -h

# Disk usage
df -h

# CPU and processes
htop  # Install: sudo apt install htop
```

### 8.3 Update Application

```bash
cd ~/ecommerce-price-tracker
git pull origin main
npm install
cd frontend && npm install && npm run build && cd ..
pm2 restart all
```

---

## Quick Reference

### URLs (after deployment)

| Service | URL |
|---------|-----|
| Frontend | http://YOUR-EC2-IP/ |
| API Docs | http://YOUR-EC2-IP/api |
| Health Check | http://YOUR-EC2-IP/health |

### Important Paths

| Item | Path |
|------|------|
| Application | `/home/ubuntu/ecommerce-price-tracker` |
| Environment | `/home/ubuntu/ecommerce-price-tracker/.env` |
| Nginx Config | `/etc/nginx/sites-available/price-tracker` |
| PM2 Config | `/home/ubuntu/ecommerce-price-tracker/ecosystem.config.js` |
| Logs | `pm2 logs` |

### Common Commands

```bash
# Check app status
pm2 status

# Restart app
pm2 restart all

# View logs
pm2 logs --lines 50

# Check nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# SSH into server
ssh -i your-key.pem ubuntu@<EC2-IP>
```

---

## Troubleshooting

### App won't start
```bash
# Check logs
pm2 logs price-tracker-api --lines 100

# Check .env file
cat .env

# Test database connection
PGPASSWORD=your_password psql -h localhost -U price_tracker_user -d price_tracker -c "SELECT 1"
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

### Database connection refused
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Out of memory
```bash
# Check memory
free -h

# Restart app to free memory
pm2 restart all

# Consider adding swap
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Estimated AWS Free Tier Costs

| Resource | Free Tier Limit | Notes |
|----------|-----------------|-------|
| EC2 t2.micro | 750 hrs/month | Sufficient for this app |
| S3 | 5GB storage | For backups |
| Data Transfer | 15GB/month out | Monitor usage |

**Tips to stay in free tier:**
- Use t2.micro or t3.micro instance
- Stop instance when not needed
- Monitor CloudWatch billing alerts
- Clean old S3 backups regularly

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong passwords in .env
- [ ] Keep .env out of git (check .gitignore)
- [ ] Restrict SSH to your IP only
- [ ] Enable HTTPS with Let's Encrypt
- [ ] Set up AWS billing alerts
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Consider AWS WAF for production
