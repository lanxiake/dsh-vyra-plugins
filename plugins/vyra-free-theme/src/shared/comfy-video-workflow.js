/**
 * HunyuanVideo 1.5 image-to-video builder (pure): the graph that turns a still
 * wallpaper into a moving one.
 *
 * This is the 720p i2v path from the checkpoint's own template, reduced to what
 * an ambient wallpaper needs. The decisions that matter, because each wrong one
 * fails quietly rather than loudly:
 *
 *   1. Conditioning. `HunyuanVideo15ImageToVideo` produces positive, negative
 *      *and* the latent in one node — it is what binds the start image to the
 *      first frame. Sampling a plain EmptyLatent would ignore the picture.
 *   2. Two encoders. `DualCLIPLoader` with type `hunyuan_video_15` (Qwen2.5-VL
 *      plus byt5 glyph); a single CLIPLoader loads but conditions badly.
 *   3. Start image also goes through CLIP Vision. Without it the clip drifts
 *      away from the still instead of continuing it.
 *   4. `ModelSamplingSD3` shift 7 for this checkpoint. Leave it out and the
 *      result is washed out and barely moves.
 *   5. The cfg-distilled checkpoint runs at cfg 1: it has no classifier-free
 *      guidance to strengthen, so cfg > 1 only burns time.
 */

export const HUNYUAN_I2V_DEFAULTS = Object.freeze({
  unet: "hunyuanvideo1.5_720p_i2v_cfg_distilled_fp8_scaled.safetensors",
  clip: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
  clipGlyph: "byt5_small_glyphxl_fp16.safetensors",
  clipVision: "sigclip_vision_patch14_384.safetensors",
  vae: "hunyuanvideo15_vae_fp16.safetensors",
  width: 1280,
  height: 720,
  fps: 24,
  steps: 20,
  shift: 7,
  cfg: 1,
  sampler: "euler",
  scheduler: "simple",
});

/** Frame count for a clip length. HunyuanVideo 1.5 works in 4n+1 frames. */
export function framesForSeconds(seconds, fps = HUNYUAN_I2V_DEFAULTS.fps) {
  const wanted = Math.max(1, Math.round(seconds * fps));
  return Math.max(5, Math.round((wanted - 1) / 4) * 4 + 1);
}

/**
 * @param {{image: string, prompt?: string, negative?: string, width?: number,
 *          height?: number, seconds?: number, frames?: number, fps?: number,
 *          seed?: number, steps?: number, shift?: number, cfg?: number,
 *          sampler?: string, scheduler?: string, unet?: string, clip?: string,
 *          clipGlyph?: string, clipVision?: string, vae?: string,
 *          filenamePrefix?: string}} options
 */
export function buildHunyuanI2VWorkflow(options) {
  const {
    image,
    prompt = "The scene breathes slowly: soft light drifts, gradients bloom and fade, gentle organic motion. Fixed camera, no cuts.",
    negative = "static, frozen, sudden motion, jump cut, shaking, text, watermark, people",
    width = HUNYUAN_I2V_DEFAULTS.width,
    height = HUNYUAN_I2V_DEFAULTS.height,
    seconds = 2,
    fps = HUNYUAN_I2V_DEFAULTS.fps,
    seed = 1,
    steps = HUNYUAN_I2V_DEFAULTS.steps,
    shift = HUNYUAN_I2V_DEFAULTS.shift,
    cfg = HUNYUAN_I2V_DEFAULTS.cfg,
    sampler = HUNYUAN_I2V_DEFAULTS.sampler,
    scheduler = HUNYUAN_I2V_DEFAULTS.scheduler,
    unet = HUNYUAN_I2V_DEFAULTS.unet,
    clip = HUNYUAN_I2V_DEFAULTS.clip,
    clipGlyph = HUNYUAN_I2V_DEFAULTS.clipGlyph,
    clipVision = HUNYUAN_I2V_DEFAULTS.clipVision,
    vae = HUNYUAN_I2V_DEFAULTS.vae,
    filenamePrefix = "vft/video",
  } = options;
  if (typeof image !== "string" || image.trim().length === 0) throw new Error("image is required");
  const length = options.frames ?? framesForSeconds(seconds, fps);
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
    "2": {
      class_type: "DualCLIPLoader",
      inputs: { clip_name1: clip, clip_name2: clipGlyph, type: "hunyuan_video_15", device: "default" },
    },
    "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
    "4": { class_type: "CLIPVisionLoader", inputs: { clip_name: clipVision } },
    "5": { class_type: "LoadImage", inputs: { image } },
    "6": { class_type: "CLIPVisionEncode", inputs: { clip_vision: ["4", 0], image: ["5", 0], crop: "center" } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "8": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "9": {
      class_type: "HunyuanVideo15ImageToVideo",
      inputs: {
        positive: ["7", 0],
        negative: ["8", 0],
        vae: ["3", 0],
        start_image: ["5", 0],
        clip_vision_output: ["6", 0],
        width,
        height,
        length,
        batch_size: 1,
      },
    },
    "10": { class_type: "ModelSamplingSD3", inputs: { model: ["1", 0], shift } },
    "11": { class_type: "BasicScheduler", inputs: { model: ["10", 0], scheduler, steps, denoise: 1 } },
    "12": { class_type: "KSamplerSelect", inputs: { sampler_name: sampler } },
    "13": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "14": { class_type: "CFGGuider", inputs: { model: ["10", 0], positive: ["9", 0], negative: ["9", 1], cfg } },
    "15": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["13", 0],
        guider: ["14", 0],
        sampler: ["12", 0],
        sigmas: ["11", 0],
        latent_image: ["9", 2],
      },
    },
    "16": { class_type: "VAEDecode", inputs: { samples: ["15", 0], vae: ["3", 0] } },
    "17": { class_type: "CreateVideo", inputs: { images: ["16", 0], fps } },
    "18": { class_type: "SaveVideo", inputs: { video: ["17", 0], filename_prefix: filenamePrefix, format: "auto", codec: "h264" } },
  };
}

/** Structural checks specific to the image-to-video graph. */
export function validateVideoWorkflow(workflow) {
  const issues = [];
  if (workflow === null || typeof workflow !== "object") return ["workflow must be an object"];
  const types = Object.values(workflow).map((node) => node?.class_type);
  if (!types.includes("HunyuanVideo15ImageToVideo")) issues.push("no HunyuanVideo15ImageToVideo: the start image would be ignored");
  if (!types.includes("LoadImage")) issues.push("no LoadImage: nothing to animate");
  if (!types.includes("CLIPVisionEncode")) issues.push("no CLIPVisionEncode: the clip drifts away from the still");
  if (!types.includes("ModelSamplingSD3")) issues.push("no ModelSamplingSD3: this checkpoint renders washed out without its shift");
  if (!types.includes("SaveVideo")) issues.push("no SaveVideo: the run would produce no clip");
  const video = Object.values(workflow).find((node) => node?.class_type === "SaveVideo");
  const length = Object.values(workflow).find((node) => node?.class_type === "HunyuanVideo15ImageToVideo")?.inputs?.length;
  if (typeof length === "number" && (length - 1) % 4 !== 0) issues.push(`length ${length} is not 4n+1: HunyuanVideo 1.5 drops the remainder`);
  if (video !== undefined && workflow[video.inputs.video?.[0]] === undefined) issues.push("SaveVideo references a missing node");
  return issues;
}