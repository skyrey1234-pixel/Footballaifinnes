import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({ invokeLLM: invokeMock }));

import { analyzeTwinFrameBatch, MAX_TWIN_TRACKING_BATCH, TWIN_TRACKING_MODEL } from "./tacticalTwinTracking";

const sourceFrame = (frameIndex: number) => ({
  frameIndex,
  timestampMs: frameIndex * 500,
  imageWidth: 640,
  imageHeight: 360,
  dataUrl: `data:image/jpeg;base64,${Buffer.alloc(120, frameIndex + 1).toString("base64")}`,
});

describe("Tactical Twin automatic tracking normalization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes invented identities, clamps geometry, and never keeps an invisible ball location", async () => {
    invokeMock.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json
${JSON.stringify({
  frames: [{
    frameIndex: 0,
    players: [{
      trackId: "O1!",
      unit: "offense",
      label: "Invented Player Name",
      jerseyNumber: null,
      bbox: { x: -0.5, y: 1.5, width: 4, height: 0.2 },
      imagePoint: { x: 1.2, y: -1, confidence: 140 },
      fieldPoint: { x: 2, y: -2, confidence: -20 },
      occluded: false,
    }],
    ball: {
      visible: false,
      bbox: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 },
      imagePoint: { x: 0.5, y: 0.5, confidence: 99 },
      fieldPoint: { x: 0.5, y: 0.5, confidence: 99 },
      possessedByTrackId: "O1",
    },
    frameConfidence: 160,
  }],
  calibration: { quality: "high", confidence: 130, imagePoints: [{ x: -2, y: 2 }], fieldPoints: [{ x: 2, y: -2 }] },
  limitations: ["Single broadcast angle"],
})}
\`\`\`` } }],
    });

    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0)] });
    expect(result.frames[0].players[0]).toMatchObject({
      trackId: "O1",
      label: "offense O1",
      bbox: { x: 0, y: 1, width: 1, height: 0.2 },
      imagePoint: { x: 1, y: 0, confidence: 100 },
      manuallyCorrected: false,
    });
    expect(result.frames[0].ball).toMatchObject({ visible: false, bbox: null, imagePoint: null, fieldPoint: null, manuallyCorrected: false });
    expect(result.frames[0].frameConfidence).toBe(100);
    expect(result.calibration).toMatchObject({ confidence: 100, imagePoints: [{ x: 0, y: 1 }], fieldPoints: [{ x: 1, y: 0 }] });
    expect(invokeMock).toHaveBeenCalledWith(expect.objectContaining({ model: TWIN_TRACKING_MODEL, response_format: expect.objectContaining({ type: "json_schema" }) }));
  });

  it("returns an evidence-empty fallback for a requested frame omitted by the model", async () => {
    invokeMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "unavailable", confidence: 0, imagePoints: [], fieldPoints: [] }, limitations: ["Players are occluded"] }) } }],
    });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(7)] });
    expect(result.frames[0]).toMatchObject({ frameIndex: 7, players: [], frameConfidence: 0 });
    expect(result.frames[0].ball).toMatchObject({ visible: false, imagePoint: null, fieldPoint: null });
  });

  it("rejects malformed model output and caps each request to the supported batch size", async () => {
    invokeMock.mockResolvedValueOnce({ choices: [{ message: { content: "not valid tracking json" } }] });
    await expect(analyzeTwinFrameBatch({ frames: [sourceFrame(0)] })).rejects.toThrow("invalid JSON");

    invokeMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "low", confidence: 10, imagePoints: [], fieldPoints: [] }, limitations: [] }) } }],
    });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0), sourceFrame(1), sourceFrame(2), sourceFrame(3)] });
    expect(result.frames).toHaveLength(MAX_TWIN_TRACKING_BATCH);
  });
});

