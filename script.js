const copyAddressButton = document.querySelector("#copy-address");
const openInfoButton = document.querySelector("#open-info");
const closeInfoButton = document.querySelector("#close-info");
const infoModal = document.querySelector("#info-modal");
const statsUrl = "data/stats.json";

function renderRestartTime() {
		const restartTime = document.querySelector("#restart-time");
		if (!restartTime) return;

		const mountainFormatter = new Intl.DateTimeFormat("en-US", {
			timeZone: "America/Denver",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const dateParts = Object.fromEntries(mountainFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
		const candidate = Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), 16);
		const offsetParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" }).formatToParts(new Date(candidate));
		const offset = offsetParts.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d+(?::\d+)?)?/i)?.[1] || "-7";
		const [hours, minutes = "0"] = offset.split(":");
		const offsetMinutes = Number(hours) * 60 + Number(minutes) * Math.sign(Number(hours));
		const restartInstant = new Date(candidate - offsetMinutes * 60 * 1000);
		const localTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(restartInstant);
		restartTime.textContent = `${localTime} local (4:00 PM MT)`;
}

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
	chartPoints: document.querySelector("#chart-points"),
	chartYLabels: document.querySelector("#chart-y-labels"),
	chartLatest: document.querySelector("#chart-latest"),
	chartEmpty: document.querySelector("#chart-empty"),
};

function renderChart(history) {
	const pointsData = Array.isArray(history)
		? history
			.filter((point) => Number.isFinite(Number(point.players)) && Number.isFinite(Date.parse(point.time)))
			.sort((first, second) => Date.parse(first.time) - Date.parse(second.time))
		: [];
	if (!pointsData.length || !elements.chartLine) {
		elements.chartLine?.removeAttribute("d");
		elements.chartArea?.removeAttribute("d");
		if (elements.chartPoints) elements.chartPoints.replaceChildren();
		if (elements.chartYLabels) elements.chartYLabels.replaceChildren();
		if (elements.chartLatest) elements.chartLatest.textContent = "-- online";
		if (elements.chartEmpty) elements.chartEmpty.hidden = false;
		return;
	}
	elements.chartEmpty.hidden = true;
	const width = 720;
	const baseline = 200;
	const maxPlayers = Math.max(...pointsData.map((point) => Number(point.players)), 1);
	if (elements.chartYLabels) {
		elements.chartYLabels.replaceChildren(...[maxPlayers, maxPlayers / 2, 0].map((value, index) => {
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", "8");
			label.setAttribute("y", String([25, 79, 187][index]));
			label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(1);
			return label;
		}));
	}
	const points = pointsData.map((point, index) => {
		const x = pointsData.length === 1 ? width / 2 : (index / (pointsData.length - 1)) * width;
		const y = baseline - (Number(point.players) / maxPlayers) * 170;
		return `${x.toFixed(1)} ${y.toFixed(1)}`;
	});
	const line = `M${points.join(" L")}`;
	elements.chartLine.setAttribute("d", line);
	elements.chartArea?.setAttribute("d", `${line} L${width} ${baseline} L0 ${baseline} Z`);
	if (elements.chartPoints) {
		elements.chartPoints.replaceChildren(...points.map((point, index) => {
			const [cx, cy] = point.split(" ");
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", cx);
			circle.setAttribute("cy", cy);
			circle.setAttribute("r", index === points.length - 1 ? "5" : "3");
			circle.setAttribute("class", "chart-point");
			const timestamp = new Date(pointsData[index].time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
			const tooltip = document.createElementNS("http://www.w3.org/2000/svg", "title");
			tooltip.textContent = `${timestamp} · ${pointsData[index].players} player${Number(pointsData[index].players) === 1 ? "" : "s"}`;
			circle.appendChild(tooltip);
			return circle;
		}));
	}
	if (elements.chartLatest) {
		const latestPlayers = Number(pointsData.at(-1).players);
		elements.chartLatest.textContent = `${latestPlayers} online now`;
	}
}

function renderPlayers(players = []) {
	if (!elements.playerList || !Array.isArray(players) || !players.length) {
		if (elements.playerList) elements.playerList.innerHTML = '<div class="empty-state">Player data unavailable</div>';
		return;
	}
	elements.playerList.innerHTML = players.slice(0, 5).map((player) => `
		<div class="activity-item player-row">
			<p><strong>${player.name}</strong><span>${player.location || "Exploring the world"}</span></p>
			<i class="online-dot"></i>
		</div>
	`).join("");
}

function calculateUptime(history) {
	const checks = history || [];
	if (!checks.length) return null;
	return {
		percent: Number(((checks.filter((point) => point.online !== false).length / checks.length) * 100).toFixed(1)),
		detail: `Based on ${checks.length} check${checks.length === 1 ? "" : "s"}`,
		period: "Last 24 checks",
	};
}

async function loadStats() {
	try {
		const response = await fetch(statsUrl, { cache: "no-store" });
		if (!response.ok) throw new Error("Stats file unavailable");
		const stats = await response.json();
		const statusClass = stats.online === true ? "status-online" : stats.online === false ? "status-offline" : "status-unknown";
		elements.serverStatus.textContent = stats.online === true ? "Server online" : stats.online === false ? "Server offline" : "Status unavailable";
		elements.serverStatusDot.className = statusClass;
		elements.serverVersion.textContent = stats.version || "JAVA EDITION";
		const online = Number.isFinite(stats.players?.online) ? stats.players.online : null;
		const max = Number.isFinite(stats.players?.max) ? stats.players.max : null;
		elements.onlineCount.textContent = online === null ? "Unavailable" : max === null ? `${online}` : `${online} / ${max}`;
		const uptime = stats.uptime || calculateUptime(stats.history);
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
renderRestartTime();

copyAddressButton?.addEventListener("click", async () => {
	const address = elements.serverAddress?.textContent;
	if (!address || address === "Loading address" || address === "Address unavailable") return;
	await navigator.clipboard.writeText(address);
	copyAddressButton.textContent = "Link copied";
	copyAddressButton.setAttribute("aria-label", "Server address copied");
	window.setTimeout(() => {
		copyAddressButton.textContent = "Copy link";
		copyAddressButton.setAttribute("aria-label", "Copy server address");
	}, 1600);
});

function setInfoModal(open) {
	if (!infoModal) return;
	infoModal.hidden = !open;
	document.body.classList.toggle("modal-open", open);
	if (open) closeInfoButton?.focus();
	else openInfoButton?.focus();
}

openInfoButton?.addEventListener("click", () => setInfoModal(true));
closeInfoButton?.addEventListener("click", () => setInfoModal(false));
infoModal?.addEventListener("click", (event) => {
	if (event.target instanceof HTMLElement && event.target.hasAttribute("data-close-info")) setInfoModal(false);
});
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && infoModal && !infoModal.hidden) setInfoModal(false);
});
