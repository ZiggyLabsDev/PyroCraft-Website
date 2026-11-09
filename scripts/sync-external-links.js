const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const linksPath = path.join(root, "data", "external-links.json");
const links = JSON.parse(fs.readFileSync(linksPath, "utf8"));
const usedKeys = new Set();
const updates = [];

if (!links || typeof links !== "object" || Array.isArray(links)) {
	throw new Error("External links must be a JSON object.");
}

for (const [key, value] of Object.entries(links)) {
	if (typeof value !== "string") throw new Error(`External link "${key}" must be a URL string.`);
	const url = new URL(value);
	if (!["https:", "http:"].includes(url.protocol)) throw new Error(`External link "${key}" must use HTTP or HTTPS.`);
}

function visit(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			visit(file);
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			const original = fs.readFileSync(file, "utf8");
			const updated = original.replace(/<a\b[^>]*>/gi, (tag) => {
				const keyMatch = tag.match(/\bdata-external-link="([^"]+)"/);
				if (!keyMatch) return tag;
				const key = keyMatch[1];
				if (!Object.hasOwn(links, key)) throw new Error(`Unknown external link "${key}" in ${path.relative(root, file)}.`);
				if (!/\bhref="[^"]*"/.test(tag)) throw new Error(`External link "${key}" has no href in ${path.relative(root, file)}.`);
				usedKeys.add(key);
				const escaped = links[key].replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
				return tag.replace(/\bhref="[^"]*"/, () => `href="${escaped}"`);
			});
			if (updated !== original) updates.push({ file, updated });
		}
	}
}

visit(root);
for (const key of Object.keys(links)) {
	if (!usedKeys.has(key)) throw new Error(`External link "${key}" is not used by any page.`);
}
for (const { file, updated } of updates) {
	fs.writeFileSync(file, updated);
	console.log(`Updated ${path.relative(root, file)}`);
}
console.log(`Checked ${usedKeys.size} external link destinations.`);
