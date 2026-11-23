/**
 * ComfyUI workflow templates for wallpaper generation (pure builders).
 *
 * These are API-format graphs (`{ "1": { class_type, inputs } }`) shaped for the
 * models actually installed on this machine: Qwen-Image 2.1 (16-channel latents,
 * `EmptySD3LatentImage`) with its own VAE and a Qwen3.5 text encoder. Node class
 * names are ComfyUI core nodes, so no custom-node pack is required to run them.
 *
 * The graph is data, so it can be unit-tested without a GPU: every default below
 * is a decision (which model, which latent node, which sampler) that would be
 * invisible if it lived inline in the CLI.
 */

export const QWEN_IMAGE_DEFAULTS = Object.freeze({
  unet: "qwen_image_2.1_turbo_int8_convrot.safetensors",
  clip: "qwen3.5_9b_qwen_image_2.1_pe_t2i_w4a8.safetensors",
  vae: "qwen_image_2.1_vae_bf16.safetensors",
  steps: 4,
  cfg: 1,
  sampler: "euler",
  scheduler: "simple",
});

/** Wallpaper shapes: the theme is used behind panels, so a portrait canvas wins. */
export const WALLPAPER_SIZES = Object.freeze({
  desktop: { width: 2048, height: 1280 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 },
});

/**
 * @param {{prompt: string, negative?: string, width?: number, height?: number,
 *          seed?: number, steps?: number, cfg?: number, sampler?: string,
 *          scheduler?: string, unet?: string, clip?: string, vae?: string,
 *          filenamePrefix?: string}} options
 */
export function buildQwenImageWorkflow(options) {
  const {
    prompt,
    negative = "",
    width = WALLPAPER_SIZES.portrait.width,
    height = WALLPAPER_SIZES.portrait.height,
    seed = 1,
    steps = QWEN_IMAGE_DEFAULTS.steps,
    cfg = QWEN_IMAGE_DEFAULTS.cfg,
    sampler = QWEN_IMAGE_DEFAULTS.sampler,
    scheduler = QWEN_IMAGE_DEFAULTS.scheduler,
    unet = QWEN_IMAGE_DEFAULTS.unet,
    clip = QWEN_IMAGE_DEFAULTS.clip,
    vae = QWEN_IMAGE_DEFAULTS.vae,
    filenamePrefix = "vft/wallpaper",
  } = options;
  if (typeof prompt !== "string" || prompt.trim().length === 0) throw new Error("prompt is required");
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: clip, type: "qwen_image" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "6": { class_type: "EmptySD3LatentImage", inputs: { width, height, batch_size: 1 } },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["6", 0],
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1,
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 0] } },
    "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: filenamePrefix } },
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
  return issues;
}