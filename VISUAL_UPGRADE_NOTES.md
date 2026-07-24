# Visual/Interactive Upgrade Round — build notes (Jul 24)

## User request (9 upgrades)
1. Analysis wait → dynamic progress bar + live stage updates + engaging animations (3 min feels fast)
2. Scouting report → interactive charts (tendency donuts, run/pass splits, tooltips)
3. AI Film Breakdown → pre-timed clips: video seeks to highlight timestamp, plays ONLY that segment (auto-pause), not whole 10 min
4. Player Profiles → per-player best-play video clip + tracking circle overlay on player + "how to stop him" callout
5. Game Plan → animated play diagrams for ALL suggested plays (routes drawing live, Madden-style)
6. 3D Plays expanded → ball-flight animation (where football is thrown) + circles/lines showing wrong vs right
7. Mistake Analysis → animated red (wrong) vs green (correct) lines
8. Beat This Defense → replace "visualization coming soon" with real play viz
9. War Room Ask the Film → answer jumps session video to exact timestamp + annotation circles overlay

## Existing architecture (surveyed)
- `client/src/components/gameplan/FormationDiagram.tsx` (446 ln) — ALREADY a full SVG play engine:
  - exports: PlayerPos iface {x,y,label,side,route:{points,type route|block|blitz|zone}}, getOffensivePlayers(formation,playType,target), getDefensivePlayers(scheme), interpolateRoute(startX,startY,points,progress)
  - has requestAnimationFrame play animation (2.5s), partial path drawing, play/pause/reset buttons, viewBox "0 0 100 85", LOS at y=50, field green #0f2b0f
  - REUSE THIS as the shared engine — extend with: ball-flight arc, wrong/right annotation overlays (red/green circles+lines), defender movement
- `client/src/components/film/FilmBreakdown.tsx` (384 ln) + `AnnotationCanvas.tsx` (184 ln) — has annotation overlay canvas already (circles/arrows/zones/labels from ai.annotateHighlight)
- `client/src/components/film/VideoPlayer` — check src/components/report/VideoPlayer.jsx? Actual player used in SessionPage: search "VideoPlayer" in client/src
- `client/src/components/players/PlayerProfiles.tsx` (177 ln)
- `client/src/components/gameplan/GamePlanGenerator.tsx` (414 ln) — uses FormationDiagram (has compact mode)
- `client/src/components/play3d/Play3DVisualizer.tsx` (442 ln, Three.js) + Play3DTab.tsx (129)
- `client/src/components/mistakes/MistakeAnalysisTab.tsx` (194)
- `client/src/components/highlights/HighlightReelTab.tsx` (202)
- `client/src/components/warroom/AskFilmPanel.tsx` (79) — War Room page has NO video player currently (WarRoomPage.tsx 134 ln)
- `client/src/pages/NewSession.tsx` (362) — has createMutation + analyzeMutation (analyze fired after create, navigates to /session/:id)
- SessionPage.tsx (432) — polls sessions.get every 5s while analyzing; shows yellow "AI Analysis in Progress" card
- recharts likely NOT installed; check package.json (Chart.js not installed either — template mentions shadcn chart component based on recharts: client/src/components/ui/chart.tsx EXISTS → recharts IS available)

## Video sources
- Sessions have videoFileKey (S3) or youtubeVideoId. Uploaded video playable via signed URL — find how FilmBreakdown/VideoPlayer gets URL (likely trpc endpoint storageGet)
- Highlights have {timestamp "MM:SS", seconds, title, note, category, verdict}

## Progress-stage plan (item 1)
- Server: analysis currently has no progress reporting. Add `analysisStage` column? Simpler: db.updateGameSessionStatus stays; add progress stages via a new `analysis_progress` table OR reuse session.updatedAt + client-side simulated stages. DECISION: client-side simulated stage timeline (deterministic, no schema change) driven by elapsed time since createdAt, with stages: Uploading done → Downloading film → Extracting frames → AI watching plays → Writing report → Finalizing. Cap at 95% until status flips complete.

## Key facts
- Prod: tacticalai-yt2mojug.manus.space | tests: 25 passing | tsc clean
- Dark cinematic theme utilities in index.css: glass, anim-rise, glow, field-grid etc.
- User is admin. Session 330001 "10 min filmm" complete with 7 highlights (videoFileKey videos/1784919786548-segment_001.mp4)

## PROGRESS (Jul 24 late)
DONE:
- Item 1 (progress bar): created client/src/components/AnalysisProgress.tsx — cinematic staged progress (5 stages, eased % capped 96, scan sweep, hype lines); wired into SessionPage analyzing + reanalyzing blocks (import added).
- Item 3 (pre-timed clips): created client/src/components/film/ClipPlayer.tsx — plays ONLY startSeconds..+clipDuration (uploaded video seeks+auto-pauses w/ clip progress bar + replay; YouTube uses start&end embed params); wired into FilmBreakdown expanded view (replaces raw video/iframe, keeps AnnotationCanvas overlay via `overlay` prop).
- Item 2 (report charts): created client/src/components/report/ReportCharts.tsx (recharts: verdict donut w/ hover glow, phase-breakdown bars, game-flow timeline scatter w/ custom tooltip) wired into ReportView above sections.

ALSO DONE (Jul 24, continued):
- Item 4: server ai.playerSpotlight procedure (routers.ts after annotateHighlight) returns {highlightIndex, spotlightTitle, whatHeDoes, howToStop, circle{x,y,radius}, arrows[], highlight}. PlayerProfiles.tsx now takes optional `session` prop {sourceType,youtubeVideoId,videoUrl} (passed from SessionPage line ~241), renders Film Spotlight button in expanded card → ClipPlayer at highlight.seconds w/ SpotlightOverlay (pulsing yellow circle + red/blue arrows) + What He Does / How to Stop Him cards.
- Item 5a: FormationDiagram extended with showBall prop (default true): pass = parabolic gold-arc ball release at 45% progress to primary target route end (label-match target else deepest route) w/ CATCH ring + static throw-lane preview at progress>=1; run = ball rides RB. GamePlanGenerator uses FormationDiagram in 3 spots — inherits ball automatically.
- Item 5b: BeatThisDefenseTab placeholder replaced with live animated FormationDiagram vs selected defense (key remount on selection change), 6 plays w/ playType, dark-theme result card fix.
- Item 6a: Play3DVisualizer new props showBall (default true) + annotations[{kind wrong|right,x,y,label}] — 3D ball throw arc w/ spiral + gold ground lane + catch ring; pulsing red/green annotation rings + beacon beams + floating label sprites. Play3DTab passes showBall + legend row.
- Item 6b: MistakeAnalysisTab adds side-by-side animated 2D chalkboards (red-tinted ACTUAL w/ ping breakdown marker at breakdownMoment, green CORRECT w/ ball) + passes annotations to the 3D visualizer (wrong ring on actual view, right ring on correct).

REMAINING:
- Item 7: AskFilmPanel.tsx (79 ln, client/src/components/warroom/) — extend warRoom.askFilm procedure (server/warRoomRouter.ts line ~175) to also return matched clip {seconds,timestamp,label} from report highlights (LLM picks index); UI adds ClipPlayer jump + annotation circles (reuse ai.annotateHighlight or simple circle overlay). WarRoomPage must pass session video fields into AskFilmPanel.
- Item 8 (final): tsc + vitest run + screenshots + update todo.md (mark 9 items) + checkpoint + deliver result.

## Gotchas
- BeatThisDefenseTab/GameDay/CallSheet/VoiceCoach export NAMED components (import { X }).
- FormationDiagram exports: FormationDiagram, getOffensivePlayers, getDefensivePlayers, interpolateRoute, PlayerPos. viewBox "0 0 100 85", LOS y=50, offense below (y>50), defense above.
- session fields: sourceType "youtube"|"upload", youtubeVideoId, videoUrl (S3 signed), highlights[{timestamp,seconds,title,note,category,verdict}] (verdict "good"|"bad").
- ai.annotateHighlight returns {annotations[{type circle|arrow|zone|label,x,y,x2,y2,radius,color,label}], coaching_callout, alternative_play, verdict} — AnnotationCanvas renders % coords 0-100.
- Do NOT run dev server checks with long vitest each edit; batch verification at end.
