import { describe, expect, it } from "vitest";

// Verifies the Forge presign flow used by upload.getPresignedUrl works
describe("upload presign flow", () => {
  it("gets a presigned PUT URL and can upload bytes directly to S3", async () => {
    const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
    const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
    expect(forgeUrl).toBeTruthy();
    expect(forgeKey).toBeTruthy();

    const fileKey = `videos/test-${Date.now()}-sample.mp4`;
    const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
    presignUrl.searchParams.set("path", fileKey);
    const resp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });
    expect(resp.ok).toBe(true);
    const { url } = (await resp.json()) as { url: string };
    expect(url).toBeTruthy();

    // Upload a small dummy payload directly to S3 (same as the browser would)
    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: new Blob([new Uint8Array(1024)], { type: "video/mp4" }),
    });
    expect(put.ok).toBe(true);
  }, 30000);
});
