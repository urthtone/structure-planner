# Fab-Planner source

Vite app branded Fab-Planner. The URL stays https://hilltopstructures.us/planner/.
`frontend/live-build/` is the built upload. This folder is the source.

```bash
cd frontend
npm install
npm test
npm run build
```

The build writes `frontend/bluehost/planner/`. Copy that into
`/home2/conniew7/planner-work/frontend/live-build/` and deploy with
`scripts/safe-deploy.sh`. The script never copies `config.js`.

Photos: up to 10. Each is a JPEG, starting at 1600px and quality 0.8, and
never longer than 650,000 data-URL characters.

A failed reader call stays on the details step, shows the error, and offers
Try again. The framing takeoff runs only if you choose it.
