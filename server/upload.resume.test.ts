import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { uploadRouter } from "./uploadRoute";

// Verifies the resume flow: upload some chunks, ask /api/upload/status which
// ones exist, and confirm the reported set matches what was uploaded.
describe("upload resume status", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(uploadRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => server?.close());

  it("reports exactly the chunks that were uploaded", async () => {
    const uploadId = `resumetest${Date.now().toString(36)}`;
    const totalChunks = 4;
    // Upload chunks 0 and 2 only.
    for (const idx of [0, 2]) {
      const body = new Uint8Array(1024).fill(0x41 + idx);
      const r = await fetch(`${baseUrl}/api/upload/chunk?uploadId=${uploadId}&index=${idx}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "Content-Length": "1024" },
        body,
      });
      expect(r.status).toBe(200);
    }

    const st = await fetch(
      `${baseUrl}/api/upload/status?uploadId=${uploadId}&totalChunks=${totalChunks}`,
    );
    expect(st.status).toBe(200);
    const { have } = (await st.json()) as { have: number[] };
    expect(have.sort()).toEqual([0, 2]);
  }, 60000);

  it("rejects invalid status params", async () => {
    const bad = await fetch(`${baseUrl}/api/upload/status?uploadId=..%2Fbad&totalChunks=2`);
    expect(bad.status).toBe(400);
    const bad2 = await fetch(`${baseUrl}/api/upload/status?uploadId=validuploadid1&totalChunks=9999`);
    expect(bad2.status).toBe(400);
  }, 30000);
});
