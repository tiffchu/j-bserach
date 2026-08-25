/** Cloudflare Worker entry point for Scout. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleJobs } from "./jobs";

interface Env {
  ASSETS: Fetcher;
  CV_FILES: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } };
  };
}

interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/jobs" && request.method === "GET") return handleJobs(request);

    if (url.pathname === "/api/cv" && request.method === "POST") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 10 * 1024 * 1024) return json({ error: "File is larger than 10 MB" }, 413);
      if (!request.body) return json({ error: "A file is required" }, 400);
      const filename = (url.searchParams.get("filename") || "cv").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90);
      const key = `cv/${crypto.randomUUID()}-${filename}`;
      await env.CV_FILES.put(key, request.body, { httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" }, customMetadata: { originalName: filename, uploadedAt: new Date().toISOString() } });
      return json({ ok: true, key, status: "ready" }, 201);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => (await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality })).response(),
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
