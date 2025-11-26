import pino from "pino";
import config from "../config/index.js";

export default pino({
    level: config.logLevel },
    pino.destination({sync: false})
);