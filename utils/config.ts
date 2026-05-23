import "dotenv/config";
import { Config } from "../interfaces/Config";

let fileConfig: Partial<Config> = {};
try {
  fileConfig = require("../config.json");
} catch {}

const config: Config = {
  TOKEN: fileConfig.TOKEN || process.env.TOKEN || "",
  MAX_PLAYLIST_SIZE: fileConfig.MAX_PLAYLIST_SIZE || parseInt(process.env.MAX_PLAYLIST_SIZE!) || 10,
  PRUNING: fileConfig.PRUNING ?? process.env.PRUNING === "true",
  STAY_TIME: fileConfig.STAY_TIME || parseInt(process.env.STAY_TIME!) || 30,
  DEFAULT_VOLUME: fileConfig.DEFAULT_VOLUME || parseInt(process.env.DEFAULT_VOLUME!) || 100,
  LOCALE: fileConfig.LOCALE || process.env.LOCALE || "en",
  LAVALINK_HOST: fileConfig.LAVALINK_HOST || process.env.LAVALINK_HOST || "localhost",
  LAVALINK_PORT: fileConfig.LAVALINK_PORT || parseInt(process.env.LAVALINK_PORT!) || 2333,
  LAVALINK_PASSWORD: fileConfig.LAVALINK_PASSWORD || process.env.LAVALINK_PASSWORD || "youshallnotpass"
};

export { config };
