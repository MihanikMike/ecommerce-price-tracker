import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let agents = null;

const FALLBACK_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function loadAgents() {
    if (!agents) {
        const filepath = path.join(__dirname, "../../data/useragents.txt");
        try {
            const loaded = fs.readFileSync(filepath, "utf8").split("\n").filter(Boolean);
            if (loaded.length > 0) {
                agents = loaded;
            } else {
                logger.warn("User agents file is empty, using fallback");
                agents = FALLBACK_AGENTS;
            }
        } catch (error) {
            logger.warn({ error: error.message }, "Failed to load user agents, using fallback");
            agents = FALLBACK_AGENTS;
        }
    }
    return agents;
}

export function randomUA() { 
    const agentList = loadAgents();
    return agentList[Math.floor(Math.random() * agentList.length)]; 
}