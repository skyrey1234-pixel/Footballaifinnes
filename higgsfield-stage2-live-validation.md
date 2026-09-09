# Higgsfield Stage 2 — Live Connector Validation

Validated on 2026-09-09 through the enabled `higgsfield` OAuth MCP connector.

## Connector facts

- The connector catalog exposes `media_upload`, `media_confirm`, `models_explore`, `generate_video`, and `job_status`.
- `models_explore` recommended `seedance_2_5` for a reference-image cinematic replay.
- Source media role: `start_image`.
- Validated output settings: 5 seconds, 16:9, 720p, audio disabled, standard bitrate, `omni_reference` mode.
- Cost preflight returned exactly 32.5 Higgsfield credits. The user explicitly confirmed this spend before submission.

## Real generation

- Source: verified Twin 30001 football frame at 00:30, uploaded as JPEG media ID `68b948d1-ed25-4205-927b-c79c16c6a321`.
- Higgsfield job ID: `257db886-d5f9-4182-bb3d-8ad0f96a2d31`.
- Terminal status: `completed`.
- Provider output URL: `https://d8j0ntlcm91z4.cloudfront.net/user_3Ih4IPE3h7ye7xYJOIssuy7sAmX/hf_20260909_181210_257db886-d5f9-4182-bb3d-8ad0f96a2d31.mp4`.
- Downloaded output validation: H.264, 1280×720, 24 fps, 5.041667 seconds, 1,985,357 bytes.

The output must be retained in TacticalEdge storage before it is exposed in the private gallery or through expiring share links. Treat the provider URL as temporary.

## TacticalEdge retention and gallery

The completed MP4 and the verified 00:30 source thumbnail were uploaded into TacticalEdge private storage. Owner-scoped cinematic export `600001` now appears in Twin 30001's production gallery as `COMPLETED`, with Preview, Download, and Share controls. The gallery identifies it as a 16:9, five-second broadcast-cinematic render and keeps the original film and Tactical Twin unchanged.

## Secure sharing

A seven-day, revocable public share was created successfully. The public route displays only the reconstruction title, source-title label, cinematic style, five-second duration, retained generated MP4, expiration timestamp, download action, and the explicit warning `Cinematic interpretation—not verified game-film evidence`. It does not expose the original game film, player tracks, coach corrections, Tactical Twin geometry, account identity, or storage credentials. The first public-player capture remained in its initial loading state, so signed-media readiness is being verified separately before release closure.

The retained private preview subsequently rendered a visible football frame and reported a complete five-second timeline in the production gallery. The public projection issued a fresh signed MP4 URL whose decoded request returned HTTP 206, `video/mp4`, a valid 0–1023 content range, and a total retained size of 1,985,357 bytes. The share route also exposed a Download MP4 action and no private evidence fields. In the connected-browser screenshot the public native player remained in its initial loading frame, but the exact signed media response and the same retained gallery MP4 were verified independently.

Final mobile capture at 390×844 shows the complete Stage 2 studio stacking correctly: frame transport, 24/24 tracking review, coach corrections, cinematic controls, completed retained export, Tactical Map, and editor remain reachable. A separate mobile capture of the public share visibly renders the generated football frame, the five-second timeline, Download MP4 action, expiration, and the interpretation-not-evidence warning. Final local validation is 30/30 test files and 132/132 tests with clean TypeScript and production build.

User-supplied production screenshots additionally confirm the complete Stage 2 mobile studio renders the 24/24 review set, coach correction fields, retained broadcast-cinematic gallery item, Tactical Map, 3D Twin entry, and verification controls in one responsive flow. The public share screenshot visibly renders the generated five-second football replay with Download MP4 and the explicit “cinematic interpretation—not verified game-film evidence” boundary.

After adding the explicit 0–100 confidence contract plus a unit-scale normalization guardrail, a fresh non-persisting real-football run against Twin 30001 returned one analyzed frame, 11 anonymous players, 85% frame confidence, 70–85% positive detection confidence, and 60% calibration confidence. This proves the prior 1% ambiguity is removed while zero-confidence unavailable field coordinates remain absent rather than fabricated.

The deployed audit-preserving Reprocess Confidence path then created production job 750001 without deleting the original review set. It completed 24/24 real server-extracted frames in coach-review state with 85–95% frame confidence and 75% field-calibration confidence. The production UI visibly showed corrected player confidence values around 90% image / 70% field during processing.

The app-scoped Manus bridge was validated live with a private, hidden, non-generative task using the authorized Higgsfield connector. The task completed structured output with `status=ready` and `imageToVideoAvailable=true` without uploading media or spending Higgsfield generation credits. The deployed production studio reports CONNECTOR BRIDGE READY; its Generate action now creates, polls, confirms, cancels, and retains connector-backed replay tasks automatically.

The final server-assisted cinematic keyframe build is deployed in the authenticated production studio. Twin 30001 renders the corrected 24/24 review set at 91% vision confidence and 75% calibration, exposes `CONNECTOR BRIDGE READY`, and retains export #600001. The deployed bundle contains the timestamp-only `sourceFrameTimestampSeconds` request and no longer contains the browser `loadedmetadata` timeout path; the user-approved second generation can now be submitted from the actual Generate control without hidden-video capture.
