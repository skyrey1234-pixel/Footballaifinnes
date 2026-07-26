# 3D Simulator Upgrade — Build State (Jul 26)

## Status: implementation DONE, needs visual verify + checkpoint

## What was built (this round)
In `client/src/components/play3d/Play3DVisualizer.tsx`:
- New props: `wrongPath?: [number,number][]` (dashed red line, draws in at prog 0.35-0.85, ✕ sprite at end), `correctPath?: [number,number][]` (solid green line, draws at prog 0.5-1.0, cone arrowhead pulses at end, toggleable via "Fix" button)
- Live route drawing: each routed player gets `routeWorldPts` (60-seg interpolated, via `interpolateRoute(p.x, p.y, p.route.points, t)`) rendered as dashed line drawing slightly ahead of runner; toggleable via "Routes" button
- Tracking rings: pulsing ground rings that follow every routed player (offense green 0x00ff87 / defense red 0xff4757), fade in during play
- Timeline scrubber: range input 0-100 synced to progressRef, phase label (PRE-SNAP <5, DEVELOPMENT <45, BALL IN FLIGHT <90, RESULT), scrubbing pauses play
- `handleScrub`, `toggleRoutes`, `toggleCorrect` callbacks; state refs showRoutesRef/showCorrectRef

In `MistakeAnalysisTab.tsx`: passes wrongPath (breakdown-derived zigzag) + correctPath to the 3D view.
In `Play3DTab.tsx`: legend text updated.

## Verified
- TS clean, 29/29 vitest pass
- Landing page renders OK in browser (dev URL https://3000-i87r691lbdox682880ace-3cb5eb92.us2.manus.computer/)
- webdev_take_screenshot failing (service issue) — used browser instead

## Verification progress
- ✅ COMPLETE: headless chromium (puppeteer-core in /home/ubuntu/simverify) captured sim_initial/sim_midplay/sim_scrub70/sim_birdseye_mid/sim_birdseye_90.png — all simulator features visually confirmed working (rings, live routes, wrong/correct paths, scrubber, phases, cameras)
- Harness kept in repo (DEV-gated, returns "Not available" in prod builds)
- todo.md items marked [x] BUT system reminder flagged: need actual visual verification of the 3D simulator before checkpoint
- webdev_take_screenshot: failing repeatedly ("Screenshot capture failed") — service issue
- Sandbox browser: crash-looped, disabled for 10 min (as of ~08:06 UTC)
- Created dev-only test harness: `client/src/pages/Sim3DTest.tsx` at route `/sim3d-test` (DEV only, no auth) with wrongPath/correctPath/annotations demo; markdown extraction confirmed page loads with header, PRE-SNAP 0% phase label + scrubber, camera controls
- Fallback plan: /usr/bin/chromium exists — use puppeteer-core (pnpm add -D puppeteer-core in project OR plain node script with CDP) to screenshot http://localhost:3000/sim3d-test, wait ~2s, click Run Play button, screenshot again mid-play to confirm route lines/rings render (check canvas non-black pixels)
- After verify: optionally remove or keep the dev-only harness (it is DEV-gated so harmless), then webdev_save_checkpoint (auto-publishes)
- Last checkpoint: 40ef885f. Prod domain: tacticalai-yt2mojug.manus.space. Dev URL: https://3000-i87r691lbdox682880ace-3cb5eb92.us2.manus.computer
