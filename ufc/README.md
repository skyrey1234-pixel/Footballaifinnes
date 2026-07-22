# OctagonIQ — UFC AI Finesse Kit

An AI-powered **MMA / UFC fight-scouting** app, built on the exact same model
structure as the football *TacticalEdge* kit at the repo root. You feed it fight
footage (a YouTube link or an uploaded video) for a fighter you want to scout,
and the AI returns a full fight report: striking, grappling, clinch/cage work,
vulnerabilities, and a game plan — plus timestamped key moments, an annotated
film breakdown, signature-weapon profiles, an in-report AI analyst chat, and a
full AI fight plan.

This directory mirrors the football app **file-for-file** so the architecture is
identical; only the domain layer changes (football scheme → MMA fight game). It
is a self-contained reference kit: drop these files over the matching football
files (and run the schema migration) to turn TacticalEdge into OctagonIQ.

## How the football kit maps to UFC

### Data model (`drizzle/schema.ts`)

| Football (TacticalEdge)         | UFC (OctagonIQ)                    | Notes |
| ------------------------------- | --------------------------------- | ----- |
| `gameSessions`                  | `fightSessions`                   | one opponent breakdown / tape study |
| &nbsp;&nbsp;`opponentName`      | `fighterName`                     | the fighter being scouted |
| &nbsp;&nbsp;`gameDate`          | `fightDate` + `division`          | added weight class |
| `scoutingReports`               | `fightReports`                    | the AI-generated report |
| &nbsp;&nbsp;`offenseAnalysis`   | `strikingAnalysis`                | stand-up game |
| &nbsp;&nbsp;`defenseAnalysis`   | `grapplingAnalysis`               | wrestling / BJJ / takedowns |
| &nbsp;&nbsp;`specialSituations` | `clinchAndCage`                   | clinch, cage control, championship rounds |
| &nbsp;&nbsp;`mistakes`          | `vulnerabilities`                 | exploitable holes |
| &nbsp;&nbsp;`predictions`       | `gamePlan`                        | blueprint to beat them |
| `playerProfiles`                | `weaponProfiles`                  | a fighter's signature techniques |
| &nbsp;&nbsp;`playerNumber`/`Name` | `weaponName`                    | e.g. "Left High Kick" |
| &nbsp;&nbsp;`position`          | `technique`                       | Striking / Wrestling / BJJ / Clinch / Defense |

Highlight categories map `offense/defense/special/mistake` →
`striking/grappling/clinch/mistake`, and the `verdict` good/bad reads as
"landed clean" vs "got caught."

### Backend (`server/`)

| Football                        | UFC                               |
| ------------------------------- | --------------------------------- |
| `sessions.*` router             | `fights.*`                        |
| `reports.*` (report, PDF, diagram) | `reports.*` (report, PDF, octagon technique diagram) |
| `ai.chat` / `ai.annotateHighlight` | same names, MMA prompts        |
| `season.*` (season stats)       | `division.*` (division stats)     |
| `players.*` (player profiles)   | `weapons.*` (weapon profiles)     |
| `gamePlan.generate`             | `fightPlan.generate`              |
| `generateReport()` async job    | `generateReport()` async job (MMA schema) |

`fightPlan.generate` produces `strikingSequences`, `finishingSequences`,
`takedownAndScramblePlan`, `defensiveAdjustments`, `styleMatchups`, and a
`betweenRoundsChecklist` — the MMA analogues of scripted plays, red-zone
package, third-down conversions, defensive adjustments, key matchups, and the
halftime checklist.

### Subscription tiers (`server/stripe.ts`)

| Football tier | UFC tier    | Price | Unlocks |
| ------------- | ----------- | ----- | ------- |
| Scout         | Cornerman   | $99   | fight reports, division intel, weapon profiles |
| Strategist    | Head Coach  | $199  | + Fight Plan Generator, annotated breakdowns, PDF export, unlimited |
| Program       | Gym         | $499  | + corner seats, API access |

### Frontend (`src/`)

| Football file                   | UFC file                          |
| ------------------------------- | --------------------------------- |
| `pages/Dashboard.jsx`           | `pages/Dashboard.jsx`             |
| `pages/NewSession.jsx`          | `pages/NewFight.jsx`              |
| `pages/Session.jsx`             | `pages/Fight.jsx`                 |
| `components/sessions/SessionCard.jsx` | `components/fights/FightCard.jsx` |
| `components/report/*`           | `components/report/*`             |
| `components/film/*`             | `components/film/*`               |
| `lib/analysis.js`               | `lib/analysis.js`                 |
| `lib/filmAnnotation.js`         | `lib/fightAnnotation.js`          |

The base44 entities become `FightSession` and `FightReport` (the SDK client,
auth, routing shell, and shadcn UI primitives are domain-agnostic and reused
as-is from the football app).

### Theme

Same dark shell (`#0D1117` background, `#161B22` cards) with the accent swapped
from football green `#00FF87` to fight-night red `#FF2D2D`. Product name:
**OctagonIQ**. Annotation semantics are unchanged (red = got caught,
green = clean, yellow = key weapon, blue = suggested counter).

## Files

```
ufc/
├── README.md                       ← this file
├── todo.md                         ← build checklist (football → UFC)
├── drizzle/
│   └── schema.ts                   ← fightSessions, fightReports, weaponProfiles
├── server/
│   ├── db.ts                       ← DB helpers
│   ├── stripe.ts                   ← Cornerman / Head Coach / Gym tiers + feature gates
│   └── routers.ts                  ← tRPC routers + async report generation
└── src/
    ├── App.jsx                     ← route wiring reference (/, /new, /fight)
    ├── lib/
    │   ├── analysis.js             ← base44 SDK fight-report generation
    │   └── fightAnnotation.js      ← AI film-annotation generation
    ├── pages/
    │   ├── Dashboard.jsx
    │   ├── NewFight.jsx
    │   └── Fight.jsx
    └── components/
        ├── Layout.jsx
        ├── fights/FightCard.jsx
        ├── report/{ReportSection,VideoPlayer,HighlightCard,ReportChat}.jsx
        └── film/{FilmBreakdown,AnnotatedHighlightCard,AnnotationCanvas}.jsx
```

## Wiring it into the running app

The server files import from `./_core/*`, `./storage`, `./stripeRoutes`, and
`@shared/const` — the same shared infrastructure the football server uses — so
they slot into `server/` directly. The frontend imports (`@/api/base44Client`,
`@/components/ui/*`, `@/lib/*`) resolve against the existing `src/` tree. To go
live:

1. Add the three tables from `ufc/drizzle/schema.ts` to `drizzle/schema.ts` and
   run `npm run db:push` (or create the matching Base44 entities `FightSession`,
   `FightReport`, `WeaponProfile`).
2. Replace the domain files under `server/` and `src/` with their `ufc/`
   counterparts (or copy them alongside and point `App.jsx` at the new pages).
3. Set the Stripe price IDs for the Cornerman / Head Coach / Gym tiers.
4. `npm run dev` (frontend-only) or `base44 dev` (full local backend).

See the repo-root `README.md` for the full Base44 setup and publish workflow.
