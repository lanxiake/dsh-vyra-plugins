/**
 * 侠客版概念图 —— image-to-image from the game's own frames.
 *
 * The player asked for a more wuxia hero silhouette, and for the change to be
 * small. So this does NOT invent a new art style: it feeds the game's own
 * screenshot into the operator's saved image-to-image workflow and asks only
 * for the character silhouette and the energy effects to change, keeping the
 * stage, the two-tone look and the composition exactly as they are.
 *
 * Both graphs come from the operator's saved workflows
 * (`WeFlow-02-图生图(Qwen2.1-Turbo).json`), ported to the API form:
 *
 *   - the reference still is encoded through `TextEncodeQwenImage21`'s image
 *     slots and the prompt addresses it as `image_1`;
 *   - the latent is built with `VAEEncode` from the reference, so the output
 *     keeps its layout instead of re-composing it;
 *   - the same turbo eight-step schedule as text-to-image.
 *
 * Usage:
 *   node scripts/comfy-hero.mjs <input.png> <outName> "<change request>"
 *
 * Configuration (never from the repo):
 *   COMFYUI_URL, COMFYUI_AUTH_HEADER, COMFYUI_AUTH_SCHEME, COMFYUI_AUTH_TOKEN
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const BASE = process.env.COMFYUI_URL?.replace(/\/+$/, '')
const HEADER = process.env.COMFYUI_AUTH_HEADER
const SCHEME = process.env.COMFYUI_AUTH_SCHEME
const TOKEN = process.env.COMFYUI_AUTH_TOKEN

function auth() {
  if (!SCHEME || !TOKEN) return {}
  return { [HEADER ?? 'Authorization']: `${SCHEME} ${TOKEN}` }
}

async function api(route, init = {}) {
  if (!BASE) throw new Error('COMFYUI_URL is not set')
  const res = await fetch(`${BASE}${route}`, { ...init, headers: { ...auth(), ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${route} -> ${res.status} ${await res.text().catch(() => '')}`)
  return res
}

/** Upload a local file into ComfyUI's input folder; returns the server name. */
async function upload(file) {
  const form = new FormData()
  form.append('image', new Blob([readFileSync(file)], { type: 'image/png' }), path.basename(file))
  form.append('overwrite', 'true')
  const res = await api('/upload/image', { method: 'POST', body: form })
  const { name } = await res.json()
  return name
}

async function waitFor(promptId, { timeoutMs = 300000, everyMs = 2000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const hist = await (await api(`/history/${promptId}`)).json()
    const entry = hist[promptId]
    if (entry?.status?.status_str === 'error') {
      const failure = (entry.status.messages ?? []).find(([kind]) => kind === 'execution_error')?.[1]
      throw new Error(`job ${promptId} failed:\n${failure?.exception_message ?? 'unknown error'}`)
    }
    const files = []
    for (const node of Object.values(entry?.outputs ?? {})) {
      for (const img of node.images ?? []) files.push(img)
    }
    if (files.length > 0) return files
    const queue = await (await api('/queue')).json()
    const alive = [...(queue.queue_running ?? []), ...(queue.queue_pending ?? [])].some((job) => job[1] === promptId)
    if (!alive) {
      const again = await (await api(`/history/${promptId}`)).json()
      if (again[promptId]?.outputs || again[promptId]?.status?.status_str === 'error') continue
      throw new Error(`job ${promptId} vanished from the queue without output`)
    }
    await new Promise((r) => setTimeout(r, everyMs))
  }
  throw new Error(`job ${promptId} timed out`)
}

/** Run a graph and download its output into `test/e2e/comfy/`. */
async function run(graph, label) {
  const res = await api('/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: `boot-duel-${Date.now()}` }),
  })
  const { prompt_id: id } = await res.json()
  console.log(`[${label}] queued ${id}`)
  const [file] = await waitFor(id)
  const out = path.join(root, 'test', 'e2e', 'comfy', `${label}.png`)
  mkdirSync(path.dirname(out), { recursive: true })
  const png = await api(`/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder ?? '')}&type=${file.type}`)
  writeFileSync(out, Buffer.from(await png.arrayBuffer()))
  console.log(`[${label}] wrote ${out}`)
  return out
}

const TURBO_SIGMAS = '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0'

/**
 * Image-to-image through the saved workflow's own shape.
 *
 * `refImage` is the uploaded still. It is encoded INTO the conditioning as
 * `image_1` (the prompt may name it), and its VAE latent becomes the base the
 * sampler starts from — which is what keeps the office, the framing and the
 * two-tone palette while the character and the effects change.
 */
function i2iGraph(refImage, prompt, negative, { seed = 1, cfg = 1 } = {}) {
  return {
    '1': { class_type: 'UNETLoader', inputs: {
      unet_name: 'qwen_image_2.1_turbo_int8_convrot.safetensors', weight_dtype: 'default',
    } },
    '2': { class_type: 'CLIPLoader', inputs: {
      clip_name: 'qwen3vl_8b_w4a8.safetensors', type: 'qwen_image', device: 'default',
    } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    '4': { class_type: 'LoadImage', inputs: { image: refImage } },
    /** The reference latent: what the sampler refines instead of pure noise. */
    '5': { class_type: 'VAEEncode', inputs: { pixels: ['4', 0], vae: ['3', 0] } },
    '6': { class_type: 'TextEncodeQwenImage21', inputs: {
      clip: ['2', 0],
      prompt,
      negative_prompt: negative,
      resolution: 0,
      vae: ['3', 0],
      // `images` is a COMFY_AUTOGROW input: the slots are addressed as
      // `images.image_1`, `images.image_2`, … — passing a bare `image_1`
      // is what the first attempt did and the node answered
      // "unexpected keyword argument 'image_1'".
      'images.image_1': ['4', 0],
    } },
    '7': { class_type: 'QwenImage21Cache', inputs: { model: ['1', 0], device: 'auto', dtype: 'default' } },
    '8': { class_type: 'CFGGuider', inputs: {
      model: ['7', 0], positive: ['6', 0], negative: ['6', 1], cfg,
    } },
    '9': { class_type: 'RandomNoise', inputs: { noise_seed: seed, control_after_generate: 'randomize' } },
    '10': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '11': { class_type: 'ManualSigmas', inputs: { sigmas: TURBO_SIGMAS } },
    '12': { class_type: 'SamplerCustomAdvanced', inputs: {
      noise: ['9', 0], guider: ['8', 0], sampler: ['10', 0], sigmas: ['11', 0], latent_image: ['5', 0],
    } },
    '13': { class_type: 'VAEDecode', inputs: { samples: ['12', 0], vae: ['3', 0] } },
    '14': { class_type: 'SaveImage', inputs: { images: ['13', 0], filename_prefix: 'boot-duel-hero' } },
  }
}

const [input, name, ...rest] = process.argv.slice(2)
if (!input || !name) {
  console.error('usage: node scripts/comfy-hero.mjs <input.png> <outName> "<change request>"')
  process.exit(1)
}
const request = rest.join(' ') || 'Make the two fighters look like wuxia swordsmen and make the impact effects cooler, keeping the office stage unchanged.'

/**
 * The prompt states what must NOT change first, then the change, then the
 * effect language. This ordering matters for an edit: the model follows the
 * earliest constraint most strongly.
 */
const PROMPT = `Edit image_1. Keep everything in image_1 unchanged: the pale office stage, the desks, the window wall, the clock, the flat two-tone look, the plain white background of the figures, the composition and the camera.
${request}
The two fighters become lean wuxia swordsmen silhouettes: the same black-and-white flat stick-figure bodies and thin even line weight, but with a small topknot (发髻) on each head and a slightly wider heroic stance. Their limbs stay thin lines with round joints and round heads; no facial features, no shading, no colour. NO sash, NO ribbon, NO cloth and NO tail of any kind at the waist or behind the body — the silhouette below the shoulders is just the two legs.
Energy effects in the wuxia idiom: at the fist and foot a slim white qi streak, at the point of contact a short circular shockwave ring, faint wind lines like air cut by the blow, and a soft translucent afterimage behind the striking limb. Keep the characters clearly visible and unobstructed by the effects.
Clean flat line art, plain white background behind the figures, no text, no watermark.`

const NEGATIVE = 'realistic, 3D, photoreal, colour, faces, eyes, clothing details, armour, weapons, ' +
  'sash, ribbon, flowing cloth, tail, animal tail, cape, scarf, ' +
  'shading, gradient, busy background, extra limbs, distorted body, blurry, watermark, text'

const uploaded = await upload(input)
console.log(`uploaded ${path.basename(input)} -> ${uploaded}`)
const out = await run(i2iGraph(uploaded, PROMPT, NEGATIVE, { seed: 7 }), name)
writeFileSync(path.join(root, 'test', 'e2e', 'comfy', `${name}.json`), JSON.stringify({ input, request, prompt: PROMPT, negative: NEGATIVE, out }, null, 2))