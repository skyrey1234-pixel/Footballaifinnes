export type VideoUploadProgress = {
  percent: number;
  doneMB: number;
  totalMB: number;
  speedMBs: number;
  resumedChunks: number;
  totalChunks: number;
};

export type VideoUploadResult = {
  fileKey: string;
  videoUrl: string;
};

const CHUNK_SIZE = 25 * 1024 * 1024;
const MAX_FILE_SIZE = 6 * 1024 * 1024 * 1024;

function createUploadId(file: File) {
  const signature = `${file.name}|${file.size}|${file.lastModified}`;
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) {
    hash = (Math.imul(hash, 31) + signature.charCodeAt(i)) | 0;
  }
  return `u${(hash >>> 0).toString(36)}x${file.size.toString(36)}`.slice(0, 40);
}

export async function uploadVideoInChunks(
  file: File,
  onProgress: (progress: VideoUploadProgress) => void,
): Promise<VideoUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Video is too large. The maximum file size is 6GB.");
  }
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a valid video file.");
  }

  const uploadId = createUploadId(file);
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const totalMB = file.size / (1024 * 1024);
  const chunkDone = new Array<number>(totalChunks).fill(0);
  const startedAt = Date.now();
  let resumedChunks = 0;

  const reportProgress = () => {
    const done = chunkDone.reduce((sum, bytes) => sum + bytes, 0);
    const elapsed = Math.max(0.25, (Date.now() - startedAt) / 1000);
    onProgress({
      percent: Math.min(99, Math.round((done / file.size) * 100)),
      doneMB: done / (1024 * 1024),
      totalMB,
      speedMBs: done / (1024 * 1024) / elapsed,
      resumedChunks,
      totalChunks,
    });
  };

  const putChunk = (index: number, blob: Blob, attempt = 0): Promise<void> =>
    new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/upload/chunk?uploadId=${uploadId}&index=${index}`);
      request.setRequestHeader("Content-Type", "application/octet-stream");
      request.timeout = 120_000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          chunkDone[index] = event.loaded;
          reportProgress();
        }
      };
      const retryOrFail = (error: Error) => {
        chunkDone[index] = 0;
        if (attempt < 5) {
          window.setTimeout(() => {
            putChunk(index, blob, attempt + 1).then(resolve, reject);
          }, Math.min(24_000, 1_500 * 2 ** attempt));
        } else {
          reject(error);
        }
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          chunkDone[index] = blob.size;
          reportProgress();
          resolve();
          return;
        }
        retryOrFail(new Error(`Chunk ${index + 1}/${totalChunks} failed (${request.status})`));
      };
      request.onerror = () => retryOrFail(new Error(`Network error on chunk ${index + 1}/${totalChunks}`));
      request.ontimeout = () => retryOrFail(new Error(`Chunk ${index + 1}/${totalChunks} timed out`));
      request.send(blob);
    });

  let uploaded = new Set<number>();
  if (totalChunks > 1) {
    try {
      const statusResponse = await fetch(`/api/upload/status?uploadId=${uploadId}&totalChunks=${totalChunks}`);
      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as { have: number[] };
        uploaded = new Set(status.have);
        resumedChunks = status.have.length;
        for (const index of status.have) {
          chunkDone[index] = Math.min((index + 1) * CHUNK_SIZE, file.size) - index * CHUNK_SIZE;
        }
        reportProgress();
      }
    } catch {
      // Resume detection is best-effort; a fresh upload still works.
    }
  }

  const pending = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !uploaded.has(index));
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const pendingIndex = cursor++;
      if (pendingIndex >= pending.length) return;
      const chunkIndex = pending[pendingIndex];
      const blob = file.slice(
        chunkIndex * CHUNK_SIZE,
        Math.min((chunkIndex + 1) * CHUNK_SIZE, file.size),
      );
      await putChunk(chunkIndex, blob);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pending.length || 1) }, worker));

  const completeResponse = await fetch(
    `/api/upload/complete?uploadId=${uploadId}` +
      `&totalChunks=${totalChunks}` +
      `&totalSize=${file.size}` +
      `&filename=${encodeURIComponent(file.name)}` +
      `&contentType=${encodeURIComponent(file.type || "video/mp4")}`,
    { method: "POST" },
  );
  if (!completeResponse.ok) {
    const body = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to finalize upload (${completeResponse.status})`);
  }
  const { fileKey } = (await completeResponse.json()) as { fileKey: string };
  onProgress({ percent: 100, doneMB: totalMB, totalMB, speedMBs: 0, resumedChunks, totalChunks });
  return { fileKey, videoUrl: `/manus-storage/${fileKey}` };
}
