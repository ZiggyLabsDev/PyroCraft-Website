(() => {
	const themeKey = "pyrocraft-theme";
	const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
	let preference = "system";
	let storageError = false;

	try {
		const saved = localStorage.getItem(themeKey);
		if (["system", "dark", "light"].includes(saved)) preference = saved;
	} catch (error) {
		console.warn("Could not read display preferences.", error);
		storageError = true;
	}

	function applyTheme() {
		document.documentElement.dataset.theme = preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
		document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
	}

	function reportStorageError() {
		let message = document.querySelector("#preference-error");
		if (!message) {
			message = document.createElement("p");
			message.id = "preference-error";
			message.className = "preference-error";
			message.setAttribute("role", "status");
			document.body.append(message);
		}
		message.textContent = "Display preferences could not be saved in this browser.";
	}

	function savePreference(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch (error) {
			console.warn("Could not save display preference.", error);
			reportStorageError();
		}
	}

	applyTheme();
	systemTheme.addEventListener("change", () => {
		if (preference === "system") applyTheme();
	});

	document.addEventListener("DOMContentLoaded", () => {
		document.querySelectorAll(".theme-switch input").forEach((input) => {
			input.checked = input.value === preference;
			input.addEventListener("change", () => {
				preference = input.value;
				applyTheme();
				savePreference(themeKey, preference);
				document.querySelectorAll(".theme-switch input").forEach((option) => {
					option.checked = option.value === preference;
				});
			});
		});
		if (storageError) reportStorageError();
	});
})();
