import test from "node:test";
import assert from "node:assert/strict";
import { buildQwenImageWorkflow, QWEN_IMAGE_DEFAULTS, validateWorkflow, WALLPAPER_SIZES } from "../src/shared/comfy-workflow.js";
import { createComfyClient } from "../src/host/comfy.js";
import { decodePng, encodePng, imageStats } from "../src/shared/png-stats.js";

function solidPng(width, height, rgb) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 3] = rgb[0];
    pixels[index * 3 + 1] = rgb[1];
    pixels[index * 3 + 2] = rgb[2];
  }
  return encodePng({ width, height, pixels });
}

function checkerPng(width, height) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (x + y) % 2 === 0 ? 255 : 0;
      const base = (y * width + x) * 3;
      pixels[base] = value;
      pixels[base + 1] = value;
      pixels[base + 2] = value;
    }
  }
  return encodePng({ width, height, pixels });
}

test("the qwen-image graph wires the installed models and a retrievable output", () => {
  const workflow = buildQwenImageWorkflow({ prompt: "deep space nebula, violet haze", seed: 42, width: 1024, height: 1536 });
  assert.deepEqual(validateWorkflow(workflow), []);
  const classes = Object.values(workflow).map((node) => node.class_type);
  assert.deepEqual(classes, [
    "UNETLoader", "CLIPLoader", "VAELoader", "CLIPTextEncode", "CLIPTextEncode",
    "EmptySD3LatentImage", "KSampler", "VAEDecode", "SaveImage",
  ]);
  assert.equal(workflow["1"].inputs.unet_name, QWEN_IMAGE_DEFAULTS.unet);
  assert.equal(workflow["2"].inputs.type, "qwen_image");
  assert.equal(workflow["3"].inputs.vae_name, QWEN_IMAGE_DEFAULTS.vae);
  assert.equal(workflow["6"].inputs.width, 1024);
  assert.equal(workflow["6"].inputs.height, 1536);
  assert.equal(workflow["7"].inputs.seed, 42);
  assert.equal(workflow["7"].inputs.steps, QWEN_IMAGE_DEFAULTS.steps);
  assert.equal(workflow["9"].inputs.filename_prefix, "vft/wallpaper");
});

test("a prompt is mandatory and sizes come from the preset table", () => {
  assert.throws(() => buildQwenImageWorkflow({ prompt: "  " }), /prompt is required/);
  const desktop = buildQwenImageWorkflow({ prompt: "x", width: WALLPAPER_SIZES.desktop.width, height: WALLPAPER_SIZES.desktop.height });
  assert.equal(desktop["6"].inputs.width, 2048);
  assert.equal(desktop["6"].inputs.height, 1280);
});

test("graph validation catches dangling references and missing outputs", () => {
  const workflow = buildQwenImageWorkflow({ prompt: "x" });
  delete workflow["9"];
  assert.ok(validateWorkflow(workflow).some((issue) => issue.includes("SaveImage")));

  const broken = buildQwenImageWorkflow({ prompt: "x" });
  broken["8"].inputs.samples = ["99", 0];
  assert.ok(validateWorkflow(broken).some((issue) => issue.includes("missing node 99")));
});

test("the ComfyUI client drives submit → poll → download with injected fetch", async () => {
  const calls = [];
  const png = solidPng(4, 4, [10, 20, 30]);
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET" });
    if (url.endsWith("/system_stats")) return { ok: true };
    if (url.endsWith("/prompt")) {
      assert.equal(JSON.parse(init.body).prompt["9"].class_type, "SaveImage");
      return { ok: true, json: async () => ({ prompt_id: "pid-1" }) };
    }
    if (url.includes("/history/pid-1")) {
      return {
        ok: true,
        json: async () => ({
          "pid-1": { status: { status_str: "success" }, outputs: { "9": { images: [{ filename: "vft_0001.png", subfolder: "vft", type: "output" }] } } },
        }),
      };
    }
    if (url.includes("/view?")) return { ok: true, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
    throw new Error(`unexpected url ${url}`);
  };
  const client = createComfyClient({ baseUrl: "http://127.0.0.1:8188", fetchImpl, sleep: async () => {} });
  assert.equal(await client.ping(), true);
  const promptId = await client.submit(buildQwenImageWorkflow({ prompt: "x" }));
  assert.equal(promptId, "pid-1");
  const { images } = await client.wait(promptId, { timeoutMs: 5_000, intervalMs: 1 });
  assert.equal(images[0].filename, "vft_0001.png");
  const buffer = await client.download(images[0]);
  assert.ok(buffer.equals(png));
  assert.ok(calls.some((call) => call.method === "POST"));
});

test("an execution error surfaces instead of hanging", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/system_stats")) return { ok: true };
    return {
      ok: true,
      json: async () => ({
        "pid-2": { status: { status_str: "error", messages: [["execution_error", { exception_message: "CUDA out of memory" }]] }, outputs: {} },
      }),
    };
  };
  const client = createComfyClient({ baseUrl: "http://127.0.0.1:8188", fetchImpl, sleep: async () => {} });
  await assert.rejects(() => client.wait("pid-2", { timeoutMs: 1_000, intervalMs: 1 }), /CUDA out of memory/);
});

test("an unreachable ComfyUI reports via ping rather than throwing", async () => {
  const client = createComfyClient({ baseUrl: "http://127.0.0.1:1", fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  assert.equal(await client.ping(), false);
});

test("flat art scores no interference and busy art scores badly", () => {
  const flat = imageStats(solidPng(64, 64, [120, 120, 130]));
  assert.equal(flat.stdLuma, 0);
  assert.equal(flat.edgeEnergy, 0);

  const busy = imageStats(checkerPng(64, 64));
  assert.ok(busy.stdLuma > 0.4, `stdLuma ${busy.stdLuma}`);
  assert.ok(busy.edgeEnergy > 0.5, `edge ${busy.edgeEnergy}`);
});

test("PNG decoding refuses what it cannot read honestly", () => {
  assert.throws(() => decodePng(Buffer.from("not a png")), /not a PNG/);
  const png = solidPng(2, 2, [0, 0, 0]);
  const image = decodePng(png);
  assert.deepEqual([image.width, image.height, image.channels], [2, 2, 3]);
});