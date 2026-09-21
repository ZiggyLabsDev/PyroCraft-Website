const copyAddressButton = document.querySelector("#copy-address");
const statsUrl = "data/stats.json";

const elements = {
	serverAddress: document.querySelector("#server-address"),
	serverStatus: document.querySelector("#server-status"),
	serverStatusDot: document.querySelector("#server-status-dot"),
	serverVersion: document.querySelector("#server-version"),
	onlineCount: document.querySelector("#online-count"),
	uptimeValue: document.querySelector("#uptime-value"),
	uptimeDetail: document.querySelector("#uptime-detail"),
	uptimeProgress: document.querySelector("#uptime-progress"),
	uptimePeriod: document.querySelector("#uptime-period"),
	playerList: document.querySelector("#player-list"),
	chartLine: document.querySelector("#chart-line"),
	chartArea: document.querySelector("#chart-area"),
	chartPoint: document.querySelector("#chart-point"),
	chartEmpty: document.querySelector("#chart-empty"),
};

function renderChart(history) {
	if (!Array.isArray(history) || history.length < 2 || !elements.chartLine) {
		elements.chartLine?.removeAttribute("d");
		elements.chartArea?.removeAttribute("d");
		elements.chartPoint?.removeAttribute("cx");
		elements.chartPoint?.removeAttribute("cy");
		if (elements.chartEmpty) elements.chartEmpty.hidden = false;
		return;
	}
	elements.chartEmpty.hidden = true;
	const width = 720;
	const baseline = 200;
	const maxPlayers = Math.max(...history.map((point) => point.players), 10);
	const points = history.map((point, index) => {
		const x = (index / Math.max(history.length - 1, 1)) * width;
		const y = baseline - (point.players / maxPlayers) * 170;
		return `${x.toFixed(1)} ${y.toFixed(1)}`;
	});
	const line = `M${points.join(" L")}`;
	elements.chartLine.setAttribute("d", line);
	elements.chartArea?.setAttribute("d", `${line} L${width} ${baseline} L0 ${baseline} Z`);
	const lastPoint = points.at(-1).split(" ");
	elements.chartPoint?.setAttribute("cx", lastPoint[0]);
	elements.chartPoint?.setAttribute("cy", lastPoint[1]);
}

function renderPlayers(players = []) {
	if (!elements.playerList || !Array.isArray(players) || !players.length) {
		if (elements.playerList) elements.playerList.innerHTML = '<div class="empty-state">Player data unavailable</div>';
		return;
	}
	elements.playerList.innerHTML = players.slice(0, 5).map((player) => `
		<div class="activity-item player-row">
			<div class="avatar small ${player.color || "orange"}">${player.initial || player.name.charAt(0)}</div>
			<p><strong>${player.name}</strong><span>${player.location || "Exploring the world"}</span></p>
			<i class="online-dot"></i>
		</div>
	`).join("");
}

async function loadStats() {
	try {
		const response = await fetch(statsUrl, { cache: "no-store" });
		if (!response.ok) throw new Error("Stats file unavailable");
		const stats = await response.json();
		elements.serverAddress.textContent = stats.serverAddress || "Address unavailable";
		const statusClass = stats.online === true ? "status-online" : stats.online === false ? "status-offline" : "status-unknown";
		elements.serverStatus.textContent = stats.online === true ? "Server online" : stats.online === false ? "Server offline" : "Status unavailable";
		elements.serverStatusDot.className = statusClass;
		elements.serverVersion.textContent = stats.version || "JAVA EDITION";
		const online = Number.isFinite(stats.players?.online) ? stats.players.online : null;
		const max = Number.isFinite(stats.players?.max) ? stats.players.max : null;
		elements.onlineCount.textContent = online === null ? "Unavailable" : max === null ? `${online}` : `${online} / ${max}`;
		const uptime = stats.uptime;
		if (Number.isFinite(uptime?.percent)) {
			elements.uptimeValue.innerHTML = `${uptime.percent}<span class="stat-unit">%</span>`;
			elements.uptimeDetail.textContent = uptime.detail || "Calculated from history";
			elements.uptimeProgress.style.width = `${Math.min(uptime.percent, 100)}%`;
			elements.uptimePeriod.textContent = uptime.period || "--";
		} else {
			elements.uptimeValue.textContent = "Collecting data";
			elements.uptimeDetail.textContent = "Waiting for history";
			elements.uptimeProgress.style.width = "0%";
			elements.uptimePeriod.textContent = "--";
		}
		renderPlayers(stats.players?.list);
		renderChart(stats.history);
	} catch (error) {
		console.warn("Using the sample server stats.", error);
	}
}

loadStats();

copyAddressButton?.addEventListener("click", async () => {
	const address = elements.serverAddress?.textContent;
	if (!address || address === "Loading address" || address === "Address unavailable") return;
	await navigator.clipboard.writeText(address);
	copyAddressButton.textContent = "✓";
	copyAddressButton.setAttribute("aria-label", "Server address copied");
	window.setTimeout(() => {
		copyAddressButton.textContent = "▣";
		copyAddressButton.setAttribute("aria-label", "Copy server address");
	}, 1600);
});
