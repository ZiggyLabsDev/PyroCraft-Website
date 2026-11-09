const fs = require("node:fs/promises");

const statsPath = "data/stats.json";
const workerUrl = "https://pyrocraft-stats-worker.ziggylabsdev.workers.dev/stats";

async function main() {
	const response = await fetch(workerUrl);
	if (!response.ok) throw new Error(`Worker request failed: ${response.status}`);

	const stats = await response.json();
	if (!stats || stats.dataState !== "live" || !Array.isArray(stats.history)) {
		throw new Error("Worker returned unexpected data, keeping existing stats.json");
	}

	await fs.writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});