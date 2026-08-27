import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, ensureSeed } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "../data");

await ensureSeed(DATA_DIR);
const app = createApp(DATA_DIR);
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT} dataDir=${DATA_DIR}`));
