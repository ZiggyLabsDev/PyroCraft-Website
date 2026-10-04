const copyAddressButton = document.querySelector("#copy-address");
const openInfoButton = document.querySelector("#open-info");
const closeInfoButton = document.querySelector("#close-info");
const infoModal = document.querySelector("#info-modal");
const brandLogo = document.querySelector("#brand-logo");
const easterEgg = document.querySelector("#easter-egg");
const statsUrl = "data/stats.json";

const updatesUrl = "data/updates.json";

const updatesElements = {
	card: document.querySelector("#latest-updates"),
	list: document.querySelector("#updates-list"),
	openButton: document.querySelector("#view-updates"),
	closeButton: document.querySelector("#close-updates"),
	modal: document.querySelector("#updates-modal"),
};


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
	const pointsData = Array.isArray(history)
		? history
			.filter((point) => Number.isFinite(Number(point.players)) && Number.isFinite(Date.parse(point.time)))
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
		if (elements.chartEmpty) elements.chartEmpty.hidden = false;
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
		elements.chartLatest.textContent = `${latestPlayers} online now`;
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

function renderPlayers(players = []) {
	if (!elements.playerList || !Array.isArray(players) || !players.length) {
		if (elements.playerList) {
			elements.playerList.innerHTML = '<div class="empty-state">Player data unavailable</div>';
		}
		return;
	}

	const visiblePlayers = players.slice(0, 5);
	const remainingPlayers = Math.max(players.length - 5, 0);

	elements.playerList.innerHTML = `
		${visiblePlayers.map((player) => `
			<div class="activity-item player-row">
				<p>
					<strong>${player.name}</strong>
					<span>${player.location || "Exploring the world"}</span>
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

function parseMarkdown(markdown) {
	return markdown
		.replace(/^### (.*)$/gm, "<h4>$1</h4>")
		.replace(/^## (.*)$/gm, "<h3>$1</h3>")
		.replace(/^# (.*)$/gm, "<h2>$1</h2>")
		.replace(/^\- (.*)$/gm, "<li>$1</li>")
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.*?)\*/g, "<em>$1</em>")
		.replace(/\n\n/g, "</p><p>");
}

async function loadUpdates() {
	try {
		const response = await fetch(updatesUrl, { cache: "no-store" });

		if (!response.ok) {
			throw new Error("Updates index unavailable");
		}

		const updates = await response.json();

		if (!Array.isArray(updates) || !updates.length) {
			showNoUpdates();
			return;
		}

		const latest = updates.slice(0, 3);

		if (updatesElements.card) {
			updatesElements.card.innerHTML = latest.map((update) => `
				<button
					class="update-preview"
					type="button"
					data-update-file="${escapeHtml(update.file)}"
				>
					<div>
						<strong>${escapeHtml(update.title)}</strong>
						<span>${escapeHtml(update.date)}</span>
					</div>
					<span class="update-arrow">→</span>
				</button>
			`).join("");
		}

		if (updatesElements.list) {
			updatesElements.list.innerHTML = updates.map((update) => `
				<button
					class="update-preview"
					type="button"
					data-update-file="${escapeHtml(update.file)}"
				>
					<div>
						<strong>${escapeHtml(update.title)}</strong>
						<span>${escapeHtml(update.date)}</span>
					</div>
					<span class="update-arrow">→</span>
				</button>
			`).join("");
		}

		document.querySelectorAll("[data-update-file]").forEach((button) => {
			button.addEventListener("click", () => {
				openUpdate(button.dataset.updateFile);
			});
		});

	} catch (error) {
		console.warn("Could not load updates.", error);
		showNoUpdates();
	}
}

function showNoUpdates() {
	const html = '<div class="empty-state">No updates yet.</div>';

	if (updatesElements.card) {
		updatesElements.card.innerHTML = html;
	}

	if (updatesElements.list) {
		updatesElements.list.innerHTML = html;
	}
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

async function openUpdate(filename) {
	try {
		const response = await fetch(`data/updates/${encodeURIComponent(filename)}`, {
			cache: "no-store"
		});

		if (!response.ok) {
			throw new Error("Update unavailable");
		}

		const markdown = await response.text();

		const content = markdown.replace(/^---[\s\S]*?---/, "").trim();

		const updateContent = document.querySelector("#updates-list");

		updateContent.innerHTML = `
			<article class="update-article">
				${parseMarkdown(content)}
			</article>
		`;

		setUpdatesModal(true);

	} catch (error) {
		console.warn("Could not open update.", error);
	}
}

function setUpdatesModal(open) {
	if (!updatesElements.modal) return;

	updatesElements.modal.hidden = !open;
	document.body.classList.toggle("modal-open", open);

	if (open) {
		updatesElements.closeButton?.focus();
	} else {
		updatesElements.openButton?.focus();
	}
}

updatesElements.openButton?.addEventListener("click", () => {
	loadUpdates();
	setUpdatesModal(true);
});

updatesElements.closeButton?.addEventListener("click", () => {
	setUpdatesModal(false);
});

updatesElements.modal?.addEventListener("click", (event) => {
	if (
		event.target instanceof HTMLElement &&
		event.target.hasAttribute("data-close-updates")
	) {
		setUpdatesModal(false);
	}
});

loadUpdates();



function calculateUptime(history) {
	const checks = history || [];
	if (!checks.length) return null;
	return {
		percent: Number(((checks.filter((point) => point.online !== false).length / checks.length) * 100).toFixed(1)),
		detail: `Based on ${checks.length} check${checks.length === 1 ? "" : "s"}`,
		period: `Last ${checks.length} checks`,
	};
}

async function fetchLiveStatus(address) {
	const response = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`);
	if (!response.ok) throw new Error("Live status unavailable");
	const s = await response.json();
	return {
		online: s.online !== false,
		version: s.version?.name_clean || s.version?.name || null,
		players: {
			online: s.players?.online ?? 0,
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

async function loadStats() {
	try {
		const response = await fetch(statsUrl, { cache: "no-store" });
		if (!response.ok) throw new Error("Stats file unavailable");
		let stats = await response.json();
		if (stats.serverAddress) {
			try {
				const live = await fetchLiveStatus(stats.serverAddress);
				const history = [...(stats.history || []), { time: new Date().toISOString(), players: live.players.online, online: live.online }];
				stats = { ...stats, ...live, history };
			} catch (error) {
				console.warn("Live status failed, using stats.json.", error);
			}
		}
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
setupChartHover();
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
