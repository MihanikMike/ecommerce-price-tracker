import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let agents = null;

function loadAgents() {
    if (!agents) {
        const filepath = path.join(__dirname, "../../data/useragents.txt");
        try {
            agents = fs.readFileSync(filepath, "utf8").split("\n").filter(Boolean);
        } catch (error) {
            logger.warn({ error: error.message }, "Failed to load user agents, using fallback");
            agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ];
        }
    }
    return agents;
}

export function randomUA() { 
    const agentList = loadAgents();
    return agentList[Math.floor(Math.random() * agentList.length)]; 
}