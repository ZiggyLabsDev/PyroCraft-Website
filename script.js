const copyAddressButtons = document.querySelectorAll(".copy-address");
const openInfoButtons = document.querySelectorAll(".open-info");
const closeInfoButton = document.querySelector("#close-info");
const infoModal = document.querySelector("#info-modal");
const brandLogo = document.querySelector("#brand-logo");
const easterEgg = document.querySelector("#easter-egg");
const siteRoot = new URL(".", document.currentScript.src);
const statsUrl = new URL("data/stats.json", siteRoot);
const workerStatsUrl = "https://pyrocraft-stats-worker.ziggylabsdev.workers.dev/stats";
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
		const candidate = Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), 21);
		const offsetParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" }).formatToParts(new Date(candidate));
		const offset = offsetParts.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d+(?::\d+)?)?/i)?.[1] || "-7";
		const [hours, minutes = "0"] = offset.split(":");
		const offsetMinutes = Number(hours) * 60 + Number(minutes) * Math.sign(Number(hours));
		const restartInstant = new Date(candidate - offsetMinutes * 60 * 1000);
		const localTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(restartInstant);
		restartTime.textContent = `${localTime} local (9:00 PM MT)`;
}

const elements = {
	serverAddress: document.querySelector("#server-address"),
	serverStatus: document.querySelector("#server-status"),
	serverStatusDot: document.querySelector("#server-status-dot"),
	serverVersion: document.querySelector("#server-version"),
	statsFreshness: document.querySelector("#stats-freshness"),
	playersLabel: document.querySelector("#players-label"),
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
	chartLabels: document.querySelector("#chart-labels"),
	chartStats: document.querySelector("#chart-stats"),
	chartEmpty: document.querySelector("#chart-empty"),
	historyFreshness: document.querySelector("#history-freshness"),
};

function formatChartTime(timestamp) {
	return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatChartTick(timestamp, includeDay) {
	const date = new Date(timestamp);
	if (!includeDay) return formatChartTime(date);
	return `${date.toLocaleDateString([], { weekday: "short" })} ${date.toLocaleTimeString([], { hour: "numeric" })}`;
}

// Control points share each endpoint's y, so the curve never overshoots the data.
function smoothPath(coords) {
	if (coords.length === 1) return `M${coords[0][0]} ${coords[0][1]}`;
	return coords.reduce((path, [x, y], index) => {
		if (index === 0) return `M${x} ${y}`;
		const [prevX, prevY] = coords[index - 1];
		const midX = ((prevX + x) / 2).toFixed(1);
		return `${path} C${midX} ${prevY} ${midX} ${y} ${x} ${y}`;
	}, "");
}

let chartState = null;

function setupChartHover() {
	const svg = elements.chartLine?.ownerSVGElement;
	const wrap = svg?.parentElement;
	if (!svg || !wrap) return;
	const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
	guide.setAttribute("class", "chart-guide");
	guide.setAttribute("y1", "20");
	guide.setAttribute("y2", "200");
	guide.style.display = "none";
	svg.appendChild(guide);
	const tip = document.createElement("div");
	tip.className = "chart-tooltip";
	tip.hidden = true;
	wrap.appendChild(tip);

	const hide = () => {
		guide.style.display = "none";
		tip.hidden = true;
	};
	svg.addEventListener("pointermove", (event) => {
		if (!chartState) return hide();
		const rect = svg.getBoundingClientRect();
		const wrapRect = wrap.getBoundingClientRect();
		const pointerX = ((event.clientX - rect.left) / rect.width) * 720;
		let nearest = 0;
		chartState.xs.forEach((x, index) => {
			if (Math.abs(x - pointerX) < Math.abs(chartState.xs[nearest] - pointerX)) nearest = index;
		});
		const point = chartState.pointsData[nearest];
		const x = chartState.xs[nearest];
		const y = chartState.ys[nearest];
		guide.setAttribute("x1", x);
		guide.setAttribute("x2", x);
		guide.style.display = "";
		const players = Number(point.players);
		const date = new Date(point.time);
		tip.innerHTML = `<strong>${players} player${players === 1 ? "" : "s"}</strong><span>${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${formatChartTime(point.time)}</span>${point.online === false ? "<span>Server offline</span>" : ""}`;
		tip.hidden = false;
		const left = rect.left - wrapRect.left + (x / 720) * rect.width;
		tip.style.left = `${Math.min(Math.max(left, tip.offsetWidth / 2), wrapRect.width - tip.offsetWidth / 2)}px`;
		tip.style.top = `${rect.top - wrapRect.top + (y / 220) * rect.height}px`;
	});
	svg.addEventListener("pointerleave", hide);
}

function renderChart(history) {
	const now = Date.now();
	const pointsData = Array.isArray(history)
		? history
			.filter((point) => {
				const time = Date.parse(point.time);
				return typeof point.players === "number" && Number.isFinite(point.players) && Number.isFinite(time) && time >= now - 96 * 60 * 60 * 1000 && time <= now;
			})
			.sort((first, second) => Date.parse(first.time) - Date.parse(second.time))
		: [];
	if (!pointsData.length || !elements.chartLine) {
		chartState = null;
		elements.chartLine?.removeAttribute("d");
		elements.chartArea?.removeAttribute("d");
		if (elements.chartPoints) elements.chartPoints.replaceChildren();
		if (elements.chartYLabels) elements.chartYLabels.replaceChildren();
		if (elements.chartLatest) elements.chartLatest.textContent = "-- online";
		if (elements.chartLabels) elements.chartLabels.replaceChildren();
		if (elements.chartStats) elements.chartStats.replaceChildren();
		if (elements.chartEmpty) {
			elements.chartEmpty.textContent = "No activity data from the last 96 hours";
			elements.chartEmpty.hidden = false;
		}
		return;
	}
	elements.chartEmpty.hidden = true;
	const width = 720;
	const baseline = 200;
	const firstTimestamp = Date.parse(pointsData[0].time);
	const lastTimestamp = Date.parse(pointsData.at(-1).time);
	const timeRange = Math.max(lastTimestamp - firstTimestamp, 1);
	const peakPlayers = Math.max(...pointsData.map((point) => Number(point.players)), 1);
	const maxPlayers = peakPlayers + (peakPlayers % 2);
	if (elements.chartYLabels) {
		elements.chartYLabels.replaceChildren(...[maxPlayers, maxPlayers / 2, 0].map((value, index) => {
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", "8");
			label.setAttribute("y", String([25, 79, 187][index]));
			label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(1);
			return label;
		}));
	}
	const coords = pointsData.map((point) => {
		const x = pointsData.length === 1 ? width / 2 : ((Date.parse(point.time) - firstTimestamp) / timeRange) * width;
		const y = baseline - (Number(point.players) / maxPlayers) * 170;
		return [Number(x.toFixed(1)), Number(y.toFixed(1))];
	});
	const points = coords.map(([x, y]) => `${x} ${y}`);
	const line = smoothPath(coords);
	chartState = {
		pointsData,
		xs: coords.map(([x]) => x),
		ys: coords.map(([, y]) => y),
	};
	elements.chartLine.setAttribute("d", line);
	elements.chartLine.classList.add("chart-draw");
	elements.chartArea?.setAttribute("d", `${line} L${width} ${baseline} L0 ${baseline} Z`);
	if (elements.chartPoints) {
		elements.chartPoints.replaceChildren(...points.map((point, index) => {
			const [cx, cy] = point.split(" ");
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", cx);
			circle.setAttribute("cy", cy);
			circle.setAttribute("r", index === points.length - 1 ? "5" : "3");
			circle.setAttribute("class", "chart-point");
			return circle;
		}));
	}
	if (elements.chartLatest) {
		const latestPlayers = Number(pointsData.at(-1).players);
		elements.chartLatest.textContent = `${latestPlayers} at last sample`;
	}
	if (elements.chartLabels) {
		const includeDay = timeRange >= 24 * 60 * 60 * 1000 || new Date(firstTimestamp).toDateString() !== new Date(lastTimestamp).toDateString();
		const tickCount = pointsData.length === 1 ? 1 : 5;
		elements.chartLabels.replaceChildren(...Array.from({ length: tickCount }, (_, index) => {
			const span = document.createElement("span");
			span.textContent = formatChartTick(firstTimestamp + (timeRange * index) / Math.max(tickCount - 1, 1), includeDay);
			return span;
		}));
	}
	if (elements.chartStats) {
		const counts = pointsData.map((point) => Number(point.players));
		const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
		elements.chartStats.innerHTML = `<span>Peak <strong>${Math.max(...counts)}</strong></span><span>Average <strong>${average.toFixed(1)}</strong></span><span>Low <strong>${Math.min(...counts)}</strong></span>`;
	}
}

function renderPlayers(players = [], onlineCount = null) {
	if (!elements.playerList || !Array.isArray(players) || !players.length) {
		if (elements.playerList) {
			elements.playerList.textContent = onlineCount === 0 ? "No players online at the last check. Your adventure awaits!" : "Player names unavailable.";
			elements.playerList.className = "activity-list empty-state";
		}
		return;
	}
	elements.playerList.className = "activity-list";

	const visiblePlayers = players.slice(0, 5);
	const remainingPlayers = Math.max(players.length - 5, 0);

	elements.playerList.innerHTML = `
		${visiblePlayers.map((player) => `
			<div class="activity-item player-row">
				<p>
					<strong>${escapeHtml(player.name)}</strong>
					<span>${escapeHtml(player.location || "Exploring the world")}</span>
				</p>
				<i class="online-dot"></i>
			</div>
		`).join("")}

		${remainingPlayers > 0 ? `
			<div class="plus-more" id="plus-more">
				+${remainingPlayers} more
			</div>
		` : ""}
	`;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function calculateUptime(history) {
	const checks = history || [];
	if (!checks.length) return null;
	return {
		percent: Number(((checks.filter((point) => point.online !== false).length / checks.length) * 100).toFixed(1)),
		detail: `Based on ${checks.length} check${checks.length === 1 ? "" : "s"}`,
		period: `Last ${checks.length} checks`,
	};
}

async function fetchJsonWithTimeout(url, label) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetch(url, { cache: "no-store", signal: controller.signal });
		if (!response.ok) throw new Error(`${label} returned ${response.status}`);
		return await response.json();
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchLiveStatus(address) {
	const s = await fetchJsonWithTimeout(
		`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`,
		"Live status"
	);
	if (typeof s.online !== "boolean") throw new Error("Invalid live status response");
	return {
		online: s.online,
		version: s.version?.name_clean || s.version?.name || null,
		players: {
			online: s.online ? (Number.isFinite(s.players?.online) ? s.players.online : null) : 0,
			max: s.players?.max ?? null,
			list: (s.players?.list || []).map((player) => ({
				name: player.name_clean || player.name_raw || player.name,
				initial: (player.name_clean || player.name || "?").charAt(0).toUpperCase(),
				color: "orange",
				location: "Online now",
			})),
		},
	};
}

async function fetchWorkerStats() {
	const stats = await fetchJsonWithTimeout(workerStatsUrl, "Stats Worker");
	if (stats?.dataState !== "live" || !Array.isArray(stats.history) ||
		!Number.isFinite(Date.parse(stats.updatedAt)) ||
		typeof stats.serverAddress !== "string" || typeof stats.online !== "boolean" ||
		!stats.players || typeof stats.players !== "object") {
		throw new Error("Stats Worker returned invalid data");
	}
	return stats;
}

async function loadStats() {
	try {
		let stats;
		let usingSnapshot = false;
		try {
			stats = await fetchWorkerStats();
		} catch (error) {
			console.warn("Stats Worker unavailable; using saved stats snapshot.", error);
			usingSnapshot = true;
			const response = await fetch(statsUrl, { cache: "no-store" });
			if (!response.ok) throw new Error("Saved stats snapshot unavailable");
			stats = await response.json();
			if (!stats || !Array.isArray(stats.history)) throw new Error("Invalid saved stats snapshot");
		}
		if (elements.historyFreshness) {
			const updatedAt = new Date(stats.updatedAt);
			const timestamp = Number.isFinite(updatedAt.getTime()) ? updatedAt.toLocaleString() : "time unavailable";
			elements.historyFreshness.textContent = `${usingSnapshot ? "Saved activity snapshot" : "Activity history updated"}: ${timestamp}.`;
		}
		let checkedAt = stats.updatedAt;
		let isLive = false;
		if (stats.serverAddress) {
			try {
				const live = await fetchLiveStatus(stats.serverAddress);
				const history = [...(stats.history || [])];
				if (Number.isFinite(live.players.online)) history.push({ time: new Date().toISOString(), players: live.players.online, online: live.online });
				stats = { ...stats, ...live, version: live.version || stats.version, history };
				checkedAt = new Date().toISOString();
				isLive = true;
			} catch (error) {
				console.warn("Live status failed; using the last saved check.", error);
			}
		}
		const statusClass = stats.online === true ? "status-online" : stats.online === false ? "status-offline" : "status-unknown";
		if (elements.serverStatus) elements.serverStatus.textContent = stats.online === true ? (isLive ? "Server online" : "Last check: online") : stats.online === false ? (isLive ? "Server offline" : "Last check: offline") : "Status unavailable";
		if (elements.serverStatusDot) elements.serverStatusDot.className = statusClass;
		if (elements.playersLabel) elements.playersLabel.textContent = isLive ? "Online now" : "Players at last check";
		if (elements.serverVersion) elements.serverVersion.textContent = stats.version ? `JAVA EDITION · ${stats.version}` : "JAVA EDITION";
		const versionNumber = stats.version?.match(/\d+(?:\.\d+)+/)?.[0];
		if (versionNumber) document.querySelectorAll(".join-version").forEach((element) => {
			element.textContent = `Use Java Edition ${versionNumber} to play.`;
		});
		if (elements.statsFreshness) {
			const checkedDate = new Date(checkedAt);
			elements.statsFreshness.textContent = (Number.isFinite(checkedDate.getTime())
				? `Last checked ${checkedDate.toLocaleString()}. Player names may be unavailable.`
				: "Last check time unavailable.") + (usingSnapshot ? " Activity history is from a saved snapshot." : "");
		}
		const online = Number.isFinite(stats.players?.online) ? stats.players.online : null;
		const max = Number.isFinite(stats.players?.max) ? stats.players.max : null;
		if (elements.onlineCount) elements.onlineCount.textContent = online === null ? "Unavailable" : max === null ? `${online}` : `${online} / ${max}`;
		const uptime = stats.uptime || calculateUptime(stats.history);
		if (elements.uptimeValue && elements.uptimeDetail && elements.uptimeProgress && elements.uptimePeriod && Number.isFinite(uptime?.percent)) {
			elements.uptimeValue.innerHTML = `${uptime.percent}<span class="stat-unit">%</span>`;
			elements.uptimeDetail.textContent = uptime.detail || "Calculated from history";
			elements.uptimeProgress.style.width = `${Math.min(uptime.percent, 100)}%`;
			elements.uptimePeriod.textContent = uptime.period || "--";
		} else if (elements.uptimeValue && elements.uptimeDetail && elements.uptimeProgress && elements.uptimePeriod) {
			elements.uptimeValue.textContent = "Collecting data";
			elements.uptimeDetail.textContent = "Waiting for history";
			elements.uptimeProgress.style.width = "0%";
			elements.uptimePeriod.textContent = "--";
		}
		renderPlayers(stats.players?.list, online);
		renderChart(stats.history);
	} catch (error) {
		console.warn("Could not load server stats.", error);
		if (elements.serverStatus) elements.serverStatus.textContent = "Status unavailable";
		if (elements.serverStatusDot) elements.serverStatusDot.className = "status-unknown";
		if (elements.statsFreshness) elements.statsFreshness.textContent = "Server data unavailable. Please try again later.";
		if (elements.playerList) elements.playerList.textContent = "Player data unavailable.";
		if (elements.chartEmpty) elements.chartEmpty.textContent = "Activity data unavailable.";
		if (elements.historyFreshness) elements.historyFreshness.textContent = "Activity history unavailable.";
	}
}

loadStats();
setupChartHover();
renderRestartTime();

copyAddressButtons.forEach((button) => button.addEventListener("click", async () => {
	const joinSection = button.closest(".join-section");
	const address = joinSection?.querySelector(".server-address strong")?.textContent;
	if (!address || address === "Loading address" || address === "Address unavailable") return;
	const feedback = joinSection.querySelector(".copy-feedback");
	try {
		await navigator.clipboard.writeText(address);
		button.textContent = "Address copied";
		button.setAttribute("aria-label", "Server address copied");
		if (feedback) feedback.textContent = "Address copied. See you in game!";
	} catch (error) {
		console.warn("Could not copy server address.", error);
		if (feedback) feedback.textContent = "Could not copy automatically. Select and copy the address above.";
	}
	window.setTimeout(() => {
		button.textContent = "Copy address ↗";
		button.setAttribute("aria-label", "Copy server address");
	}, 1600);
}));

let activeInfoButton = null;
function setInfoModal(open) {
	if (!infoModal) return;
	infoModal.hidden = !open;
	document.body.classList.toggle("modal-open", open);
	if (open) closeInfoButton?.focus();
	else activeInfoButton?.focus();
}

openInfoButtons.forEach((button) => button.addEventListener("click", () => {
	activeInfoButton = button;
	setInfoModal(true);
}));
closeInfoButton?.addEventListener("click", () => setInfoModal(false));
infoModal?.addEventListener("click", (event) => {
	if (event.target instanceof HTMLElement && event.target.hasAttribute("data-close-info")) setInfoModal(false);
});
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && infoModal && !infoModal.hidden) setInfoModal(false);
});

let logoClickCount = 0;
let logoClickTimer;
let easterEggTimer;

brandLogo?.addEventListener("click", (event) => {
	logoClickCount += 1;
	window.clearTimeout(logoClickTimer);
	logoClickTimer = window.setTimeout(() => { logoClickCount = 0; }, 1200);
	if (logoClickCount !== 5 || !easterEgg) return;
	event.preventDefault();
	logoClickCount = 0;
	easterEgg.textContent = "Yo were calculating the route....we think its 1.0326794E15, but were not sure thats what Yap told us";
	easterEgg.hidden = false;
	easterEgg.classList.add("is-visible");
	window.clearTimeout(easterEggTimer);
	easterEggTimer = window.setTimeout(() => {
		easterEgg.classList.remove("is-visible");
		easterEggTimer = window.setTimeout(() => { easterEgg.hidden = true; }, 220);
	}, 10000);
});
