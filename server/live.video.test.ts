import express from "express";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn(async () => ({ id: 1 })));
const sessionMock = vi.hoisted(() => vi.fn(async () => ({
  id: 55,
  userId: 1,
  sourceType: "upload",
  videoFileKey: "videos/test.mp4",
})));
const signedUrlMock = vi.hoisted(() => vi.fn(async () => "https://storage.example/test.mp4"));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: authMock } }));
vi.mock("./db", () => ({ getLiveGameSession: sessionMock }));
vi.mock("./storage", () => ({ storageGetSignedUrl: signedUrlMock }));

import { LIVE_REPLAY_CHUNK_BYTES, liveVideoRouter, normalizeLiveReplayRange } from "./liveVideoRoute";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("Live replay streaming", () => {
  it("bounds open-ended browser ranges so one request cannot stream an entire multi-gigabyte replay", () => {
    expect(normalizeLiveReplayRange("bytes=0-")).toBe(`bytes=0-${LIVE_REPLAY_CHUNK_BYTES - 1}`);
    expect(normalizeLiveReplayRange("bytes=500-99999999")).toBe(`bytes=500-${500 + LIVE_REPLAY_CHUNK_BYTES - 1}`);
    expect(normalizeLiveReplayRange("bytes=100-999")).toBe("bytes=100-999");
  });

  it("forwards byte ranges and does not abort the upstream body when the request finishes", async () => {
    let upstreamSignal: AbortSignal | null = null;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamSignal = init?.signal ?? null;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          setTimeout(() => {
            if (upstreamSignal?.aborted) {
              controller.error(new DOMException("aborted", "AbortError"));
              return;
            }
            controller.enqueue(new Uint8Array([1, 2, 3, 4]));
            controller.close();
          }, 30);
        },
      });
      return new Response(body, {
        status: 206,
        headers: {
          "accept-ranges": "bytes",
          "content-length": "4",
          "content-range": "bytes 0-3/100",
          "content-type": "video/mp4",
        },
      });
    }) as typeof fetch;

    const app = express();
    app.use(liveVideoRouter);
    const server = await new Promise<http.Server>((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose a port");

    try {
      const response = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
        const request = http.request({
          hostname: "127.0.0.1",
          port: address.port,
          path: "/api/live/video/55",
          headers: { Range: "bytes=0-3", Cookie: "app_session_id=test" },
        }, (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          incoming.on("end", () => resolve({ status: incoming.statusCode || 0, headers: incoming.headers, body: Buffer.concat(chunks) }));
          incoming.on("error", reject);
        });
        request.on("error", reject);
        request.end();
      });

      expect(response.status).toBe(206);
      expect(response.headers["content-range"]).toBe("bytes 0-3/100");
      expect(response.headers["accept-ranges"]).toBe("bytes");
      expect([...response.body]).toEqual([1, 2, 3, 4]);
      expect(sessionMock).toHaveBeenCalledWith(55, 1);
      const upstreamHeaders = (vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers || {}) as Record<string, string>;
      expect(upstreamHeaders.Range).toBe("bytes=0-3");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
