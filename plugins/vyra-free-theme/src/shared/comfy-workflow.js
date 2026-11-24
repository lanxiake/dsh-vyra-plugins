/**
 * ComfyUI workflow templates for wallpaper generation (pure builders).
 *
 * The graph below is the *working* Qwen-Image 2.1 turbo pipeline for the
 * checkpoints installed on this machine. It is deliberately not the obvious
 * "UNETLoader + CLIPTextEncode + KSampler" graph: that one runs, reports success
 * and produces mosaic noise, because this turbo checkpoint ships no usable
 * default noise schedule and its text encoder is a 4096-dimension Qwen3-VL, not
 * the 3584-dimension Qwen2.5-VL that a plain CLIPTextEncode would feed it.
 *
 * What makes it correct, and what a re-implementation keeps getting wrong:
 *
 *   1. Text encoder. `qwen3vl_8b_*` (4096 dim) with CLIPLoader type
 *      `qwen_image`. `qwen3.5_9b_*_pe_t2i` is the *prompt enhancer* (an LLM that
 *      rewrites the prompt), not the conditioning encoder.
 *   2. Conditioning node. `TextEncodeQwenImage21` emits positive, negative and a
 *      latent shaped for the 2.1 architecture; a bare CLIPTextEncode does not.
 *   3. Noise schedule. `ManualSigmas` with the checkpoint's own descending list.
 *      Feeding KSampler's default schedule is what produces the mosaic.
 *   4. Sampling. `SamplerCustomAdvanced` + `CFGGuider` + `KSamplerSelect` +
 *      `RandomNoise`, with cfg 1 (the schedule already encodes guidance).
 *   5. `QwenImage21Cache` wraps the loaded model; the 2.1 graph expects it.
 *
 * Evidence from this machine, same prompt and seed, 1024x640: edge energy 0.019
 * and mean neighbour delta 4.95 with the naive graph (visible mosaic) versus
 * 0.003 / 0.69 with this one (smooth gradients).
 *
 * The graph is data, so it is unit-tested without a GPU.
 */

export const TURBO_SIGMAS = Object.freeze([
  1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0,
]);

export const QWEN_IMAGE_DEFAULTS = Object.freeze({
  unet: "qwen_image_2.1_turbo_int8_convrot.safetensors",
  clip: "qwen3vl_8b_w4a8.safetensors",
  vae: "qwen_image_2.1_vae_bf16.safetensors",
  sampler: "euler",
  cfg: 1,
  /** Bucket hint the 2.1 encoder wants; 1024 is the native conditioning size. */
  resolution: 1024,
  sigmas: TURBO_SIGMAS.join(", "),
});

/** Wallpaper shapes: a theme is used behind panels, so 16:10 and portrait both ship. */
export const WALLPAPER_SIZES = Object.freeze({
  desktop: { width: 2048, height: 1280 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 },
});

/**
 * @param {{prompt: string, negative?: string, width?: number, height?: number,
 *          seed?: number, cfg?: number, sampler?: string, resolution?: number,
 *          sigmas?: string, unet?: string, clip?: string, vae?: string,
 *          filenamePrefix?: string}} options
 */
export function buildQwenImageWorkflow(options) {
  const {
    prompt,
    negative = "",
    width = WALLPAPER_SIZES.desktop.width,
    height = WALLPAPER_SIZES.desktop.height,
    seed = 1,
    cfg = QWEN_IMAGE_DEFAULTS.cfg,
    sampler = QWEN_IMAGE_DEFAULTS.sampler,
    resolution = QWEN_IMAGE_DEFAULTS.resolution,
    sigmas = QWEN_IMAGE_DEFAULTS.sigmas,
    unet = QWEN_IMAGE_DEFAULTS.unet,
    clip = QWEN_IMAGE_DEFAULTS.clip,
    vae = QWEN_IMAGE_DEFAULTS.vae,
    filenamePrefix = "vft/wallpaper",
  } = options;
  if (typeof prompt !== "string" || prompt.trim().length === 0) throw new Error("prompt is required");
  if (typeof sigmas !== "string" || sigmas.trim().length === 0) throw new Error("sigmas is required");
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: clip, type: "qwen_image", device: "default" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
    "4": {
      class_type: "TextEncodeQwenImage21",
      inputs: { clip: ["2", 0], prompt, negative_prompt: negative, resolution },
    },
    "5": { class_type: "QwenImage21Cache", inputs: { model: ["1", 0], device: "auto", dtype: "default" } },
    "6": { class_type: "CFGGuider", inputs: { model: ["5", 0], positive: ["4", 0], negative: ["4", 1], cfg } },
    "7": { class_type: "KSamplerSelect", inputs: { sampler_name: sampler } },
    "8": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "9": { class_type: "ManualSigmas", inputs: { sigmas } },
    "10": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["8", 0],
        guider: ["6", 0],
        sampler: ["7", 0],
        sigmas: ["9", 0],
        latent_image: ["10", 0],
      },
    },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    "13": { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: filenamePrefix } },
  };
}

/** Structural checks a graph must pass before it is worth sending to the GPU. */
export function validateWorkflow(workflow) {
  const issues = [];
  if (workflow === null || typeof workflow !== "object") return ["workflow must be an object"];
  const ids = Object.keys(workflow);
  if (ids.length === 0) return ["workflow is empty"];
  for (const [id, node] of Object.entries(workflow)) {
    if (typeof node?.class_type !== "string") issues.push(`node ${id}: missing class_type`);
    if (node?.inputs === undefined || typeof node.inputs !== "object") issues.push(`node ${id}: missing inputs`);
  }
  const outputs = ids.filter((id) => workflow[id].class_type === "SaveImage");
  if (outputs.length === 0) issues.push("no SaveImage node: the run would produce nothing retrievable");
  for (const [id, node] of Object.entries(workflow)) {
    for (const [key, value] of Object.entries(node.inputs ?? {})) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string") {
        if (workflow[value[0]] === undefined) issues.push(`node ${id}.${key} references missing node ${value[0]}`);
      }
    }
  }
  // The two mistakes that produce mosaic rather than an error, caught here:
  const types = Object.values(workflow).map((node) => node.class_type);
  if (!types.includes("ManualSigmas")) issues.push("no ManualSigmas: the turbo checkpoint needs its own schedule or it renders mosaic noise");
  if (!types.includes("TextEncodeQwenImage21")) issues.push("no TextEncodeQwenImage21: a plain CLIPTextEncode does not fit the 2.1 text encoder");
  return issues;
}
