# TacticalEdge AI — Jaguars Pilot Requirements

## The core premise

TacticalEdge does not need unrestricted Jaguars data to prove value. It needs a narrow, approved historical dataset tied to one coaching workflow and a way to return evidence-linked outputs that staff can judge. The first pilot should avoid player-health information, confidential scouting grades, personnel strategy, and unrestricted raw tracking feeds.

## Minimum viable pilot input

| Input | Minimum scope | Purpose | Sensitivity |
|---|---|---|---|
| Opponent film | Three to five approved historical games or internally approved clips | Links every insight to visual evidence and enables coach-facing teaching outputs | High football-operations confidentiality |
| Existing play metadata | Play ID, quarter, time, down, distance, field position, play type/outcome | Lets TacticalEdge organize film and make transparent situation filters | High football-operations confidentiality |
| Existing tendency labels | Staff-approved formation, coverage, personnel, and concept labels when available | Establishes a benchmark and reduces hallucinated labels | High football-operations confidentiality |
| Staff feedback | Thumbs-up/down plus short correction on outputs | Measures usefulness and calibrates team terminology | Low to medium, depending on comments |

## Data that should not be requested at first

The initial ask should explicitly exclude medical and injury records, contract and salary data, private player evaluation grades, live opponent-preparation materials, security-sensitive infrastructure information, and unrestricted raw Next Gen Stats feeds. The NFL’s tracking system is a high-volume precise data source, but it should be treated as optional later-stage input—not the first dependency for a proof of value.

## Product gaps to close before a serious pilot

| Gap | Why it matters | Pilot-ready upgrade |
|---|---|---|
| Evidence provenance | Staff must see the clip, play ID, and source behind every conclusion | Add “Evidence” chips linking each claim to approved clips, play metadata, and model confidence |
| Human review | NFL workflows cannot depend on unsupervised AI output | Add approve, reject, edit, and coach-note states before any report is shared |
| Data lineage | Staff need to know what input made every output | Persist source file, source play IDs, analysis version, prompt/model version, and timestamps |
| Measurement validation | Estimates must be scored against trusted labels | Build an evaluation view that reports formation/coverage/route accuracy against staff-approved labels |
| Access control | Football data is sensitive | Add role-based permissions, team workspace isolation, audit logs, export control, and retention rules |
| Integration boundary | A pilot cannot require a system replacement | Support one-way import of approved CSV/JSON/video metadata and one-way export of reviewed reports |

## Pilot success criteria

The pilot should be evaluated on whether coaches can get to an approved teaching package faster, whether every claim is traceable to evidence, whether labels meet a pre-agreed accuracy benchmark, and whether staff would choose to use it in an actual opponent-preparation meeting. A good pilot is not “the AI produced a cool report”; it is “the staff approved a repeatable workflow that saves time without lowering trust.”
