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

The user-approved second 32.5-credit run was submitted from the actual production `Generate Cinematic Replay` button. Owner-scoped export `810001` was created automatically from the server-extracted 00:30 keyframe, and exactly one paid Higgsfield provider job was launched. When the connector task returned the completed provider job ID without the MP4 URL, the deployed bridge launched one read-only, non-generative status-recovery task for that same job. The recovery task returned the final MP4 URL, and TacticalEdge automatically retained the video and thumbnail in private storage without a manual import or duplicate generation.

Export `810001` appears as `COMPLETED` in the production gallery with Preview, Download, Share, and delete controls. Its retained signed MP4 responded as `video/mp4` with byte-range support and a five-second timeline. A seven-day link created from the actual gallery resolved through the safe public projection, incremented its view counter, exposed only the generated replay plus Download MP4, expiration, and the interpretation-not-evidence warning, and exposed no private film or tracking data. `Revoke all links` was then exercised in the owner UI; all three test shares received the same revocation timestamp, and the previously working public URL immediately changed to `Replay link unavailable`.

The connector cancellation path was also tested live without spending provider credits: a private Higgsfield-connected Manus task was created with explicit instructions never to generate media, stopped through the same app bridge endpoint, and reported terminal status `stopped` with no provider generation active. Final code validation is 31/31 test files and 138/138 tests, with clean TypeScript and production build.

For actual gallery-action validation, owner-scoped export `960001` was attached to a private interactive Manus task that explicitly forbids uploads, media generation, and provider-credit use. The deployed TacticalEdge gallery rendered it as `IN_PROGRESS` with its real `Check` and `Cancel` controls, proving the owner UI is connected to the live connector task before cancellation.

The actual production `Cancel` button was then clicked. The gallery immediately rendered export `960001` as `CANCELED` and showed `Cinematic render canceled`; the database persisted `status=canceled`, no output file or output URL, and provenance explicitly forbidding provider generation. The underlying Manus task reported terminal `stopped`, and its event history contained no tool invocation names, proving no Higgsfield media action ran.

The authenticated production gallery also reopened export `810001` as `COMPLETED` with its private video element, native controls, Preview, signed Download, and Share actions visible. The retained video source is already byte-range validated; the native player is now being exercised directly for explicit in-app frame evidence.

The final private-preview candidate now returns both a short-lived retained MP4 URL and owner-scoped poster URL, and renders the selected private replay with native controls, muted autoplay, loop, inline playback, preload auto, and an explicit accessible label. The complete validation after this change is 32/32 test files and 142/142 tests with clean strict TypeScript and production build; deployed visual proof remains the only open release check.

Checkpoint `77d41575` is deployed in the authenticated production studio. Twin 30001 loads the corrected 24/24 review set at 91% confidence and 75% calibration, the connector bridge reports ready, and the gallery still contains completed export 810001. The viewport is now positioned immediately above the cinematic gallery for explicit retained-poster/autoplay evidence.

The final authenticated full-page capture visibly renders a real football frame inside export `810001`’s private gallery video element. The same card shows `COMPLETED`, Preview, signed Download, delete, and Share controls; the video is backed by the retained five-second MP4 plus owner-scoped poster and uses muted autoplay, loop, inline playback, preload auto, and native controls. This closes the final private-preview evidence requirement in the actual Tactical Twin gallery context.

The saved 1280×4541 authenticated screenshot `/home/ubuntu/screenshots/webdev-preview-twin_30001-1788994628249638044-4122.png` was inspected directly. It shows the Tactical Twin owner session, corrected 24/24 tracking state, connector bridge ready, and export `810001` marked `COMPLETED` with a real football field frame visibly rendered inside the private native player at 0:00, alongside Preview, Download, delete, and Share actions. This is explicit in-app gallery evidence rather than a standalone media probe.
