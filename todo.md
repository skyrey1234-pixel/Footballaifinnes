# TacticalEdge AI — Project TODO

- [ ] LIVE SCREEN SHARE: Add a third Live source that uses browser display capture for a selected tab, window, or screen
- [ ] LIVE SCREEN SHARE: Run the existing five-second frame scheduler, two-prediction engine, unit memory, and impact-player tracking against the shared display stream
- [ ] LIVE SCREEN SHARE: Add explicit start, pause, resume, stop-sharing, ended-stream, permission-denied, and unsupported-browser behavior
- [ ] LIVE TV VIEW: Add a dedicated full-screen second-screen route with the live feed where technically available, two predictions, score/situation, unit intelligence, impact players, and timeline updates
- [ ] LIVE TV VIEW: Secure second-screen access with an expiring session-scoped token rather than exposing private game intelligence publicly
- [ ] LIVE TV VIEW: Add an Open TV View action plus copyable link and QR/pairing guidance for smart-TV browsers or connected displays
- [ ] LIVE TV VIEW: Synchronize TV View from persisted session and event data without unsupported background timers
- [ ] LIVE SHARE/TV: Add regression tests for source selection, display-capture lifecycle, token integrity/expiry, owner scope, and TV data projection
- [ ] LIVE SHARE/TV: Verify replay scanning, screen-share capture behavior, and TV View desktop/mobile/16:9 layouts before production release

- [ ] BUG: Prevent Live View from rendering a video element with src="" while the protected replay URL is loading; preserve camera mode, add source-readiness regression coverage, and verify the console warning is gone

- [ ] BUG: Live Mode scan failure — model truncation recovery and direct production API analysis are fixed, but the browser replay path can still remain on “Waiting for frames” without submitting analyzeWindow; fix the end-to-end browser capture path
- [ ] BUG: Verify a new uploaded-replay session in production advances from playback to a persisted five-second event visible in the timeline without direct API assistance
- [ ] BUG: Verify a real camera-mode production session captures frames and displays a new five-second event; preserve clear permission/error guidance when no camera is available

- [x] LIVE 5S: Change the rolling analysis cadence from 15 seconds to 5 seconds across schema defaults, backend validation, UI timing, labels, and tests
- [x] LIVE 5S: Prevent overlapping AI requests and safely queue or skip windows when a model response takes longer than five seconds
- [x] LIVE 5S: Classify each window as filmed team on offense, defense, special teams, transition, or unclear with evidence and confidence
- [x] LIVE 5S: Maintain separate cumulative offense and defense tendency memory throughout each live session
- [x] LIVE 5S: Generate exactly two ranked next-play predictions with probabilities, evidence, reasoning, and recommended counters every analyzed window
- [x] LIVE 5S: Track the most impactful offensive and defensive players across the game without inventing player identities
- [x] LIVE 5S: Display separate offense intelligence, defense intelligence, player-impact leaders, and two next-play prediction cards in Live View
- [x] LIVE 5S: Persist cumulative game memory and player-impact data so refresh, pause, and resume do not reset the learned profile
- [x] LIVE 5S: Add regression tests for cadence, possession classification, two-prediction normalization, memory accumulation, race safety, and identity uncertainty
- [x] LIVE 5S: Validated two sequential five-second windows with real football footage, verified desktop/mobile layouts, confirmed a new production session stores interval 5, and published

- [x] BUG: Open Live Command Center launch repaired — removed the silent disabled state, added actionable replay selection and camera-ready guidance, verified camera-mode creation on production through session 390003, and removed the temporary verification session

- [x] BUG: Game-session deletion now removes all 15 module rows and shared advanced-analytics evidence records; integration-tested across every analytics table

- [x] LIVE INTELLIGENCE: Add a dedicated Live View section accessible from the main navigation
- [x] LIVE INTELLIGENCE: Support uploaded game footage as a controllable live-feed simulator for testing
- [x] LIVE INTELLIGENCE: Add browser camera/live-stream input architecture with explicit start, pause, resume, and stop controls
- [x] LIVE INTELLIGENCE: Analyze rolling five-second footage windows without overlapping jobs or duplicate predictions
- [x] LIVE INTELLIGENCE: Generate exactly two ranked next-play probabilities plus formation, personnel, coverage/front, tendency shifts, risk alerts, and recommended counter calls
- [x] LIVE INTELLIGENCE: Show timestamped evidence, confidence, input source, and AI-estimated labels for every live insight
- [x] LIVE INTELLIGENCE: Build a cinematic command center with video, live status, scoreboard/situation controls, prediction cards, tendency charts, and analysis timeline
- [x] LIVE INTELLIGENCE: Persist live sessions and analysis events with owner-only access and safe recovery after refresh
- [x] LIVE INTELLIGENCE: Add backend and frontend tests for timing, permissions, parsing, start/stop behavior, and error recovery
- [x] LIVE INTELLIGENCE: Verify uploaded-footage simulation end to end and publish the feature

- [x] BUG: Fresh production sign-in reached /api/oauth/callback but returned {"error":"OAuth callback failed"} — production logs identified a users-table schema mismatch; added the three missing school profile columns, repaired the duplicated 0006 migration statement, and added a live-schema OAuth upsert regression test. Final owner browser verification is tracked separately below.

- [x] ACCESS: Identified the sole verified project-owner user record, enforced the admin role on that exact account only, and confirmed the stored role is admin without changing any other users

- [x] Production Google/provider handoff now reaches TacticalEdge’s OAuth callback with the correct app ID, redirect URI, state nonce, and cookie
- [x] Add user-facing landing-page guidance for the account-restoration prompt, Google 403 alternatives, and the official sign-in support path
- [x] After resolving the provider and callback issues, verified production sign-in reaches the TacticalEdge dashboard and the owner account displays the Admin role

- [x] Database schema: gameSessions and scoutingReports tables
- [x] Dark theme setup (#0D1117 bg, #00FF87 accent, Space Grotesk + Inter fonts)
- [x] Backend: game session CRUD (create, list, get, delete)
- [x] Backend: video file upload to S3 with progress
- [x] Backend: AI scouting report generation via LLM (structured JSON)
- [x] Backend: AI film annotation generation via LLM
- [x] Backend: in-report AI chat endpoint
- [x] Frontend: DashboardLayout with sidebar (Sessions, New Analysis)
- [x] Frontend: Dashboard page — session list with status badges (analyzing/complete/failed)
- [x] Frontend: New Session page — opponent name, date, YouTube or upload source
- [x] Frontend: Session page — tabbed layout (Scouting Report / AI Film Breakdown)
- [x] Frontend: Scouting Report tab — video player, report sections, key moments sidebar, AI chat
- [x] Frontend: AI Film Breakdown tab — annotated clip viewer with SVG overlays
- [x] SVG annotation canvas — circles, arrows, zones, labels (red/green/blue/yellow/white)
- [x] Coaching callout banner and alternative play panel per highlight
- [x] Role-based access: admin can create/delete, viewer can read/chat
- [x] Empty state CTA on dashboard when no sessions exist
- [x] Status badges: analyzing, complete, failed
- [x] PDF Export — HTML report export with print-to-PDF workflow
- [x] Fix AI annotation timestamps — improved LLM prompt + YouTube seconds parameter
- [x] Season Dashboard — opponent history, stats, and game-by-game breakdown
- [x] AI Play Diagram Generator — backend + button integration
- [x] Player Tendency Profiles — AI-generated scouting cards with tendencies, strengths, weaknesses
- [x] Game Plan Generator — AI generates full game plan from scouting report (scripted plays, red zone, 3rd down, defensive adjustments, key matchups, halftime checklist)
- [x] Integrate X's and O's formation diagrams directly into the Game Plan (Madden-style with offense + defense, route trees, blocking, defensive alignments)
- [x] Integrate X's and O's formation diagrams directly into the Game Plan (Madden-style with offense + defense, route trees, blocking, defensive alignments)
- [x] Animation toggle on diagrams — "Run Play" button animates routes/players developing over 2.5s with progress bar, pause, and reset controls
- [x] Madden-style Player Ratings Cards (OVR system with attribute bars, flip animation, X-Factor badge, threat level)
- [x] Scouting Challenge gamified quiz mode (12 questions, 4 levels, XP system, streak bonuses)
- [x] Pre-Game Matchup Screen (OVR rings, tendency comparison, key matchups, AI prediction)
- [x] Integrated PlayerRatingCard and MatchupScreen into SessionPage "Matchup" tab
- [x] Stripe paywall UI (upgrade modal gating Game Plan behind Strategist tier)
- [x] Stripe webhook handler for auto-upgrading accounts on payment success
- [x] Public landing page with pricing table and animated diagram demo at /landing
- [x] BUG FIX: Game Plan Generator — switched from json_object to json_schema format (fixes web_search conflict), added error display with Retry button, specified model explicitly
- [x] BUG FIX: Film Breakdown timestamps — redistributed existing report timestamps evenly across estimated video duration, added Re-Analyze button for admins, improved LLM prompt with video duration estimation from YouTube metadata
- [x] IMPROVEMENT: Auto-redirect unauthenticated users to /landing page instead of login wall
- [x] SEO: Added meta description (150 chars), meta keywords (7 keywords), title updated to 53 chars, H1 and H2 already present on landing page
- [x] NEW FEATURE: Beat This Defense Simulator — AI play-call grading tool with defense selector, success likelihood scoring, and coaching adjustments (playSim router with LLM-powered analysis)
- [x] NEW FEATURE: Live Game-Day Assistant — Sideline mode for real-time opponent play logging with instant counter-call suggestions based on scouting tendencies
- [x] NEW FEATURE: Wristband/Call Sheet Generator — Printable QB wristband inserts and situational call sheets for game day
- [x] NEW FEATURE: AI Voice Coach — Broadcast-style voiceover commentary generator for highlights and mistake breakdowns (ready for ElevenLabs integration)
- [x] Integrate all 4 new features into SessionPage tabs (Beat This Defense / Game-Day Assistant / Call Sheet / Voice Coach with NEW badges) — TypeScript clean, all routers and components wired
- [x] YouTube Data API metadata integration: YouTube sessions now use REAL duration + title/channel for timestamp distribution (big accuracy upgrade over pure guessing). NOTE: play timestamps for YouTube sessions are still AI estimates within the real duration — true play-level extraction requires downloading the footage (yt-dlp is blocked by YouTube bot detection in this runtime). Uploaded videos use vision-anchored timestamps.
- [x] YOUTUBE API INTEGRATION: YOUTUBE_API_KEY secret validated with live videos.list test; server/youtubeMeta.ts helper (ISO8601 duration parser, 8s timeout, graceful null fallback); generateReport now injects exact duration + bounds every highlight timestamp within the real video length; 4 new tests (29 total passing)
- [x] Label YouTube-session clip timestamps as estimated in the film breakdown UI — "~" prefix on clip times + explainer note recommending direct upload for exact vision-anchored timestamps
**Deferred platform limitation:** True play-level timestamps from YouTube links require authorized access to video frames, which the metadata API does not provide and many channels block. Direct video upload remains the supported path for vision-anchored timestamps; YouTube-linked timestamps remain clearly labeled AI estimates.

## 3D Play Simulator Animation Upgrade (Jul 24 request)
- [x] 3D SIM: Live route drawing — dashed glowing route lines draw in real time slightly ahead of each runner (toggleable via Routes button)
- [x] 3D SIM: Player tracking rings — pulsing ground rings follow every routed player through the play (green offense / red defense)
- [x] 3D SIM: Pulsing mistake zone circles — red rings at breakdown points (existing) + NEW dashed red wrong-path line that draws in mid-play with ✕ end marker
- [x] 3D SIM: Correct-path overlays — solid green animated line with pulsing arrowhead cone showing the right execution, toggleable via Fix button
- [x] 3D SIM: Playback controls upgrade — timeline scrubber (0-100%) with phase labels (PRE-SNAP / DEVELOPMENT / BALL IN FLIGHT / RESULT), scrubbing pauses playback
- [x] 3D SIM: Wire upgraded simulator into Play3D tab (updated legend) and Mistake Analysis 3D view (breakdown-derived wrong/correct paths)
- [x] 3D SIM: Verified — TypeScript clean, 29/29 vitest passing, PLUS real visual verification via headless chromium against a DEV-gated test harness (/sim3d-test, client/src/pages/Sim3DTest.tsx): confirmed WebGL scene renders, Run Play animates, tracking rings visible on all routed players (green offense rings at 90% scrub), route lines draw live, wrong-path dashed red line + BREAKDOWN label + red pulse ring visible, correct-path green line + EXECUTE HERE marker visible, Routes/Fix toggle buttons present, scrubber works (scrubbed to 70%/90%, phase labels transition PRE-SNAP → BALL IN FLIGHT → RESULT), all 4 camera presets clickable (verified Bird's Eye + Sideline)

## Visual/Interactive Upgrade Round (Jul 24)
- [x] Shared play-animation foundation — extended FormationDiagram (SVG engine: routes drawing live, players, NEW ball-flight arc QB→target for passes / handoff track for runs) reused across Game Plan, Beat This Defense, Mistake Analysis
- [x] Analysis wait: AnalysisProgress component — cinematic stage-driven progress bar (download → frames → AI watching → report) with animated field scanner, live stage checklist, elapsed timer; wired into SessionPage analyzing + re-analyzing states
- [x] Scouting report: ReportCharts — interactive recharts dashboard (play verdicts donut, phase breakdown bars, game flow timeline scatter, all with hover tooltips) wired into ReportView
- [x] AI Film Breakdown: ClipPlayer — pre-timed clips; uploaded video seeks to startSeconds and auto-pauses at clip end with clip-scoped progress bar + replay; YouTube embeds with start/end params. Wired into FilmBreakdown
- [x] Player Profiles: Film Spotlight — ai.playerSpotlight procedure picks each player's best play from highlights; ClipPlayer shows the clip with pulsing tracking circle on the player, attack arrows, and how-to-stop coaching overlay
- [x] Game Plan: every suggested play's FormationDiagram now animates with live route drawing + ball flight
- [x] 3D Plays expanded: ball-flight animation in Play3DVisualizer (parabolic throw to target) + red wrong-ring / green correct-ring annotation system with connecting lines and legend in Play3DTab
- [x] Mistake Analysis: animated wrong-vs-right 2D diagram (red routes = breakdown, green routes = correct execution, breakdown-moment marker) + 3D view annotations
- [x] Beat This Defense: live animated FormationDiagram visualization vs selected defense (replaced "visualization coming soon") with ball flight
- [x] War Room Ask the Film: results return clipSeconds + annotation circle coords from AI; WATCH buttons open inline ClipPlayer jumping to the exact timestamp with pulsing yellow annotation circle + label overlay
- [x] Verified: TypeScript clean, 25/25 vitest passing, dashboard/session/war-room screenshots confirmed rendering
- [x] HONESTY GAPS resolved: progress now backend-driven, circles labeled AI-estimated in UI; clip timestamps still inherit the estimated-timestamp limitation for YouTube sessions (uploaded videos use real vision-anchored timestamps)
- [x] Implement real backend progress reporting — analysisStage column on game_sessions (downloading → watching → writing → finalizing), written by generateReport pipeline, polled by SessionPage every 5s, drives AnalysisProgress stage checklist with elapsed-time fallback
- [x] Label Player Spotlight and Ask-the-Film circle overlays as "Circle position AI-estimated" badges in the UI
- [x] BUG: Large video upload failing on live site for a 28-minute game film — ROOT CAUSE: serverless instance churn during long sequential uploads (server restarts observed at 14:36/15:27/15:32 in prod logs) + possible 2GB cap rejection. FIX: raised cap to 6GB (client+server), 4-way parallel chunk uploads, 6-attempt exponential backoff (1.5s→24s) with 2-min per-chunk timeout, resume support via new GET /api/upload/status (deterministic uploadId from name+size+mtime so re-picking the same file skips completed chunks), MB/speed progress UI. Verified locally: 120MB/5-chunk upload with mid-flight resume check passed byte-exact; vitest 4/4 upload tests passing (chunked + new resume suite).
- [x] Verify large upload end-to-end on PRODUCTION (tacticalai-yt2mojug.manus.space) after deploy — 150MB/6-chunk parallel upload from external network: all chunks 200, mid-flight resume status correctly reported 3/6, complete OK, assembled file retrievable at exact byte size (157286400/157286400).
- [x] BUG: uploaded video session stuck on "analyzing" (user's 10-min video). ROOT CAUSE: fire-and-forget generateReport() killed silently when serverless instance recycled (prod logs show restart 2 min after session create). FIX: (1) new awaited sessions.analyze endpoint keeps instance alive for full pipeline; create stays fast, client fires analyze after navigation; (2) 10-min stuck watchdog in sessions.get/list flips zombie sessions to failed; (3) Retry button wired to reanalyze (now awaited + passes videoFileKey so uploads get real vision on retry); (4) vision step hard 110s timeout to fit the 180s request cap; (5) honest 1-3min ETA copy. Watchdog covered by vitest.
- [x] Recover user's stuck session 330001 ("10 min filmm") on production after deploy — watchdog flipped it to failed, then re-ran the FULL analysis pipeline end-to-end against the shared prod DB/S3 (one-off recovery test, since removed): real footage downloaded, vision analysis ran, scouting report generated with 7 highlights, session status now COMPLETE (verified in DB and by test output). Production deploy live at tacticalai-yt2mojug.manus.space.
- [x] BUG FIX: Video upload fails on production — server was buffering whole file in memory (512MB Cloud Run limit, 180s request timeout). Fixed: browser now uploads directly to S3 via presigned URL (upload.getPresignedUrl), with progress bar, 2GB cap, and verified via vitest (server/upload.presign.test.ts)
- [x] BUG FIX: Direct-to-S3 browser upload was blocked by bucket CORS (preflight 403). Fixed: upload now streams through the server via busboy pipe to S3 presigned URL with explicit Content-Length (S3 rejects chunked PUTs with 501) — no memory buffering, works within 512MB limit. Verified with vitest (server/upload.stream.test.ts, 2 tests)
- [x] BUG (still reported): Video upload still failing for user on live site — ROOT CAUSE CONFIRMED by testing from external network: production load balancer returns 413 "Request Entity Too Large" for any request body over ~31MB (31MB passes, 32MB fails), before the request ever reaches app code. FIX: chunked upload — client slices file into 25MB chunks with per-chunk retry (POST /api/upload/chunk streams each to S3), then POST /api/upload/complete reassembles chunks into the final S3 object via streaming concat (no memory buffering). Verified end-to-end with vitest (server/upload.chunked.test.ts — byte-exact assembly check; full suite 10/10 passing)
- [x] PRODUCTION VERIFICATION: chunked upload verified on LIVE site (tacticalai-yt2mojug.manus.space) with a real 100MB file from an external network — all 4 chunks HTTP 200, complete HTTP 200, final object retrievable at exact byte size (104857600/104857600)
- [x] HALFTIMEIQ PORT: Cinematic visual upgrade — stadium-lights hero glow, animated gradient meshes, glassmorphism panels, scanline/noise texture, upgraded typography and micro-animations across the app (index.css utility layer: glass, glow, clip-tactical, anim-rise, field-grid, mesh-bg, bar-shimmer, anim-scan)
- [x] HALFTIMEIQ PORT: AI Coordinator War Room — Offense/Defense/Special Teams councils synthesizing coaching priorities into three ranked halftime calls with confidence + evidence links (warRoom router; verified e2e with real LLM call returning 3 ranked calls)
- [x] HALFTIMEIQ PORT: Opponent DNA — run/pass/motion/blitz/explosive rates, top formations, fronts, directions, identity statement computed from session report data
- [x] HALFTIMEIQ PORT: Momentum Detector — clickable momentum swing chart from play-by-play data
- [x] HALFTIMEIQ PORT: Ask the Film — full-text film search over structured analysis with ranked evidence results
- [x] HALFTIMEIQ PORT: Next-Play Predictor — transparent probability distribution (run/pass/screen/scramble) with formation clue input
- [x] HALFTIMEIQ PORT: Counter-Play Generator — maps opponent look to complementary concept from 6-concept playbook (PLAYBOOK unit tested)
- [x] HALFTIMEIQ PORT: What-If Simulator — defender fit + aggression controls returning explainable stop estimate and tradeoff (deterministic math, 3 vitest cases)
- [x] HALFTIMEIQ PORT: Practice Builder — timed practice periods generated from repeated film corrections, JSON/print export
- [x] HALFTIMEIQ PORT: Scout-Team Generator — 4-period scout script from opponent tendencies with rep targets
- [x] HALFTIMEIQ PORT: Football IQ Mode — evidence-based quiz for players with interactive grading
- [x] HALFTIMEIQ PORT: Integrate all features into a new "War Room" hub navigation with cinematic design — /warroom/:id command center with 9 workspaces, glowing ENTER WAR ROOM CTA on session pages; also wired the 4 previously-orphaned tabs (Beat This Defense / Game Day / Call Sheet / Voice Coach) into SessionPage; vitest 21/21 passing, TypeScript clean
- [x] NEW FEATURE: 3D Play Visualizer — Three.js animated 3D field with players running routes in real-time, orbit/zoom camera controls, preset camera angles (sideline, end zone, bird's eye, QB view), play library + game plan plays, Run Play animation with ball tracking
- [x] NEW FEATURE: Mistake Analysis Animation — AI generates correct-vs-actual play execution breakdown (mistakeAnalyses table + mistakeAnalysis router), animated comparison showing where the play broke down with visual markers
- [x] NEW FEATURE: Auto Highlight Reel — AI scans full game film and ranks the best plays into a playable highlight reel with impact scores and jump-to-timestamp (highlightReels table + highlightReel router)
- [x] Integrate all three features into SessionPage tabs (3D Plays / Mistakes / Highlight Reel with NEW badges) — TypeScript clean, full vitest suite 10/10 passing
- [x] Vitest coverage for new features — server/newfeatures.test.ts tests mistakeAnalysis and highlightReel db helpers (save/fetch/upsert-replace/delete, JSON plays & clips columns); added deleteMistakeAnalysisBySession + deleteHighlightReelBySession helpers to db.ts; full suite 16/16 passing, 0 TypeScript errors


## PHASE 2: Advanced Video Analytics (15 Elite Features)

### Database & Infrastructure
- [x] Create dedicated analytics tables for formations, heat maps, pre-snap reads, turnovers, gaps, routes, blocks, momentum, injuries, penalties, red zone, third down, two minute, situations, and player comparisons
- [x] Resolve analytics persistence through normalized module tables plus the shared evidence/confidence table instead of bloating game_sessions with duplicate JSON columns
- [x] Create protected analytics routers with all 15 procedure groups, owner checks, strict structured output, and owner-scoped evidence metadata

### 1. Formation Recognition AI
- [x] Formation analysis recognizes evidence-supported offensive and defensive looks while using Unclear when the report cannot support a label
- [x] Live View surfaces formation labels beside each timestamped 15-second evidence window rather than burning uncertain labels onto film
- [x] Formation tendency output requires observed counts and calculates rates only when a usable denominator exists
- [x] Formation-based next-call predictions separate AI confidence from observed historical frequency
- [x] Formation module is integrated into the 15-module analytics hub and the SessionPage Advanced Analytics tab

### 2. Player Heat Maps & Positioning Analytics
- [x] Pre-snap positioning module supports qualitative field zones and verified calibrated coordinates when supplied
- [x] Route-area heat maps support evidence-linked inside, outside, short, intermediate, and vertical zones without inventing coordinates
- [x] Defensive positioning and gap zones are represented when the evidence or coach-supplied tracking data supports them
- [x] Alignment tendencies require observed counts; exact yard depth and percentages are withheld without calibrated tracking
- [x] Motion-path analysis is supported from evidence or verified tracking input, with player trails already available in the 3D visualizer
- [x] Analytics hub renders a field-grid heat-map visualization when coordinate evidence exists and clearly labels qualitative estimates otherwise

### 3. Pre-Snap Reads Visualization & Coverage Recognition
- [x] Pre-snap module generates evidence-linked primary, secondary, and tertiary read progressions; route animations remain available in the 3D play simulator
- [x] Coverage recognition returns supported Cover/Man labels and uses Unclear when the scouting evidence is inconclusive
- [x] Blitz-position and pressure indicators are evidence-linked rather than fabricated from generic football assumptions
- [x] Hot-route coaching recommendations are paired with the observed coverage evidence and model confidence
- [x] Football IQ and pre-snap drill questions are generated from the analyzed evidence for player learning
- [x] Pre-snap read workspace, film evidence links, and drill content are available from the Advanced Analytics and War Room experiences

### 4. Turnover Predictor AI
- [x] Interception risk is presented as an AI coaching-risk score, never mislabeled as a historical interception rate
- [x] Fumble-risk analysis identifies evidence-supported exposure and ball-security concerns
- [x] Sack vulnerability identifies supported protection/time-to-throw concerns and withholds exact seconds without timing evidence
- [x] Pressure points connect likely exploited gaps to cited highlights
- [x] Historical turnover claims remain empty unless verified prior-game outcomes are supplied by the coach
- [x] Safer-call recommendations include evidence, confidence, and limitations rather than invented success percentages
- [x] Turnover module displays risk data, source labels, warnings, and evidence inside the analytics command center

### 5. Defensive Gap Assignment Analyzer
- [x] Gap analysis supports A/B/C/D assignment labels when responsibility is visible or supplied by the coach
- [x] Assignment breakdowns cite exact highlights and use Unclear when player identity or responsibility is not verifiable
- [x] Blitz-package and undefended-gap analysis is evidence-linked and confidence-labeled
- [x] Run-fit analysis identifies supported leverage and integrity issues without inventing rates or yardage
- [x] Coaches can paste verified assignment rules and corrections into the module and then approve the result
- [x] Gap workspace presents structured assignments and verified-context editing; visual route/gap diagrams remain available in the play visualizer

### 6. Route Tree Analyzer
- [x] Route recognition labels only routes supported by film evidence or verified coach charting
- [x] Timing analysis supports receiver-break versus release observations and withholds frame-precision timing without tracked frames
- [x] Separation metrics remain null unless calibrated field scale and tracking data are supplied
- [x] Coverage matchups are returned only when defender/receiver responsibility can be supported
- [x] Route effectiveness requires complete target/outcome counts before displaying a percentage
- [x] Full route progression and timing visualization is available through the 3D play simulator and its scrubber
- [x] Route Tree module displays structured route, timing, matchup, evidence, and quality data in the analytics hub

### 7. Blocking Assignment Tracker & OL Performance
- [x] Block identification is evidence-linked and player identity remains Unclear without verified rosters
- [x] Block quality uses qualitative good, average, and whiffed coaching labels when visible
- [x] Breakdown analysis reports only observed missed blocks; counts and lost yardage require complete charting
- [x] Scheme-consistency percentages require a complete snap denominator and remain unavailable otherwise
- [x] Individual lineman grades require verified identity and complete rep charts; qualitative film traits remain available
- [x] Coach notes and corrections can be supplied through verified context and approved with the coach-verification control
- [x] Blocking workspace provides structured OL performance analysis and links to diagram/film evidence when available

### 8. Momentum & Game Flow Analytics
- [x] Momentum graph plots chronological evidence and becomes complete play-by-play when an official timeline is supplied
- [x] Emotional indicators are explicitly qualitative coaching observations, not measured player-emotion claims
- [x] Momentum-swing predictions are labeled AI coaching indexes with evidence and confidence
- [x] Comeback analysis is generated only when the supplied score/timeline evidence supports a comeback sequence
- [x] Halftime adjustments compare supported pre- and post-halftime evidence when period context exists
- [x] Momentum module renders a real timeline chart plus cited swing-moment highlights

### 9. Injury Impact Analyzer
- [x] Key-player removal scenarios require verified roster, role, and performance inputs; unsupported percentage drops are blocked
- [x] Starter-versus-backup comparisons require verified depth-chart and charted performance data
- [x] Scheme-adjustment scenarios use only coach-supplied injury status and evidence-supported role changes
- [x] Backup vulnerability observations require verified player identity and evidence rather than invented traits
- [x] Medical recovery timelines are explicitly withheld unless an authorized medical return-to-play input is supplied
- [x] Injury Impact module shows analysis, missing inputs, limitations, confidence, and coach verification instead of fabricating medical data

### 10. Penalty Pattern Analyzer
- [x] Referee tendencies require identified officiating-crew history and are withheld when that dataset is absent
- [x] Team penalty rates require complete official penalty and play counts with explicit numerator and denominator
- [x] Penalty-location visualization activates when verified spatial/location data is supplied; no locations are invented
- [x] Penalty-type trends are calculated only from complete charted penalty situations
- [x] Coaching adjustments connect verified penalty patterns to technique without pretending the referee data exists
- [x] Penalty module presents charted patterns, cost, source limits, evidence, and verified-data input in the analytics hub

### 11. Red Zone Efficiency Analyzer
- [x] Red-zone conversion requires complete attempt and outcome counts before a rate is shown
- [x] Goal-line success requires verified goal-line snaps and outcomes
- [x] Scoring-method split requires complete run/pass touchdown charting with denominators
- [x] Defensive vulnerabilities cite observed red-zone evidence and confidence
- [x] Next-call red-zone predictions are separated from historical frequency and linked to evidence
- [x] Red Zone module displays efficiency, goal line, tendencies, scoring breakdown, evidence, and missing-data controls

### 12. Third-Down Efficiency Breakdown
- [x] Third-down conversion rate requires complete third-down attempts and conversions
- [x] Short, medium, and long splits require verified distance and outcome tags
- [x] Third-down play-calling percentages require complete call charting by distance
- [x] Defensive third-down tendencies require verified opponent outcomes rather than generic assumptions
- [x] Third-down recommendations cite evidence and confidence and avoid invented vulnerability rates
- [x] Third-Down module displays distance, call, coverage, recommendation, evidence, and data-quality breakdowns

### 13. Two-Minute Drill Analyzer
- [x] Two-minute pace and efficiency require complete clocked drive sequences before rates are calculated
- [x] Two-minute call patterns require verified down, clock, call, and outcome tags
- [x] Timeout-management findings require a complete timeout sequence and never label a timeout wasted from partial evidence
- [x] Scenario analysis accepts verified score, clock, down-distance, and timeout context through the coach-data input
- [x] Defensive call suggestions are evidence-linked and labeled as AI coaching recommendations
- [x] Two-Minute module displays clock strategy, call sequence, clutch evidence, and prediction context

### 14. Situational Football Analyzer
- [x] Down-and-distance tendencies require observed counts and complete situation tags
- [x] Score-differential splits require verified score state for each charted play
- [x] Field-position tendencies require verified yard line and possession context
- [x] Time-remaining tendencies require verified game clock and complete play samples
- [x] Situational predictions separate AI confidence from observed historical frequency and cite evidence
- [x] Situational module supports coach-supplied scenario context and presents the resulting evidence-audited prediction

### 15. Player Comparison Tool
- [x] QB comparisons support evidence-backed decision-making and mobility traits; accuracy and arm-strength measurements require verified charting
- [x] WR-versus-CB comparisons support qualitative separation/coverage traits; catch radius and speed require measured inputs
- [x] OL-versus-DL comparisons support evidence-backed footwork, leverage, gap discipline, and consistency traits
- [x] Height, weight, and speed matchup claims require verified roster/combine data and are never invented
- [x] Matchup predictions cite the supporting film evidence, confidence, and limitations
- [x] Player Comparison module renders structured side-by-side-ready data, verified inputs, evidence, and coach approval state

### Analytics Dashboard & Unified Reporting
- [x] Create dedicated Analytics Hub route at /analytics/:id containing all 15 modules
- [x] Implement every module as a responsive collapsible evidence panel with module-appropriate or numeric visualization
- [x] Add per-module CSV and print-to-PDF export controls
- [x] Add whole-suite executive summary CSV and print-to-PDF exports with readiness, confidence, and coach-verification status
- [x] Integrate the unified AnalyticsPanel into SessionPage as the Advanced Analytics tab

### Testing & Deployment
- [x] Add table-driven evidence-guard coverage for all 15 modules plus strict parsing, malformed-output retry, fallback-removal, and export tests
- [x] Validate all 15 modules against a real upload-derived scouting report and visually verify the complete Analytics Hub on desktop and mobile
- [x] Measure all 15 modules with a 47.8-second worst observed module latency, safely below the 180-second serverless request limit
- [x] Publish the evidence-audited 15-module suite after exact-schema hardening, malformed-response recovery, penalty-specific visualization, and fresh-upload end-to-end verification
- [x] Add a new sales-deck slide using verified Live View and 15-module Advanced Analytics product screens
