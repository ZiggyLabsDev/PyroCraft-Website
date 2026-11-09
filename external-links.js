(() => {
	const linksUrl = new URL("data/external-links.json", document.currentScript.src);
	const anchors = [...document.querySelectorAll("a[data-external-link]")];
	if (!anchors.length) return;

	for (const anchor of anchors) {
		anchor.removeAttribute("href");
		anchor.setAttribute("aria-disabled", "true");
		anchor.setAttribute("aria-busy", "true");
	}

	async function loadExternalLinks() {
		try {
			const response = await fetch(linksUrl, { cache: "no-store" });
			if (!response.ok) throw new Error(`External links returned ${response.status}`);
			const links = await response.json();
			if (!links || typeof links !== "object" || Array.isArray(links)) throw new Error("External links must be a JSON object.");

			const destinations = anchors.map((anchor) => {
				const key = anchor.dataset.externalLink;
				if (!Object.hasOwn(links, key) || typeof links[key] !== "string") throw new Error(`Missing external link "${key}".`);
				const url = new URL(links[key]);
				if (!["https:", "http:"].includes(url.protocol)) throw new Error(`External link "${key}" must use HTTP or HTTPS.`);
				return links[key];
			});

			anchors.forEach((anchor, index) => {
				anchor.href = destinations[index];
				anchor.removeAttribute("aria-disabled");
				anchor.removeAttribute("aria-busy");
			});
		} catch (error) {
			console.error("Could not load external links.", error);
			anchors.forEach((anchor) => anchor.removeAttribute("aria-busy"));
			const message = document.createElement("p");
			message.className = "external-links-error";
			message.setAttribute("role", "alert");
			message.textContent = "External links could not be loaded. Please reload the page or try again later.";
			document.body.prepend(message);
		}
	}

	loadExternalLinks();
})();
