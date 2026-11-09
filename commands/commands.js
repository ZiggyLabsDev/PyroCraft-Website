const commandsUrl = new URL("../data/commands.json", document.currentScript.src);
const directory = document.querySelector("#command-directory");
const searchInput = document.querySelector("#command-search");
const commandStatus = document.querySelector("#command-status");
const filterButtons = [...document.querySelectorAll("[data-command-filter]")];
const quickStart = document.querySelector("#quick-start-commands");
const categoryLabels = {
	explore: "Getting around",
	players: "Players",
	claims: "World & claims",
	participate: "Jobs & voting",
};
const categoryDescriptions = {
	explore: "Find your way home.",
	players: "Connect with the community.",
	claims: "Protect and manage your space.",
	participate: "Take part in the server.",
};

function createCopyButton(syntax) {
	const button = document.createElement("button");
	button.className = "command-copy";
	button.type = "button";
	button.textContent = "Copy";
	button.setAttribute("aria-label", `Copy ${syntax}`);
	button.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(syntax);
			button.textContent = "Copied";
			button.setAttribute("aria-label", `Copied ${syntax}`);
		} catch (error) {
			console.error("Could not copy command to clipboard.", error);
			button.textContent = "Copy failed";
			button.setAttribute("aria-label", `Could not copy ${syntax}; select and copy it manually`);
		}
	});
	return button;
}

function createCommandEntry(command, includeExample = true) {
	const entry = document.createElement("article");
	entry.className = "command-entry";

	const syntaxRow = document.createElement("div");
	syntaxRow.className = "command-syntax";
	const code = document.createElement("code");
	code.textContent = command.syntax;
	syntaxRow.append(code, createCopyButton(command.syntax));

	const details = document.createElement("details");
	details.className = "command-entry-details";
	const summary = document.createElement("summary");
	summary.textContent = "View more details";
	const description = document.createElement("p");
	description.textContent = command.description;
	details.append(summary, description);
	if (Number.isInteger(command.cooldownSeconds) && command.cooldownSeconds >= 0) {
		const cooldown = document.createElement("p");
		cooldown.className = "command-cooldown";
		cooldown.textContent = command.cooldownSeconds === 0
			? "Cooldown: none"
			: `Cooldown: ${command.cooldownSeconds} seconds`;
		details.append(cooldown);
	}
	if (includeExample && command.example) {
		const example = document.createElement("p");
		example.className = "command-example";
		const label = document.createElement("span");
		label.textContent = "Example";
		const exampleCode = document.createElement("code");
		exampleCode.textContent = command.example;
		example.append(label, exampleCode);
		details.append(example);
	}

	entry.append(syntaxRow, details);
	return entry;
}

function renderDirectory(commands, selectedCategory, searchTerm) {
	const matchingCommands = commands.filter((command) => {
		const matchesCategory = selectedCategory === "all" || command.category === selectedCategory;
		const cooldown = Number.isInteger(command.cooldownSeconds) && command.cooldownSeconds >= 0
			? command.cooldownSeconds === 0 ? "no cooldown" : `${command.cooldownSeconds} seconds cooldown`
			: "";
		const searchable = `${command.syntax} ${command.description} ${command.example || ""} ${categoryLabels[command.category]} ${cooldown}`.toLowerCase();
		return matchesCategory && searchable.includes(searchTerm);
	});
	directory.replaceChildren();

	for (const category of Object.keys(categoryLabels)) {
		const categoryCommands = matchingCommands.filter((command) => command.category === category);
		if (!categoryCommands.length) continue;

		const card = document.createElement("section");
		card.className = "detail-card command-category";
		const index = document.createElement("span");
		index.className = "card-index";
		index.textContent = `${String(Object.keys(categoryLabels).indexOf(category) + 1).padStart(2, "0")} / ${categoryLabels[category].toUpperCase()}`;
		const heading = document.createElement("h3");
		heading.textContent = categoryLabels[category];
		const list = document.createElement("div");
		list.className = "command-list";
		list.setAttribute("aria-label", `${categoryLabels[category]} commands`);
		for (const command of categoryCommands) list.append(createCommandEntry(command));
		card.append(index, heading, list);
		directory.append(card);
	}

	commandStatus.textContent = matchingCommands.length
		? `Showing ${matchingCommands.length} of ${commands.length} commands.`
		: "No commands match your search. Try another word or category.";
}

function renderQuickStart(commands) {
	if (!quickStart) return;
	quickStart.replaceChildren();
	for (const category of Object.keys(categoryLabels)) {
		const categoryCommands = commands.filter((command) => command.quickStart && command.category === category);
		if (!categoryCommands.length) continue;
		const group = document.createElement("section");
		group.className = "command-group";
		const heading = document.createElement("div");
		heading.className = "command-group-heading";
		const index = document.createElement("span");
		index.className = "command-index";
		index.textContent = String(Object.keys(categoryLabels).indexOf(category) + 1).padStart(2, "0");
		const title = document.createElement("div");
		const name = document.createElement("h3");
		name.textContent = categoryLabels[category];
		const description = document.createElement("p");
		description.textContent = categoryDescriptions[category];
		title.append(name, description);
		heading.append(index, title);
		const list = document.createElement("div");
		list.className = "command-list";
		for (const command of categoryCommands) list.append(createCommandEntry(command, false));
		group.append(heading, list);
		quickStart.append(group);
	}
}

async function loadCommands() {
	try {
		const response = await fetch(commandsUrl);
		if (!response.ok) throw new Error(`Command list returned ${response.status}`);
		const commands = await response.json();
		if (!Array.isArray(commands) || commands.some((command) =>
			typeof command.syntax !== "string" ||
			typeof command.category !== "string" ||
			typeof command.description !== "string" ||
			!categoryLabels[command.category]
		)) {
			throw new Error("Command list contains invalid entries");
		}

		if (directory && searchInput && commandStatus) {
			let selectedCategory = "all";
			const update = () => renderDirectory(commands, selectedCategory, searchInput.value.trim().toLowerCase());
			searchInput.addEventListener("input", update);
			for (const button of filterButtons) {
				button.addEventListener("click", () => {
					selectedCategory = button.dataset.commandFilter;
					for (const filter of filterButtons) filter.setAttribute("aria-pressed", String(filter === button));
					update();
				});
			}
			update();
		}
		renderQuickStart(commands);
	} catch (error) {
		console.error("Could not load the command directory.", error);
		if (commandStatus) commandStatus.textContent = "Commands could not be loaded. Please try again later or ask for help on Discord.";
		if (quickStart) quickStart.textContent = "Commands could not be loaded. Visit the commands page or ask for help on Discord.";
	}
}

if (directory || quickStart) loadCommands();
