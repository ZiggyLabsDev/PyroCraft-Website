# PyroCraft website

The site is static and can be previewed from the repository root with
`python3 -m http.server 8000`. Open `http://localhost:8000/` in a browser;
opening the HTML directly does not reliably load the command directory, links,
and stats.

## Updating content

- Edit visitor-facing external destinations in `data/external-links.json`.
  Pages load the current URLs automatically when served over HTTP. The
  deployment workflow also generates HTML `href` values so links work without
  JavaScript; run `node scripts/sync-external-links.js` to update those
  fallback values locally. Do not edit the generated values directly. When
  adding an external link, add a key to the JSON, use
  `data-external-link="key" href=""` on its HTML anchor, and run the sync
  command. Pages containing such links must load `external-links.js` with
  `defer`. Font URLs and service/API endpoints are configured separately.
- The homepage copy, server address, joining instructions, settlement cards, and
  guide are in `index.html`. The same server address and joining details also
  appear in `faq/index.html`; keep them in sync when they change. The Worker
  and the saved snapshot in `data/stats.json` also contain the server address.
- The command directory and homepage quick-start modal use `data/commands.json`
  as their shared source. Add or edit entries there; set `quickStart` to `true`
  for commands to show in the homepage guide. Use literal angle brackets in
  JSON strings. Examples are illustrative. Add a verified `cooldownSeconds`
  value to show a cooldown; use `0` for a confirmed no-cooldown command. Add
  server-specific permissions and limits only after they are verified.
- The server rules and consequences are in `rules/index.html`.
- The homepage hero shows `assets/spawn.png`. Update its caption and alt text
  when replacing it with another screenshot.
- The settlement cards appear in both `index.html` and `settlements/index.html`.
  Their images are `assets/ziggy_empire.png`, `assets/shire.png`, and
  `assets/yappy.png`. Update both copies when adding images or details.
- The Ziggy Empire page is `settlements/ziggy-empire/index.html`; its featured
  image is `assets/ziggy_empire.png`. Add photos and settlement details there
  as they become available. Its constitution is in
  `settlements/ziggy-empire/constitution/index.html`.
- The community page is `community/index.html`. Its events section is a
  placeholder; server status uses the same sources as the homepage.
- The site reads activity and uptime from the
  Cloudflare Worker configured in `script.js`, and attempts a separate live
  status check. The chart shows samples from the last 96 hours; actual retention
  and check frequency are controlled by the Worker. If the Worker cannot be
  reached, the site labels and uses the saved `data/stats.json` snapshot.
  Run `node scripts/fetch-stats.js` from the repository root to refresh that
  snapshot manually, then commit it for deployment if desired. If the Worker
  URL changes, update it in both `script.js` and `scripts/fetch-stats.js`.
- The server location and restart schedule are in `index.html`; the restart
  conversion is in `script.js`. Keep them current if the server moves.

Visitors can choose a system, light, or dark theme across the site, including
the Ziggy Empire constitution pages. Their choice is saved in the browser's
local storage. System mode follows the device's current theme.

The main site uses entrance, scroll, and interaction animations. Scroll reveals
begin when at least 25% of an element is visible; unusually large elements that
cannot reach that threshold stay visible. The homepage hero screenshot pans
automatically from side to side. Animations respect reduced-motion
preferences, and content remains visible without JavaScript or intersection
observers.
