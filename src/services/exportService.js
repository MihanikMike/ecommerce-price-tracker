import { promises as fs } from "fs";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Export products to JSON file
 */
export async function exportToJSON(data, filename) {
    const filepath = path.join(config.paths?.exports || './exports', filename);

    try {
        // Ensure exports directory exists
        await fs.mkdir(path.dirname(filepath), { recursive: true });

        // Write JSON file
        await fs.writeFile(
            filepath,
            JSON.stringify(data, null, 2),
            'utf8'
        );

        logger.info({ filepath, count: data.length }, 'Data exported to JSON');
        
    } catch (error) {
        logger.error({ error, filepath }, 'Failed to export JSON');
        throw error;
    }
}

/**
 * Export products to CSV file (placeholder)
 */
export async function exportToCSV(data, filename) {
    throw new Error('CSV export not implemented yet');
}
