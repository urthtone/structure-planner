# Live Hilltop planner build (10 photos)

This is a patched production build of Grok's Vite frontend. The original
source is not in this repo yet. Planner raised the photo cap from 5 to 10
in the compiled bundle and pointed `index.html` at
`assets/bluehost-10photos.js` so Cloudflare will not serve the old file.

To update https://hilltopstructures.us/planner/, upload into
`public_html/website_98d9e671/planner`:

- `index.html` (replace)
- `assets/bluehost-10photos.js` (new file; leave the old hashed JS in place)
- leave the live `config.js` and CSS/favicon as they are unless they are missing

`index.html` already loads `/planner/config.js?v=2`.
