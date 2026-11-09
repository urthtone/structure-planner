# Live planner frontend

This is the source for https://hilltopstructures.us/planner/.
It is the Vite app served from Bluehost. It is not the Next.js app in `src/` at the repo root.

## Build

```bash
cd frontend
npm install
npm test
npm run build
```

The build writes `frontend/bluehost/planner/`. Upload that folder to
`public_html/website_98d9e671/planner`, replacing the old files.
`bluehost-public/config.js` is copied into the build. It holds the public
Azure function URL only. Never put the xAI key in this repo or in that file.

`index.html` loads `/planner/config.js?v=3` before the app module so a cached
empty config cannot win.

## Already in this source

- Photos are reduced in the browser until each data URL is under 350,000 characters.
- The plan sheet draws the floor frame, front wall, and roof section, plus a cut list.
- A 10×12×8 wood shed takeoff is 10 joists, 34 studs at 7 ft 7 1/2 in, and 20 rafters.

## Not in this commit

- No service worker and no install manifest. James asked for a website, not a home-screen app, until he says otherwise. `.htaccess` is included.
- When the photo reader fails, the page still shows the error and the framing takeoff. A separate retry button is not built yet.
- Welding screens and PDF/Word export wait on `docs/WELDING.md` and Planner's export module. Do not rebuild those here.
