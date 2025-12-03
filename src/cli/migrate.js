import logger from '../utils/logger.js';
import { runMigrations, rollbackMigration, getMigrationStatus, closeDatabaseConnection } from '../db/connect-pg.js';

function showHelp() {
    console.log(`
Database Migration CLI

Usage:
  node src/cli/migrate.js [command] [options]

Commands:
  run, up      Run all pending migrations (default)
  rollback     Rollback a specific migration
  status       Show migration status

Options:
  --version <version>  Specify migration version for rollback
  --help               Show this help message

Examples:
  node src/cli/migrate.js                    # Run all pending migrations
  node src/cli/migrate.js status             # Show migration status
  node src/cli/migrate.js rollback --version 005_add_current_price
`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'run';
    
    // Parse arguments
    const versionIndex = args.indexOf('--version');
    const version = versionIndex !== -1 ? args[versionIndex + 1] : null;
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    try {
        switch (command) {
            case 'run':
            case 'up':
                logger.info('Starting database migrations...');
                await runMigrations();
                console.log('✅ Migrations completed successfully');
                break;
                
            case 'rollback':
            case 'down':
                if (!version) {
                    console.error('❌ Error: --version is required for rollback');
                    console.error('   Usage: node src/cli/migrate.js rollback --version 005_add_current_price');
                    process.exit(1);
                }
                logger.warn({ version }, 'Rolling back migration...');
                const result = await rollbackMigration(version);
                console.log(`✅ Rolled back migration: ${result.version} (took ${result.executionTime}ms)`);
                break;
                
            case 'status':
                const status = await getMigrationStatus();
                console.log('\nMigration Status:');
                console.log('─'.repeat(80));
                console.log(
                    'Version'.padEnd(35),
                    'Status'.padEnd(12),
                    'Rollback'.padEnd(10),
                    'Executed At'
                );
                console.log('─'.repeat(80));
                
                for (const migration of status) {
                    const statusIcon = migration.executed ? '✓' : '○';
                    const statusText = migration.executed ? 'Applied' : 'Pending';
                    const rollbackText = migration.hasRollback ? 'Yes' : 'No';
                    const executedAt = migration.executedAt 
                        ? new Date(migration.executedAt).toLocaleString()
                        : '-';
                    
                    console.log(
                        `${statusIcon} ${migration.version}`.padEnd(35),
                        statusText.padEnd(12),
                        rollbackText.padEnd(10),
                        executedAt
                    );
                }
                console.log('─'.repeat(80));
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
        
        await closeDatabaseConnection();
        process.exit(0);
    } catch (error) {
        console.error(`❌ ${error.message}`);
        logger.error({ error }, 'Migration command failed');
        await closeDatabaseConnection();
        process.exit(1);
    }
}

main();