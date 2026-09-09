# Higgsfield Stage 2 API Findings

Official sources reviewed on 2026-09-09:

- https://docs.higgsfield.ai/docs/index.md
- https://docs.higgsfield.ai/docs/how-to/introduction.md
- https://docs.higgsfield.ai/docs/concepts/requests.md
- https://docs.higgsfield.ai/docs/how-to/sdk.md
- https://docs.higgsfield.ai/docs/concepts/file-uploads.md
- https://docs.higgsfield.ai/docs/llms.txt

## Verified integration facts

Higgsfield uses server-side credentials with the `Authorization: Key <key-id>:<key-secret>` format. Generation is asynchronous: submission returns `request_id`, `status_url`, and `cancel_url`; statuses include `queued`, `in_progress`, `completed`, `failed`, `nsfw`, and `canceled`. The stable request ID must be stored immediately for polling, cancellation, webhook deduplication, and support.

Official TypeScript support is provided by `@higgsfield/client`, and browser-side credential use is explicitly blocked. Production integrations should submit with webhook completion and retain status polling as recovery. Uploads use a generated presigned URL; supported video input is `video/mp4`. Completed video responses provide a video URL. Higgsfield retains output URLs for at least seven days, so TacticalEdge must copy completed cinematic exports into its own storage for durable sharing.

The user has an enabled Higgsfield connector in this Manus task, but connector-backed credentials are not automatically available inside the deployed TacticalEdge server. The production app therefore needs its own server-side Higgsfield credentials or another authenticated provider bridge before a real export can be generated from the website.
