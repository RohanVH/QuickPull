# QuickPull

QuickPull is a premium universal media downloader scaffold built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, GSAP, and a Python `yt-dlp` processor.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Framer Motion + GSAP
- Three.js hero scene
- Next.js route handlers for preview/download orchestration
- FastAPI + yt-dlp microservice for metadata and downloads

## Run locally

1. `npm install`
2. `npm run dev`
3. In a second terminal:
   `cd python-service && pip install -r requirements.txt && uvicorn app:app --reload --port 8000`

Set `PYTHON_SERVICE_URL=http://localhost:8000` for local development.

## Run with Docker

If local Python setup is giving you trouble, run both services with Docker instead:

1. `docker compose up --build`
2. Open `http://localhost:3000`
3. Backend health check: `http://localhost:8000/health`

To stop:

- `docker compose down`

Downloaded files are stored in the named Docker volume `quickpull-downloads`.

## Notes

- API routes include URL validation, SSRF protections, simple rate limiting, cache hooks, and a queue-backed download flow.
- SEO pages, sitemap, robots, JSON-LD, local history, light/dark theme toggle, and basic PWA assets are included.
- For production, replace the in-memory cache/rate limiter/queue with Redis-backed implementations and expose the Python service behind signed download URLs or object storage.
