import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(async () => "https://storage.example/source.jpg?signature=test"),
}));

import {
  cancelManusHiggsfieldReplay,
  getManusHiggsfieldReplayStatus,
  MANUS_HIGGSFIELD_CONNECTOR_ID,
  submitManusHiggsfieldReplay,
} from "./manusHiggsfieldBridge";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Manus Higgsfield connector bridge", () => {
  const originalKey = process.env.MANUS_API_KEY;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.MANUS_API_KEY = "test-manus-key";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.MANUS_API_KEY = originalKey;
  });

  it("creates one private connector task with the signed source frame and structured result contract", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true, task_id: "task-123", task_url: "https://manus.im/app/task-123" }));
    const result = await submitManusHiggsfieldReplay({
      exportId: 600002,
      sourceImageKey: "private/source.jpg",
      prompt: "Preserve the football formation.",
      durationSeconds: 5,
      aspectRatio: "16:9",
    });

    expect(result).toEqual({ taskId: "task-123", taskUrl: "https://manus.im/app/task-123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.manus.ai/v2/task.create");
    const payload = JSON.parse(String(init?.body));
    expect(payload.message.connectors).toEqual([MANUS_HIGGSFIELD_CONNECTOR_ID]);
    expect(payload.share_visibility).toBe("private");
    expect(payload.hide_in_task_list).toBe(true);
    expect(payload.message.content[1]).toMatchObject({ type: "file", file_url: expect.stringContaining("source.jpg") });
    expect(payload.structured_output_schema.required).toEqual(["status", "providerJobId", "outputUrl", "error"]);
    expect(payload.message.content[0].text).toContain("Never submit more than one generation");
  });

  it("parses a completed structured output and preserves the provider job ID", async () => {
    fetchMock.mockResolvedValueOnce(response({
      ok: true,
      task_id: "task-123",
      messages: [{
        type: "structured_output_result",
        structured_output_result: {
          success: true,
          value: { status: "completed", providerJobId: "hf-job-123", outputUrl: "https://media.example/replay.mp4", error: "" },
          error: null,
        },
      }],
    }));
    await expect(getManusHiggsfieldReplayStatus("task-123")).resolves.toMatchObject({
      status: "completed",
      providerJobId: "hf-job-123",
      outputUrl: "https://media.example/replay.mp4",
    });
  });

  it("confirms a pending paid connector action because the coach already clicked Generate", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ ok: true, messages: [{ type: "status_update", status_update: { agent_status: "waiting", status_detail: { waiting_for_event_id: "event-1" } } }] }))
      .mockResolvedValueOnce(response({ ok: true, task_id: "task-123", confirmed: true }));
    await expect(getManusHiggsfieldReplayStatus("task-123")).resolves.toMatchObject({ status: "in_progress" });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://api.manus.ai/v2/task.confirmAction");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ task_id: "task-123", event_id: "event-1" });
  });

  it("stops the background task when a queued export is canceled", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true }));
    await cancelManusHiggsfieldReplay("task-123");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.manus.ai/v2/task.stop");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ task_id: "task-123" });
  });
});
