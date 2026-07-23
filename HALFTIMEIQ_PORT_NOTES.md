# HalftimeIQ Pro → TacticalEdge AI Port Notes

Source: user's local HalftimeIQ Pro prototype (Python stdlib dashboard, /home/ubuntu/upload/*.md).
User wants ALL features ported + "1 million times cooler" visuals (dark cinematic, never basic).

## Features to port (from HALFTIMEIQ_PRO_DETAILED_SUMMARY.md)

1. **AI Coordinator War Room** — Offense/Defense/Special Teams "councils" each list coaching priorities from unit-grade records; feeds ranked "Three Halftime Calls" — each call has: unit ownership, concise action, confidence indicator, linked evidence-play IDs, path into Film Room.
2. **Ask the Film** — search structured JSON over: play type, formation, result, run direction/gap, defensive front, blitz/coverage, event titles/descriptions, coaching corrections, player/role notes, unit priorities. Ranked results + play-type filter, updates evidence table, selects best matching clip.
3. **Opponent DNA** — computes: run tendency, pass tendency, motion rate, blitz rate, explosive gain rate (15+ yds), non-positive gain rate, most frequent formations, run/pass directions, defensive fronts, concise identity statement. Shows sample size.
4. **Next-Play Predictor** — formation clue input → smoothed probability distribution across run/pass/screen/scramble, evidence play IDs retained, labeled "coaching estimate".
5. **Counter-Play Generator** — 6-concept sample playbook: Inside Zone, Split Zone, Mesh, Four Verticals, Inside Zone/Bubble RPO, Boot Flood. Maps selected play family → complementary answer + explains tagged front/conflict addressed.
6. **Playbook Execution Grader** — selected concept, tagged defensive look, play diagram, position-group assignments, assignment-grade table, counter concept.
7. **Instant Halftime War Room** — reduced decision surface: 1 evidence clip, 3 ranked adjustments, 3 coordinator viewpoints, 3 halftime calls, tendency bands, next practice schedule.
8. **Film Telestrator** — SVG overlay: gap label, fit label, directional arrows, highlight circle, toggle. (Already partially have annotation canvas.)
9. **What-If Simulator** — choose defender fit location + aggression → estimated stop probability, change from baseline, play-action tradeoff. Explainable calc using play family, defensive grade, front, aggression.
10. **Automatic Practice Builder** — repeated priorities → timed periods: evidence install, high-priority off corrections, high-priority def corrections, situational finish. Each block: start/end time, unit owner, coaching detail, evidence count. JSON download.
11. **Personal Player Film Rooms** — aggregates key-player entries → per-player/role evidence queues: linked plays, mention count, primary unit, coaching notes.
12. **AI Coach in the Ear** — speech synthesis reads coaching notes aloud (we have ElevenLabs key + browser speechSynthesis fallback).
13. **Three-Camera Fusion** — camera source selectors (Wide/Offense/Defense reels).
14. **Momentum Detector** — sequence from gain/loss, unit grade, TDs, INTs, sacks. Clickable swings → film.
15. **Automatic Recruiting Package** — draft JSON export: player/role label, evidence mentions, clip IDs, film notes, draft status, timestamp, privacy warning + verification gate.
16. **Football IQ Mode** — quiz from real chartable plays; identify play family from run/pass/screen/scramble; marks correct/incorrect; 8 questions.
17. **Scout-Team Generator** — top opponent calls/formations → 4-period scout script: formation, call family, rep target, coaching point, source sample size.
18. **Coach Marketplace** — 6 sample packages (offense, defense, special teams, youth dev, recruiting, red-zone), install/remove persisted in localStorage.

## UI workspaces from prototype
War Room | Film Room | Opponent DNA | Practice | Players | Recruiting | Marketplace

## Positioning quote
"Your film, your playbook, and your coaching language—turned into the next decision your team should make."
"Hudl stores the film. HalftimeIQ tells the coach what to do next."

## Design directive from user
- "1 million times cooler", "never give me basic, boring visuals"
- Dark cinematic vibe (existing: #0D1117-ish bg, #00FF87 green accent, Space Grotesk + Inter)
- Plan: stadium-light glows, animated gradient meshes, glassmorphism, film grain/scanlines, kinetic type, micro-animations

## Implementation mapping (TacticalEdge)
- New page: /session/:id/warroom or new tabs. Better: new "War Room" mega-tab on SessionPage + global "Coach Tools" nav.
- Data source: scoutingReports table (has offenseAnalysis, defenseAnalysis, keyMoments etc.), mistakeAnalyses, highlightReels, playerProfiles.
- warRoom router: LLM synthesizes councils + 3 calls from report JSON (json_schema strict).
- opponentDna router: LLM extract + deterministic computation from report.
- predictor/counterPlay/whatIf: deterministic + LLM hybrid, all in playSim or new routers.
- practice router: LLM generates timed periods + scout team script from report.
- quiz router: generates questions from report key moments.
