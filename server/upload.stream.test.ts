import { describe, expect, it } from "vitest";
import express from "express";
import { uploadRouter } from "./uploadRoute";
import type { Server } from "http";

describe("streaming upload route", () => {
  it("accepts a multipart upload and streams it to S3", async () => {
    const app = express();
    app.use(uploadRouter);
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (server.address() as any).port;

    try {
      const form = new FormData();
      const bytes = new Uint8Array(256 * 1024); // 256KB dummy video
      form.append("file", new Blob([bytes], { type: "video/mp4" }), "test-game.mp4");

      const res = await fetch(`http://localhost:${port}/api/upload`, {
        method: "POST",
        headers: { "X-File-Size": String(bytes.length) },
        body: form,
      });
      const body = await res.json(); if (!res.ok) console.log("ERROR BODY:", res.status, JSON.stringify(body));
      expect(res.ok).toBe(true);
      expect(body.fileKey).toMatch(/^videos\/\d+-test-game\.mp4$/);
      expect(body.url).toContain("/manus-storage/");
    } finally {
      server.close();
    }
  }, 30000);

  it("rejects requests with no file", async () => {
    const app = express();
    app.use(uploadRouter);
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (server.address() as any).port;
    try {
      const form = new FormData();
      form.append("notafile", "hello");
      const res = await fetch(`http://localhost:${port}/api/upload`, {
        method: "POST",
        headers: { "X-File-Size": "100" },
        body: form,
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  }, 15000);
});
