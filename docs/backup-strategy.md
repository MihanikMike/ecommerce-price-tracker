# Backup Strategy

## Overview

This document outlines the backup and recovery strategy for the ecommerce-price-tracker application.

## Backup Types

### 1. Database Backups

#### Full Backups (pg_dump)
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Format**: Custom format (.dump) for efficient storage and selective restore
- **Location**: `./backups/` directory

#### Usage

```bash
# Create a backup
npm run backup

# Or manually
pg_dump -Fc -h localhost -U $POSTGRES_USER -d $POSTGRES_DB > backups/backup_$(date +%Y-%m-%d).dump

# Restore a backup
pg_restore -h localhost -U $POSTGRES_USER -d $POSTGRES_DB backups/backup_2025-01-15.dump
```

### 2. Configuration Backups

Critical configuration files to backup:
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env` (store securely, encrypted)
- `data/seed-products.json`
- `monitoring/prometheus.yml`
- `monitoring/grafana/provisioning/`

### 3. Export Data

For lightweight backups of product data:

```bash
# Export products to JSON
npm run export

# Output: exports/products.json
```

## Recovery Procedures

### Database Recovery

1. **Stop the application**
   ```bash
   docker-compose down
   ```

2. **Start only the database**
   ```bash
   docker-compose up -d db
   ```

3. **Restore from backup**
   ```bash
   # Drop existing database
   docker exec -it price-tracker-db psql -U postgres -c "DROP DATABASE IF EXISTS price_tracker;"
   docker exec -it price-tracker-db psql -U postgres -c "CREATE DATABASE price_tracker;"
   
   # Restore
   docker exec -i price-tracker-db pg_restore -U postgres -d price_tracker < backups/backup_file.dump
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

### Point-in-Time Recovery (PITR)

For production environments, consider enabling WAL archiving:

```sql
-- In postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
```

## Backup Verification

### Monthly Verification Checklist

- [ ] Restore backup to test environment
- [ ] Verify data integrity
- [ ] Test application functionality with restored data
- [ ] Document any issues

### Verification Script

```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE=$1
TEST_DB="price_tracker_test"

# Create test database
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"
psql -h localhost -U postgres -c "CREATE DATABASE $TEST_DB;"

# Restore
pg_restore -h localhost -U postgres -d $TEST_DB $BACKUP_FILE

# Verify row counts
psql -h localhost -U postgres -d $TEST_DB -c "
SELECT 'products' as table_name, COUNT(*) as rows FROM products
UNION ALL
SELECT 'tracked_products', COUNT(*) FROM tracked_products
UNION ALL
SELECT 'price_history', COUNT(*) FROM price_history;
"

# Cleanup
psql -h localhost -U postgres -c "DROP DATABASE $TEST_DB;"

echo "Backup verification complete"
```

## Retention Policy

| Backup Type | Retention Period | Storage Location |
|-------------|------------------|------------------|
| Daily DB backup | 30 days | Local + Cloud |
| Weekly DB backup | 90 days | Cloud |
| Monthly DB backup | 1 year | Cloud + Offsite |
| Config backups | Indefinite | Git repository |
| Export JSON | 7 days | Local |

## Disaster Recovery

### Recovery Time Objectives (RTO)

| Scenario | Target RTO |
|----------|------------|
| Database corruption | 1 hour |
| Server failure | 4 hours |
| Complete data loss | 24 hours |

### Recovery Steps

1. **Assess the situation**
   - Identify what was lost
   - Determine the most recent valid backup

2. **Provision infrastructure**
   - Spin up new server/container
   - Install dependencies

3. **Restore data**
   - Restore database from backup
   - Restore configuration files
   - Verify data integrity

4. **Verify functionality**
   - Run health checks
   - Test critical paths
   - Monitor for errors

## Automated Backup Script

Create a cron job for automated backups:

```bash
# /etc/cron.d/price-tracker-backup
0 2 * * * root /opt/price-tracker/scripts/backup.sh >> /var/log/price-tracker-backup.log 2>&1
```

### backup.sh

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/price-tracker/backups"
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/backup_price_tracker_$TIMESTAMP.dump"

# Create backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -Fc \
  -h $POSTGRES_HOST \
  -U $POSTGRES_USER \
  -d $POSTGRES_DB \
  > $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

# Optional: Upload to S3
# aws s3 cp $BACKUP_FILE s3://my-backup-bucket/price-tracker/

echo "Backup completed: $BACKUP_FILE"
```

## Monitoring

- Set up alerts for backup failures
- Monitor backup file sizes for anomalies
- Track backup/restore times
- Verify backup integrity checksums

## Security Considerations

- Encrypt backups at rest
- Use secure transfer protocols (SSH/TLS)
- Restrict access to backup files
- Audit backup access logs
- Store encryption keys separately from backups
