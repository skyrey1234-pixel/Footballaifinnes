# TacticalEdge AI — Project TODO

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
- [ ] STILL FUTURE: true play-level timestamp extraction for YouTube links (needs yt-dlp access or Gemini video analysis of YouTube URLs — both blocked in this runtime); workaround remains: upload the video file directly

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
- [ ] Create analytics tables: formations, heatMaps, presnap, turnovers, gaps, routes, blocks, momentum, injuries, penalties, redZone, thirdDown, twoMinute, situations, playerComps
- [ ] Add analytics columns to game_sessions (formationData, heatmapData, presnap, etc.)
- [ ] Create analytics router (server/analyticsRouter.ts) with 15 procedure groups

### 1. Formation Recognition AI
- [ ] Formation detection engine (offensive: Shotgun, I-form, Pistol, Spread, Empty; defensive: 4-3, 3-4, Nickel, Dime, Cover 2, Cover 3)
- [ ] Real-time overlay on film viewer — auto-label formations as they appear
- [ ] Tendency report: formation frequency + play success rates by formation
- [ ] Predictive: "When they line up in I-form, they run 75% of the time"
- [ ] UI: Formation labels on film clips + FormationAnalytics tab

### 2. Player Heat Maps & Positioning Analytics
- [ ] Pre-snap heat map: where each player typically lines up (corners on hash, safeties deep, etc.)
- [ ] Route heat map: where receivers actually run routes (inside cuts vs vertical)
- [ ] Defensive gap assignment heat map: where defenders position relative to ball
- [ ] Alignment tendencies: "Their CB is 2 yards off the line 80% of the time"
- [ ] Motion tracking: visualize player movement pre-snap and post-snap with trails/arrows
- [ ] UI: Interactive heat map viewer with player position overlays

### 3. Pre-Snap Reads Visualization & Coverage Recognition
- [ ] QB progression trainer: show primary, secondary, tertiary reads with animated arrows
- [ ] Coverage recognition: auto-label what coverage defense is in (Cover 2, Cover 3, Man, etc.)
- [ ] Blitz detection: highlight which defenders are in blitz position
- [ ] Hot route indicator: "If you see this coverage, throw to the hot route here"
- [ ] Interactive drill mode: coach can quiz players on what they see pre-snap
- [ ] UI: Pre-snap reads overlay on film + drill mode quiz

### 4. Turnover Predictor AI
- [ ] Interception risk scoring: "This play has a 35% INT rate against this defense"
- [ ] Fumble risk: identify plays where QB holds too long or RB exposed
- [ ] Sack vulnerability: "This play leaves QB exposed for 3+ seconds"
- [ ] Pressure points: show which gaps defense exploits most
- [ ] Historical data: "Last time we ran this play against this defense, we threw a pick"
- [ ] Recommendation engine: "Try this play instead — 85% success rate"
- [ ] UI: Risk badges on play suggestions + warning overlays on film

### 5. Defensive Gap Assignment Analyzer
- [ ] Gap labels: show which defender is responsible for each gap (A, B, C, D)
- [ ] Assignment breakdown: "Their DT is responsible for A-gap, but 2 yards off = vulnerability"
- [ ] Blitz package detection: auto-detect blitz packages + undefended gaps
- [ ] Run fit analysis: "This play exploits their C-gap weakness"
- [ ] Coaching overlay: coaches can add their own gap assignments to compare
- [ ] UI: Gap labels on formation diagrams + interactive assignment editor

### 6. Route Tree Analyzer
- [ ] Route recognition: auto-label routes (slant, dig, corner, post, wheel, etc.)
- [ ] Timing analysis: when receiver breaks vs when QB releases
- [ ] Separation metrics: measure how open receiver is at catch point
- [ ] Coverage matchup: show which defender covering each route
- [ ] Effectiveness rating: "This route works 80% of the time vs Cover 2"
- [ ] Progression visualization: full route tree with timing windows
- [ ] UI: Route tree diagram + interactive timing scrubber

### 7. Blocking Assignment Tracker & OL Performance
- [ ] Block identification: auto-label who's blocking whom
- [ ] Block quality rating: good, average, whiffed
- [ ] Breakdown analysis: "Your LG missed his block on 3 plays, costing 15 yards"
- [ ] Scheme consistency: "Your OL is executing the scheme 85% of the time"
- [ ] Individual performance: grade each lineman's blocks per game
- [ ] Coaching notes: mark blocks as "good example" or "fix this"
- [ ] UI: Block diagram overlay + OL performance card

### 8. Momentum & Game Flow Analytics
- [ ] Play-by-play momentum graph: show which plays shifted momentum
- [ ] Emotional indicators: identify plays that energized or deflated team
- [ ] Momentum predictor: "This is the type of play that usually swings momentum"
- [ ] Comeback scenarios: "Here's where they made their comeback run"
- [ ] Halftime adjustments: show how momentum changed after halftime
- [ ] UI: Momentum timeline chart + key play highlights

### 9. Injury Impact Analyzer
- [ ] Key player removal: "If their #23 (CB) goes out, their coverage success drops 20%"
- [ ] Backup performance: compare starter vs backup stats
- [ ] Scheme adjustment: "When they lose their star pass rusher, they shift to 3-4"
- [ ] Vulnerability window: "Their backup QB can't throw deep — exploit it"
- [ ] Recovery timeline: "They'll be without their RB for 2 weeks — adjust game plans"
- [ ] UI: Injury impact card + backup performance comparison

### 10. Penalty Pattern Analyzer
- [ ] Ref tendencies: "This ref calls holding 40% more than average"
- [ ] Team penalties: "Opponent commits holding on 15% of plays vs 8% average"
- [ ] Penalty location heat map: where penalties happen (certain OL position?)
- [ ] Penalty type trends: "They commit more false starts in high-pressure situations"
- [ ] Coaching adjustment: "Tighten up your technique — this ref is calling tight"
- [ ] UI: Penalty heat map + ref tendency card

### 11. Red Zone Efficiency Analyzer
- [ ] Red zone conversion rate: "Opponent converts 65% of red zone drives"
- [ ] Goal line success: "They score on 80% of goal-line plays"
- [ ] Scoring method: "They prefer passing in red zone (60% pass vs 40% run)"
- [ ] Defensive vulnerability: "Their safeties creep up too far in red zone"
- [ ] Prediction: "Expect them to throw a slant in the red zone"
- [ ] UI: Red zone efficiency card + scoring method breakdown

### 12. Third-Down Efficiency Breakdown
- [ ] 3rd-down conversion rate: "Opponent converts 45% of 3rd downs"
- [ ] Distance-based analysis: "They convert 60% of 3rd-and-short, 35% of 3rd-and-long"
- [ ] Play calling: "On 3rd-and-long, they run play-action 70% of the time"
- [ ] Defense tendencies: "Your defense gives up 8+ yards on 3rd-and-medium"
- [ ] Recommendation: "Blitz on their 3rd-and-long — they're vulnerable"
- [ ] UI: 3rd-down efficiency card + play calling breakdown

### 13. Two-Minute Drill Analyzer
- [ ] Two-minute offense: "They run hurry-up 80% of the time in final 2 minutes"
- [ ] Play calling patterns: "They always throw on 1st down in 2-minute drills"
- [ ] Timeout management: "They waste timeouts — exploit it"
- [ ] Scenario builder: "Here's what they'll likely do with 1:30 left, down 4"
- [ ] Defensive call suggestions: "Call Cover 2 — they can't throw deep fast enough"
- [ ] UI: Two-minute drill scenario card + play prediction

### 14. Situational Football Analyzer
- [ ] Down & distance tendencies: "On 1st-and-10, they run 55% of the time"
- [ ] Score differential: "When up by 7, they run 70% of the time"
- [ ] Field position: "In their own territory, they're conservative (40% pass)"
- [ ] Time remaining: "With 5+ minutes left, they're aggressive (65% pass)"
- [ ] Predictive model: "Given the current situation, they'll likely run"
- [ ] UI: Situational predictor card + scenario builder

### 15. Player Comparison Tool
- [ ] Our QB vs Their QB: accuracy, arm strength, decision-making, mobility
- [ ] Our WR vs Their CB: separation ability, catch radius, speed metrics
- [ ] Our OL vs Their DL: gap discipline, footwork, consistency
- [ ] Matchup advantage: "Your WR has 2 inches and 4.5 speed on their CB"
- [ ] Prediction: "This matchup favors us — exploit it"
- [ ] UI: Side-by-side player comparison cards

### Analytics Dashboard & Unified Reporting
- [ ] Create AnalyticsHub page (/analytics/:sessionId) with 15 feature tabs
- [ ] Implement each feature as a collapsible card/panel with data visualization
- [ ] Add export functionality (PDF, CSV) for each analytics module
- [ ] Create analytics summary report (1-page executive summary of all 15 features)
- [ ] Integrate analytics into SessionPage as new "Advanced Analytics" tab

### Testing & Deployment
- [ ] Write vitest for each analytics procedure (15 test suites)
- [ ] End-to-end testing: upload video → generate analytics → verify all 15 features render
- [ ] Performance testing: ensure analytics generation completes within 180s serverless timeout
- [ ] Production deployment: checkpoint with all 15 features live
- [ ] Sales deck update: add "Advanced Video Analytics" slide showcasing all 15 features
