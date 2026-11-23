import test from "node:test";
import assert from "node:assert/strict";
import { buildHunyuanI2VWorkflow, framesForSeconds, HUNYUAN_I2V_DEFAULTS, validateVideoWorkflow } from "../src/shared/comfy-video-workflow.js";
import { createComfyClient } from "../src/host/comfy.js";

test("the image-to-video graph binds the still as the first frame", () => {
  const workflow = buildHunyuanI2VWorkflow({ image: "still.png", seconds: 2, seed: 9 });
  assert.deepEqual(validateVideoWorkflow(workflow), []);
  const types = Object.values(workflow).map((node) => node.class_type);
  assert.deepEqual(types, [
    "UNETLoader", "DualCLIPLoader", "VAELoader", "CLIPVisionLoader", "LoadImage",
    "CLIPVisionEncode", "CLIPTextEncode", "CLIPTextEncode", "HunyuanVideo15ImageToVideo",
    "ModelSamplingSD3", "BasicScheduler", "KSamplerSelect", "RandomNoise", "CFGGuider",
    "SamplerCustomAdvanced", "VAEDecode", "CreateVideo", "SaveVideo",
  ]);
  assert.equal(workflow["5"].inputs.image, "still.png", "the uploaded still feeds LoadImage");
  // the same node produces positive, negative and the latent: that binding is
  // what makes it image-to-video instead of text-to-video
  assert.deepEqual(workflow["14"].inputs.positive, ["9", 0]);
  assert.deepEqual(workflow["14"].inputs.negative, ["9", 1]);
  assert.deepEqual(workflow["15"].inputs.latent_image, ["9", 2]);
  assert.equal(workflow["2"].inputs.type, "hunyuan_video_15");
  assert.equal(workflow["10"].inputs.shift, HUNYUAN_I2V_DEFAULTS.shift);
  assert.equal(workflow["14"].inputs.cfg, 1, "the cfg-distilled checkpoint runs at cfg 1");
  assert.equal(workflow["13"].inputs.noise_seed, 9);
  assert.equal(workflow["18"].inputs.codec, "h264");
});

test("clip length is a 4n+1 frame count", () => {
  assert.equal(framesForSeconds(2, 24), 49);
  assert.equal(framesForSeconds(1, 24), 25);
  assert.equal(framesForSeconds(5, 24), 121);
  const workflow = buildHunyuanI2VWorkflow({ image: "x.png", frames: 33 });
  assert.equal(workflow["9"].inputs.length, 33);
  assert.deepEqual(validateVideoWorkflow(workflow), []);
});

test("video validation names the silent mistakes", () => {
  const missing = buildHunyuanI2VWorkflow({ image: "x.png" });
  delete missing["9"];
  const issues = validateVideoWorkflow(missing);
  assert.ok(issues.some((issue) => issue.includes("HunyuanVideo15ImageToVideo")));

  const noVision = buildHunyuanI2VWorkflow({ image: "x.png" });
  delete noVision["6"];
  assert.ok(validateVideoWorkflow(noVision).some((issue) => issue.includes("CLIPVisionEncode")));

  const badLength = buildHunyuanI2VWorkflow({ image: "x.png", frames: 30 });
  assert.ok(validateVideoWorkflow(badLength).some((issue) => issue.includes("4n+1")));

  assert.throws(() => buildHunyuanI2VWorkflow({ image: "  " }), /image is required/);
});

test("the client uploads a still and reports auth separately from being down", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.endsWith("/upload/image")) {
      return { ok: true, json: async () => ({ name: "vft-x-1.png", subfolder: "" }) };
    }
    if (url.endsWith("/system_stats")) return { ok: false, status: 401 };
    throw new Error(`unexpected url ${url}`);
  };
  const client = createComfyClient({ baseUrl: "http://127.0.0.1:8188", fetchImpl, sleep: async () => {} });
  const stored = await client.uploadImage(Buffer.from([1, 2, 3]), "vft-x-1.png");
  assert.equal(stored, "vft-x-1.png");
  assert.ok(calls[0].body instanceof FormData, "upload posts multipart form data");

  const probe = await client.probe();
  assert.deepEqual({ reachable: probe.reachable, ok: probe.ok, status: probe.status }, { reachable: true, ok: false, status: 401 });
  assert.equal(await client.ping(), false);
});

test("a video output is collected even though it is not an image", async () => {
  const png = Buffer.from([137, 80, 78, 71]);
  const fetchImpl = async (url) => {
    if (url.includes("/history/pid-2")) {
      return {
        ok: true,
        json: async () => ({
          "pid-2": {
            status: { status_str: "success" },
            outputs: { "18": { images: [{ filename: "vft_0001_.mp4", subfolder: "vft", type: "output" }] } },
          },
        }),
      };
    }
    if (url.includes("/view?")) return { ok: true, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
    throw new Error(`unexpected url ${url}`);
  };
  const client = createComfyClient({ baseUrl: "http://127.0.0.1:8188", fetchImpl, sleep: async () => {} });
  const { files, images } = await client.wait("pid-2", { timeoutMs: 1_000, intervalMs: 1 });
  assert.equal(files[0].filename, "vft_0001_.mp4");
  assert.deepEqual(images, [], "a clip is not reported as an image");
  const bytes = await client.download(files[0]);
  assert.equal(bytes.length, 4);
});
