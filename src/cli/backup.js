#!/usr/bin/env node

/**
 * Database Backup CLI
 * Create and restore PostgreSQL backups
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default backup directory
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Get PostgreSQL connection string for pg_dump/pg_restore
 */
function getPgEnv() {
    return {
        PGHOST: config.pg.host,
        PGPORT: String(config.pg.port),
        PGUSER: config.pg.user,
        PGPASSWORD: config.pg.password,
        PGDATABASE: config.pg.database,
    };
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(format = 'custom') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = format === 'custom' ? 'dump' : format === 'plain' ? 'sql' : 'tar';
    return `backup_${config.pg.database}_${timestamp}.${ext}`;
}

/**
 * List existing backups
 */
function listBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && (f.endsWith('.dump') || f.endsWith('.sql') || f.endsWith('.tar')))
        .map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                name: f,
                size: formatBytes(stats.size),
                created: stats.mtime.toLocaleString(),
                path: path.join(BACKUP_DIR, f),
            };
        })
        .sort((a, b) => b.name.localeCompare(a.name)); // Newest first

    return files;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if pg_dump is available
 */
function checkPgDump() {
    try {
        execSync('which pg_dump', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a backup
 */
async function createBackup(format = 'custom', compress = true) {
    if (!checkPgDump()) {
        console.error('❌ pg_dump not found. Install PostgreSQL client tools:');
        console.error('   Ubuntu/Debian: sudo apt install postgresql-client');
        console.error('   macOS: brew install postgresql');
        return null;
    }

    const filename = generateBackupFilename(format);
    const filepath = path.join(BACKUP_DIR, filename);
    const env = { ...process.env, ...getPgEnv() };

    console.log(`📦 Creating backup: ${filename}`);
    console.log(`   Database: ${config.pg.database}@${config.pg.host}:${config.pg.port}`);
    console.log(`   Format: ${format}${compress ? ' (compressed)' : ''}`);

    const args = [
        '-h', config.pg.host,
        '-p', String(config.pg.port),
        '-U', config.pg.user,
        '-d', config.pg.database,
        '-f', filepath,
    ];

    if (format === 'custom') {
        args.push('-Fc'); // Custom format (compressed by default)
    } else if (format === 'plain') {
        args.push('-Fp'); // Plain SQL
        if (compress) {
            // Will gzip after
        }
    } else if (format === 'tar') {
        args.push('-Ft'); // Tar format
    }

    // Add verbosity
    args.push('-v');

    try {
        const startTime = Date.now();
        
        execSync(`pg_dump ${args.join(' ')}`, {
            env,
            stdio: 'inherit',
        });

        // Compress plain SQL if requested
        if (format === 'plain' && compress) {
            execSync(`gzip -f "${filepath}"`, { stdio: 'inherit' });
            const compressedPath = filepath + '.gz';
            const stats = fs.statSync(compressedPath);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✅ Backup created: ${filename}.gz (${formatBytes(stats.size)}) in ${duration}s`);
            return compressedPath;
        }

        const stats = fs.statSync(filepath);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Backup created: ${filename} (${formatBytes(stats.size)}) in ${duration}s`);
        return filepath;

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        // Clean up partial file
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        return null;
    }
}

/**
 * Restore from a backup
 */
async function restoreBackup(backupFile, dropExisting = false) {
    if (!fs.existsSync(backupFile)) {
        // Try in backup directory
        const inBackupDir = path.join(BACKUP_DIR, backupFile);
        if (fs.existsSync(inBackupDir)) {
            backupFile = inBackupDir;
        } else {
            console.error(`❌ Backup file not found: ${backupFile}`);
            return false;
        }
    }

    const env = { ...process.env, ...getPgEnv() };
    const isCustomFormat = backupFile.endsWith('.dump');
    const isCompressed = backupFile.endsWith('.gz');

    console.log(`🔄 Restoring from: ${path.basename(backupFile)}`);
    console.log(`   Target: ${config.pg.database}@${config.pg.host}:${config.pg.port}`);
    
    if (dropExisting) {
        console.log('   ⚠️  WARNING: This will DROP existing tables!');
    }

    try {
        const startTime = Date.now();

        if (isCustomFormat) {
            // Use pg_restore for custom format
            const args = [
                '-h', config.pg.host,
                '-p', String(config.pg.port),
                '-U', config.pg.user,
                '-d', config.pg.database,
                '-v',
            ];

            if (dropExisting) {
                args.push('--clean', '--if-exists');
            }

            args.push(backupFile);

            execSync(`pg_restore ${args.join(' ')}`, {
                env,
                stdio: 'inherit',
            });
        } else {
            // Use psql for plain SQL
            let sqlFile = backupFile;
            
            if (isCompressed) {
                console.log('   Decompressing...');
                const tempFile = path.join(BACKUP_DIR, 'temp_restore.sql');
                execSync(`gunzip -c "${backupFile}" > "${tempFile}"`, { stdio: 'pipe' });
                sqlFile = tempFile;
            }

            const args = [
                '-h', config.pg.host,
                '-p', String(config.pg.port),
                '-U', config.pg.user,
                '-d', config.pg.database,
                '-f', sqlFile,
            ];

            execSync(`psql ${args.join(' ')}`, {
                env,
                stdio: 'inherit',
            });

            // Clean up temp file
            if (isCompressed && fs.existsSync(path.join(BACKUP_DIR, 'temp_restore.sql'))) {
                fs.unlinkSync(path.join(BACKUP_DIR, 'temp_restore.sql'));
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Restore completed in ${duration}s`);
        return true;

    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        return false;
    }
}

/**
 * Delete old backups (keep N most recent)
 */
function cleanupBackups(keepCount = 5) {
    const backups = listBackups();
    
    if (backups.length <= keepCount) {
        console.log(`📁 ${backups.length} backup(s) found, keeping all (limit: ${keepCount})`);
        return { deleted: 0, kept: backups.length };
    }

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
        try {
            fs.unlinkSync(backup.path);
            console.log(`🗑️  Deleted: ${backup.name}`);
            deleted++;
        } catch (error) {
            console.error(`❌ Failed to delete ${backup.name}: ${error.message}`);
        }
    }

    console.log(`\n✅ Cleanup complete: ${deleted} deleted, ${keepCount} kept`);
    return { deleted, kept: keepCount };
}

/**
 * Export specific tables to JSON
 */
async function exportToJson(tables = ['products', 'price_history', 'tracked_products']) {
    const { pool } = await import('../db/connect-pg.js');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const exportDir = path.join(BACKUP_DIR, `export_${timestamp}`);
    fs.mkdirSync(exportDir, { recursive: true });

    console.log(`📤 Exporting tables to JSON: ${exportDir}`);

    for (const table of tables) {
        try {
            const result = await pool.query(`SELECT * FROM ${table}`);
            const filepath = path.join(exportDir, `${table}.json`);
            fs.writeFileSync(filepath, JSON.stringify(result.rows, null, 2));
            console.log(`   ✅ ${table}: ${result.rows.length} rows`);
        } catch (error) {
            console.error(`   ❌ ${table}: ${error.message}`);
        }
    }

    await pool.end();
    console.log(`\n✅ Export complete: ${exportDir}`);
    return exportDir;
}

// CLI Commands
const commands = {
    async create(format = 'custom') {
        await createBackup(format);
    },

    async restore(backupFile, ...flags) {
        const dropExisting = flags.includes('--drop') || flags.includes('--clean');
        await restoreBackup(backupFile, dropExisting);
    },

    list() {
        console.log('\n📁 Available Backups\n');
        console.log('─'.repeat(70));
        
        const backups = listBackups();
        
        if (backups.length === 0) {
            console.log('No backups found.');
            console.log(`\nBackup directory: ${BACKUP_DIR}`);
            return;
        }

        for (const backup of backups) {
            console.log(`${backup.name}`);
            console.log(`   Size: ${backup.size} | Created: ${backup.created}`);
        }
        
        console.log('─'.repeat(70));
        console.log(`\nTotal: ${backups.length} backup(s) in ${BACKUP_DIR}`);
    },

    async cleanup(keepCount = '5') {
        cleanupBackups(parseInt(keepCount));
    },

    async export(tables) {
        const tableList = tables ? tables.split(',') : undefined;
        await exportToJson(tableList);
    },

    async schedule() {
        console.log(`
📅 Backup Scheduling

To schedule automatic backups, add to crontab:

  # Edit crontab
  crontab -e

  # Daily backup at 2 AM
  0 2 * * * cd ${path.resolve(__dirname, '../..')} && npm run backup:create >> /var/log/price-tracker-backup.log 2>&1

  # Weekly cleanup (keep 7 backups)
  0 3 * * 0 cd ${path.resolve(__dirname, '../..')} && npm run backup -- cleanup 7 >> /var/log/price-tracker-backup.log 2>&1

Or use systemd timer for more control.
        `);
    },

    help() {
        console.log(`
Database Backup CLI

Usage:
  npm run backup -- <command> [options]

Commands:
  create [format]         Create a backup (format: custom|plain|tar, default: custom)
  restore <file> [--drop] Restore from backup (--drop to replace existing data)
  list                    List all backups
  cleanup [keep]          Delete old backups, keep N most recent (default: 5)
  export [tables]         Export tables to JSON (comma-separated, default: all main tables)
  schedule                Show cron examples for automated backups
  help                    Show this help message

Backup Formats:
  custom (default)  - Binary format, compressed, fastest restore, pg_restore
  plain             - SQL text, human-readable, can edit, psql
  tar               - Tar archive, can extract individual tables

Examples:
  npm run backup -- create              # Create default backup
  npm run backup -- create plain        # Create SQL backup
  npm run backup -- list                # List backups
  npm run backup -- restore backup_pricetracker_2025-11-29.dump
  npm run backup -- restore backup.dump --drop   # Drop and replace
  npm run backup -- cleanup 7           # Keep only 7 most recent
  npm run backup -- export products,price_history

Environment:
  BACKUP_DIR=${BACKUP_DIR}
  PG_HOST=${config.pg.host}
  PG_DATABASE=${config.pg.database}
        `);
    }
};

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    if (!commands[command]) {
        console.error(`❌ Unknown command: ${command}`);
        commands.help();
        process.exit(1);
    }

    try {
        await commands[command](...args.slice(1));
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
