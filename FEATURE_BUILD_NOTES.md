# Build Notes — 3 New Features (3D Play Visualizer, Mistake Analysis, Highlight Reel)

## Data model facts (verified from code)
- `scoutingReports` table: executiveSummary, offenseAnalysis, defenseAnalysis, specialSituations, mistakes, predictions, highlights (json), sessionId
- Highlight JSON type (client): `{ timestamp: string; seconds: number; title: string; note: string; category: string; verdict: string }`
- `gameSessions`: opponentName, gameDate, sourceType (youtube|upload), youtubeVideoId, videoUrl, videoFileKey, status
- `playerProfiles`: playerNumber, playerName, position, tendencies(json), strengths, weaknesses, threatLevel(low/medium/high/elite), notes
- Routers in server/routers.ts: auth, sessions, reports, ai, upload, season, players, gamePlan
- gamePlan.generate uses invokeLLM model "gpt-5-mini" + response_format json_schema (strict) — THIS IS THE WORKING PATTERN (json_object breaks due to web_search conflict)
- Tier gate pattern: db.getUserById → subscriptionTier + role==="admin" bypass + canAccessFeature(tier, "game_plan") from ./stripe

## FormationDiagram.tsx (2D) reusable logic
- `getOffensivePlayers(formation, playType, target)` → PlayerPos[] {x,y,label,side,route:{points:[[x,y]],type}} in 0-100 x, 0-85 y coords, LOS at y=50, offense below (y>50), defense above
- `getDefensivePlayers(defenseScheme)` → 4-3/3-4/nickel/dime layouts
- Route helpers: getWrRoute(go/slant/out/curl/post/corner/flat/drag), getRbRoute
- interpolateRoute(startX,startY,points,progress) → position along route (reuse for 3D)

## SessionPage.tsx tabs
- Tabs: report, film, players, gameplan, matchup. MatchupTab is local component at bottom of file.
- session + report loaded via trpc.sessions.get + trpc.reports.getBySession
- Icons imported from lucide-react (line 8)

## Plan
1. **Play3DVisualizer.tsx** (client/src/components/play3d/): three.js (installed: three 0.185.1 + @types/three). Canvas-based 3D field (100yd green field, yard lines, end zones), players as colored cylinders+spheres with labels (sprite text), routes animated via interpolateRoute logic ported to 3D (x → field width, y → depth). OrbitControls from three/examples/jsm/controls/OrbitControls.js. Camera presets: sideline, endzone, birdseye, QB view. Play/pause/reset + speed control. Reuse getOffensivePlayers/getDefensivePlayers by exporting them from FormationDiagram.tsx.
2. **MistakeAnalysis.tsx** + server `mistakeAnalysis.generate` endpoint: LLM (gpt-5-mini, json_schema) takes report.mistakes + highlights + opponent context → array of {playTitle, timestamp, whatHappened, whatWentWrong, correctExecution, severity, formation, playType, keyPlayer, coachingPoint}. UI: side-by-side animated 2D diagrams ("What Happened" red vs "Correct Execution" green) using FormationDiagram, with breakdown text + severity badges. Persist in new `mistakeAnalyses` table (sessionId, plays json, createdAt).
3. **HighlightReel.tsx** + server `highlightReel.generate`: LLM ranks report.highlights (impact score 1-100, reason, category badge) → reel = ordered list; UI: auto-playing reel mode (YouTube iframe seek + auto-advance based on clipDuration ~15s default), ranked list with impact bars, filter by category. Persist in new `highlightReels` table (sessionId, clips json, createdAt). For upload sessions use videoUrl/manus-storage + <video> element seek.
4. Integrate: add "3D Plays" tab (Box icon) + "Mistakes" tab (AlertTriangle) + "Highlight Reel" tab (Film icon) — but tabs getting crowded (8) — use TabsList with flex-wrap.
5. DB migration via pnpm drizzle-kit generate + webdev_execute_sql.
6. Vitest for the two new endpoints.

## Gotchas
- TS: nested async generator function declarations broke earlier (TS1252) — use const expressions
- Never call setState in render; stabilize query inputs
- three.js OrbitControls import path: `three/examples/jsm/controls/OrbitControls.js`
- YouTube iframe API for seek: use `https://www.youtube.com/embed/{id}?start={sec}&autoplay=1` reload approach (existing FilmBreakdown does this)
