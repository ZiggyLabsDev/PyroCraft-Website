(() => {
	if (!("IntersectionObserver" in window)) return;

	const revealThreshold = 0.25;
	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting || entry.intersectionRatio < revealThreshold) return;
			entry.target.classList.remove("motion-pending");
			entry.target.classList.add("motion-reveal");
			observer.unobserve(entry.target);
		});
	}, { threshold: revealThreshold });

	const elements = document.querySelectorAll(
		".section-intro, .feature-card, .kingdom-card, .join-section, " +
		".hub-grid > article, .join-steps > div, .subpage-hero, .detail-card, " +
		".page-content .welcome-row, .page-content .panel, .page-content .community-card"
	);

	function canReachThreshold(element) {
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return false;
		const visibleFraction = Math.min(window.innerWidth / rect.width, 1) * Math.min(window.innerHeight / rect.height, 1);
		return visibleFraction >= revealThreshold;
	}

	elements.forEach((element) => {
		if (!canReachThreshold(element)) return;
		element.classList.add("motion-pending");
		observer.observe(element);
	});

	window.addEventListener("resize", () => {
		elements.forEach((element) => {
			if (element.classList.contains("motion-pending") && !canReachThreshold(element)) {
				element.classList.remove("motion-pending");
				observer.unobserve(element);
			}
		});
	});
})();
