import fs from "fs";
const agents = fs.readFileSync("./data/useragents.txt","utf8").split("\n").filter(Boolean);
export function randomUA(){ return agents[Math.floor(Math.random()*agents.length)]; }