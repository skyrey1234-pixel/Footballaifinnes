import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { uploadRouter } from "./uploadRoute";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(uploadRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server?.close();
});

describe("chunked upload flow", () => {
  it("uploads chunks, completes, and the assembled object matches", async () => {
    // 3 chunks with distinct recognizable content
    const chunkA = Buffer.alloc(1024 * 1024, 0x41); // 'A'
    const chunkB = Buffer.alloc(1024 * 1024, 0x42); // 'B'
    const chunkC = Buffer.alloc(512 * 1024, 0x43); // 'C'
    const chunks = [chunkA, chunkB, chunkC];
    const totalSize = chunkA.length + chunkB.length + chunkC.length;
    const uploadId = `test${Date.now().toString(36)}abcd`;

    for (let i = 0; i < chunks.length; i++) {
      const resp = await fetch(
        `${baseUrl}/api/upload/chunk?uploadId=${uploadId}&index=${i}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(chunks[i].length),
          },
          body: new Uint8Array(chunks[i]),
        },
      );
      expect(resp.status).toBe(200);
    }

    const completeResp = await fetch(
      `${baseUrl}/api/upload/complete?uploadId=${uploadId}&totalChunks=3&totalSize=${totalSize}&filename=chunk-test.mp4&contentType=video/mp4`,
      { method: "POST" },
    );
    expect(completeResp.status).toBe(200);
    const { fileKey } = (await completeResp.json()) as { fileKey: string };
    expect(fileKey).toMatch(/^videos\/\d+-chunk-test\.mp4$/);

    // Verify the assembled object: presign GET and check size + boundary bytes
    const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
    const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
    const u = new URL("v1/storage/presign/get", forgeUrl + "/");
    u.searchParams.set("path", fileKey);
    const pres = await fetch(u, { headers: { Authorization: `Bearer ${forgeKey}` } });
    const { url } = (await pres.json()) as { url: string };
    const obj = await fetch(url);
    expect(obj.status).toBe(200);
    const buf = Buffer.from(await obj.arrayBuffer());
    expect(buf.length).toBe(totalSize);
    expect(buf[0]).toBe(0x41); // starts with 'A'
    expect(buf[chunkA.length]).toBe(0x42); // 'B' starts right after A
    expect(buf[chunkA.length + chunkB.length]).toBe(0x43); // then 'C'
    expect(buf[buf.length - 1]).toBe(0x43); // ends with 'C'
  }, 120000);

  it("rejects invalid uploadId and oversized totals", async () => {
    const bad1 = await fetch(`${baseUrl}/api/upload/chunk?uploadId=..%2Fetc&index=0`, {
      method: "POST",
      headers: { "Content-Length": "10", "Content-Type": "application/octet-stream" },
      body: new Uint8Array(10),
    });
    expect(bad1.status).toBe(400);

    const bad2 = await fetch(
      `${baseUrl}/api/upload/complete?uploadId=validuploadid1&totalChunks=1&totalSize=${7 * 1024 * 1024 * 1024}`,
      { method: "POST" },
    );
    expect(bad2.status).toBe(400);
  }, 30000);
});
