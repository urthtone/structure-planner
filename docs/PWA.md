# Installable Structure Planner PWA

This is a web app you can add to your phone's home screen. It does not require app-store packaging, signing or user sign-in.

## Run and install

```sh
npm ci
npm run build
npm start
```

Use an HTTPS host for production (localhost works for development). Open the site once while online:

- Android / Chrome / Edge: use **Install Structure Planner** when offered, or the browser's Install/Add to Home Screen menu.
- iPhone / Safari: Share → **Add to Home Screen** → Add.

The manifest supplies the app name, standalone display, theme color and 192/512-pixel PNG icons, including a maskable icon and an Apple touch icon. The blueprint-style icons are placeholders and can be replaced in `public/icons/`.

## Offline behavior and privacy

After a successful online production visit and service-worker installation, the wizard, deterministic takeoff engine, example prices and SVG output work offline. The interface shows an offline notice. Photo analysis still needs a network connection and a configured hosted provider. Photo upload/compression itself is local and works offline.

**Photos, notes and price edits are memory-only; reloading clears them.** This is not a saved-project database. No user project data, photos, API responses, POST requests, bearer tokens, foreign URLs or query-bearing requests are stored by the worker. Only the public HTML/JS/CSS/font/icon shell is precached.

`npm run build` runs `scripts/build-sw.mjs` after Next.js builds, generating `public/sw.js` from that build's actual static assets. This generated file is ignored by Git. Deploy the generated worker alongside the corresponding `.next` and `public` files. `next.config.ts` gives the worker no-cache headers so browsers check for updates. Do not serve it with an immutable CDN cache policy.

The cache name includes the build ID. A new version waits until old windows close rather than forcibly reloading and destroying a plan in progress. Close the app's old tabs/windows and reopen to update. Old caches owned by this app are removed on activation; unrelated site caches are untouched.

Development mode does not register a worker. If an older installed production worker interferes with local development on the same origin, unregister it through browser developer tools → Application/Storage. `npm run dev` alone does not provide offline installation.

## Mobile use

The layout supports 390-pixel phone screens and safe-area insets, uses at least 44-pixel input/button targets, and keeps form text at 16 pixels to avoid unwanted iOS zoom. Tables scroll within their panels. The photo picker advertises images and rear-camera capture (`capture="environment"`); exact camera/gallery options depend on the OS/browser. The existing five-image cap, compression, removal and validation apply to camera images too.

Print/PDF still uses the browser's print dialog. Mobile browsers vary in how they expose printing or Save/Share as PDF. Test camera permission denial, camera capture and Safari installation on real phones before a public launch.

## API caveat

The `/api/analyze` server route is unchanged from the planning-engine branch. It has no account system or rate limiter. Before publicly hosting it with a paid vision API key, add appropriate gateway authentication, rate/spending limits and privacy guidance. The PWA does not make this server endpoint available offline and does not put the provider key in its JavaScript bundle. No Azure integration is included.

## Verification

```sh
npm run lint
npm test
npm run test:e2e
npm run test:e2e:pwa
```

The normal browser tests cover photo input/drop, invalid/corrupt images, compression, removal, race protection, price editing, suggestions and PDF output. `test:e2e:pwa` builds production and checks the manifest/icons, camera capture attribute and mobile horizontal layout, then disconnects the browser, reloads and generates the default 10×12 shed estimate. This is browser verification, not proof of physical camera behavior or app installation on every phone OS.
