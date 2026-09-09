import express from "express";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const getExportMock = vi.hoisted(() => vi.fn());
const updateExportMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./db", () => ({
  getTwinCinematicExportByProviderRequest: getExportMock,
  updateTwinCinematicExport: updateExportMock,
}));

import { higgsfieldWebhookRouter } from "./higgsfieldWebhookRoute";

afterEach(() => vi.clearAllMocks());

async function postWebhook(body: unknown) {
  const app = express();
  app.use(express.json());
  app.use(higgsfieldWebhookRouter);
  const server = await new Promise<http.Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Webhook test server did not expose a port");
  try {
    return await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = http.request({
        hostname: "127.0.0.1",
        port: address.port,
        path: "/api/webhooks/higgsfield",
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
      }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        incoming.on("end", () => resolve({ status: incoming.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }));
        incoming.on("error", reject);
      });
      request.on("error", reject);
      request.end(payload);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Higgsfield cinematic completion webhook", () => {
  it("rejects malformed or non-terminal payloads", async () => {
    const response = await postWebhook({ request_id: "request-12345678", status: "in_progress" });
    expect(response.status).toBe(400);
    expect(getExportMock).not.toHaveBeenCalled();
  });

  it("acknowledges unknown valid request IDs without creating data", async () => {
    getExportMock.mockResolvedValueOnce(undefined);
    const response = await postWebhook({ request_id: "request-unknown-1234", status: "completed", payload: { video: { url: "https://cdn.higgsfield.ai/output.mp4" } } });
    expect(response.status).toBe(202);
    expect(updateExportMock).not.toHaveBeenCalled();
  });

  it("persists a narrow terminal update and remains idempotent on provider retries", async () => {
    getExportMock.mockResolvedValue({ id: 77, userId: 41, outputUrl: null });
    const body = { request_id: "request-complete-1234", status: "completed", payload: { video: { url: "https://cdn.higgsfield.ai/output.mp4", content_type: "video/mp4" } } };
    const first = await postWebhook(body);
    const retry = await postWebhook(body);
    expect(first.status).toBe(202);
    expect(retry.status).toBe(202);
    expect(updateExportMock).toHaveBeenCalledTimes(2);
    expect(updateExportMock).toHaveBeenLastCalledWith(77, 41, expect.objectContaining({ status: "completed", outputUrl: "https://cdn.higgsfield.ai/output.mp4", errorMessage: null }));
  });
});

