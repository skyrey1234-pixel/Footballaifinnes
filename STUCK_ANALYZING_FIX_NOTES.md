# Stuck "analyzing" fix — state notes (Jul 24, 2026)

## User report
"my 10 min video still says analyzing, how long does it usually take"

## Diagnosis (from prod logs + DB)
- Session ID 330001 "10 min filmm" (upload) created 2026-07-24 19:03:22 UTC, status=analyzing, never updated.
- Prod log: "Server running" at 19:05:12Z → serverless instance recycled ~2 min after session creation, killing the fire-and-forget generateReport() background task silently.
- Root cause: sessions.create fired generateReport() without awaiting; serverless (Cloud Run autoscale) doesn't guarantee background work after response returns. 180s request timeout.

## Fixes applied (server/routers.ts + client/src/pages/SessionPage.tsx)
1. sessions.list + sessions.get: watchdog — any session with status=analyzing and updatedAt older than 10 min is flipped to failed (visible Retry path).
2. NEW sessions.analyze endpoint: awaited generateReport (holds serverless instance alive); create is fast again (no analysis inline). NewSession fires analyze after create then navigates — React Query mutations survive component unmount, and the HTTP request itself keeps the prod instance alive. reanalyze also awaits and passes videoFileKey (was missing — uploads reanalyzed name-only before).
3. Vision step bounded by 110s Promise.race timeout so awaited pipeline fits under the 180s request cap.
4. SessionPage: Retry button wired to trpc.sessions.reanalyze with pending state + invalidation; analyzing copy updated to honest 1-3 min ETA.

## Remaining steps
- [x] tsc clean, 23/23 vitest passing
- [ ] Checkpoint (auto-publishes)
- [ ] Recover user's stuck session 330001: after deploy, flip to failed via watchdog (or SQL), then trigger reanalyze — OR just tell user to hit Retry button.
  NOTE: reanalyze is adminProcedure; user is admin (skyler rey Trinidad, role Admin) so the Retry button works for them.
- [ ] Verify on production: session 330001 shows failed + Retry, and reanalysis completes.

## Key facts
- Prod domain: tacticalai-yt2mojug.manus.space
- game_sessions table: id, opponentName, sourceType, status(analyzing|complete|failed), videoFileKey, youtubeVideoId, createdAt, updatedAt
- Client mutation timeout risk: awaited create can now take up to ~3 min; NewSession's createMutation shows "Starting Analysis..." spinner meanwhile. tRPC client has no default timeout — OK.
- yt-dlp NOT installed in production image → YouTube sessions always fall back to name-only report (logged 18:04). Uploaded files DO get vision analysis via ffmpeg (ffmpeg presence in prod unverified — if missing, falls back gracefully).
