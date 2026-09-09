import { createTwinCinematicExport } from "../server/db";
import { MANUS_HIGGSFIELD_CONNECTOR_ID, MANUS_HIGGSFIELD_MODEL } from "../server/manusHiggsfieldBridge";

const apiKey = process.env.MANUS_API_KEY?.trim();
if (!apiKey) throw new Error("MANUS_API_KEY is not configured");

const response = await fetch("https://api.manus.ai/v2/task.create", {
  method: "POST",
  headers: { "x-manus-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "TacticalEdge in-app cancel validation",
    interactive_mode: false,
    hide_in_task_list: true,
    share_visibility: "private",
    agent_profile: "manus-1.6",
    message: {
      connectors: [MANUS_HIGGSFIELD_CONNECTOR_ID],
      content: [{
        type: "text",
        text: "Cancellation validation only. Do not generate media, upload files, or spend provider credits. Use only models_explore, then wait for user confirmation indefinitely. Never call generate_video.",
      }],
    },
    structured_output_schema: {
      type: "object",
      properties: { status: { type: "string" } },
      required: ["status"],
      additionalProperties: false,
    },
  }),
  signal: AbortSignal.timeout(30_000),
});
const body = await response.json().catch(() => null) as Record<string, unknown> | null;
if (!response.ok || body?.ok !== true) throw new Error(`Task creation failed (${response.status})`);
const taskId = String(body.task_id ?? "");
if (!taskId) throw new Error("No task ID returned");

const now = Date.now();
const exportId = await createTwinCinematicExport({
  reconstructionId: 30001,
  userId: 1,
  provider: "manus-higgsfield",
  providerRequestId: taskId,
  statusUrl: body.task_url ? String(body.task_url) : null,
  cancelUrl: null,
  status: "in_progress",
  model: MANUS_HIGGSFIELD_MODEL,
  prompt: "Non-generative production cancellation validation. No media generation authorized.",
  style: "cancel_validation",
  aspectRatio: "16:9",
  durationSeconds: 5,
  provenance: {
    validationOnly: true,
    noProviderGenerationAuthorized: true,
    connectorId: MANUS_HIGGSFIELD_CONNECTOR_ID,
  },
  createdAt: now,
  submittedAt: now,
  updatedAt: now,
});

console.log(JSON.stringify({ exportId, taskCreated: true, providerGenerationAuthorized: false }, null, 2));
