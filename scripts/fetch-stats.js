const fs = require("node:fs/promises");

const statsPath = "data/stats.json";
const serverAddress = process.env.SERVER_ADDRESS;

if (!serverAddress) {
	throw new Error("SERVER_ADDRESS is required");
}

async function readExistingStats() {
	try {
		return JSON.parse(await fs.readFile(statsPath, "utf8"));
	} catch {
		return { history: [] };
	}
}

async function fetchServerStatus() {
	const endpoint = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(serverAddress)}`;
	const response = await fetch(endpoint);
	if (!response.ok) throw new Error(`Minecraft status request failed: ${response.status}`);
	return response.json();
}

function addHistoryPoint(history, players, online) {
	const next = [...(history || []), {
		time: new Date().toISOString(),
		players,
		online,
	}];
	return next.slice(-24);
}

function calculateUptime(history) {
	const checks = history || [];
	if (!checks.length) return null;
	const percent = (checks.filter((point) => point.online !== false).length / checks.length) * 100;
	return {
		percent: Number(percent.toFixed(1)),
		detail: `Based on ${checks.length} check${checks.length === 1 ? "" : "s"}`,
		period: "Last 24 checks",
	};
}

async function main() {
	const existing = await readExistingStats();
	const status = await fetchServerStatus();
	const online = status.players?.online ?? 0;
	const playerList = (status.players?.list || []).map((player) => ({
		name: player.name_clean || player.name_raw || player.name,
		initial: (player.name_clean || player.name || "?").charAt(0).toUpperCase(),
		color: "orange",
		location: "Online now",
	}));
	const history = addHistoryPoint(existing.history, online, status.online !== false);
	const nextStats = {
		...existing,
		dataState: "live",
		updatedAt: new Date().toISOString(),
		serverAddress,
		version: status.version?.name_clean || status.version?.name || null,
		online: status.online !== false,
		players: { online, max: status.players?.max ?? null, list: playerList },
		uptime: calculateUptime(history),
		history,
	};
	await fs.writeFile(statsPath, `${JSON.stringify(nextStats, null, 2)}\n`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
