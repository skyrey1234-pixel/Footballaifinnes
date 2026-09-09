import express from "express";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn(async () => ({ id: 1 })));
const reconstructionMock = vi.hoisted(() => vi.fn(async () => ({
  id: 77,
  userId: 1,
  sourceType: "upload",
  gameSessionId: 55,
  liveSessionId: null,
  videoUrl: "/manus-storage/videos/fallback.mp4",
})));
const gameSessionMock = vi.hoisted(() => vi.fn(async () => ({
  id: 55,
  userId: 1,
  sourceType: "upload",
  videoFileKey: "videos/twin.mp4",
  videoUrl: "/manus-storage/videos/twin.mp4",
})));
const liveSessionMock = vi.hoisted(() => vi.fn());
const signedUrlMock = vi.hoisted(() => vi.fn(async () => "https://storage.example/twin.mp4"));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: authMock } }));
vi.mock("./db", () => ({
  getPlayReconstruction: reconstructionMock,
  getGameSession: gameSessionMock,
  getLiveGameSession: liveSessionMock,
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: signedUrlMock }));

import { tacticalTwinVideoRouter } from "./tacticalTwinVideoRoute";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

async function requestVideo(path: string, range: string | null = "bytes=0-3") {
  const app = express();
  app.use(tacticalTwinVideoRouter);
  const server = await new Promise<http.Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  try {
    return await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      const request = http.request({
        hostname: "127.0.0.1",
        port: address.port,
        path,
        headers: { ...(range ? { Range: range } : {}), Cookie: "app_session_id=test" },
      }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        incoming.on("end", () => resolve({ status: incoming.statusCode || 0, headers: incoming.headers, body: Buffer.concat(chunks) }));
        incoming.on("error", reject);
      });
      request.on("error", reject);
      request.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Tactical Twin source-film streaming", () => {
  it("authenticates ownership and streams bounded browser ranges from the original upload", async () => {
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "content-length": "4",
        "content-range": "bytes 0-3/100",
        "content-type": "video/mp4",
      },
    })) as typeof fetch;

    const response = await requestVideo("/api/tactical-twin/video/77");

    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 0-3/100");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect([...response.body]).toEqual([1, 2, 3, 4]);
    expect(reconstructionMock).toHaveBeenCalledWith(77, 1);
    expect(gameSessionMock).toHaveBeenCalledWith(55);
    expect(signedUrlMock).toHaveBeenCalledWith("videos/twin.mp4");
    const upstreamHeaders = (vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers || {}) as Record<string, string>;
    expect(upstreamHeaders.Range).toBe("bytes=0-3");
  });

  it("returns not found without touching storage when the reconstruction is not owned", async () => {
    reconstructionMock.mockResolvedValueOnce(null);
    const response = await requestVideo("/api/tactical-twin/video/77");
    expect(response.status).toBe(404);
    expect(signedUrlMock).not.toHaveBeenCalled();
  });

  it("converts an initial browser request without Range into a bounded 4 MB metadata request", async () => {
    globalThis.fetch = vi.fn(async (_url, init) => {
      const upstreamRange = (init?.headers as Record<string, string>).Range;
      expect(upstreamRange).toBe("bytes=0-4194303");
      return new Response(new Uint8Array([9, 8, 7, 6]), {
        status: 206,
        headers: {
          "accept-ranges": "bytes",
          "content-length": "4",
          "content-range": "bytes 0-3/228464608",
          "content-type": "video/mp4",
        },
      });
    }) as typeof fetch;

    const response = await requestVideo("/api/tactical-twin/video/77", null);
    expect(response.status).toBe(206);
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect([...response.body]).toEqual([9, 8, 7, 6]);
  });
});
