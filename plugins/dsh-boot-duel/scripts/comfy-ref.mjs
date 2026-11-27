/**
 * ComfyUI reference frames for the boot-duel art pass.
 *
 * The duel's own art is Canvas 2D in code; this script is NOT part of the
 * bundle. It generates REFERENCE frames — a keyframe per attack pose — on the
 * operator's ComfyUI server, so the hand-coded poses can be judged against
 * something that looks like a film rather than against another hand-coded pose.
 *
 * THE GRAPH IS THE OPERATOR'S OWN SAVED WORKFLOW, PORTED TO THE API.
 *
 * The first attempt hand-built a local Qwen-Image Turbo graph from the model
 * list and produced noise. The server had the answer all along:
 * `WeFlow-01-文生图(Qwen2.1-Turbo).json` is a working text-to-image workflow,
 * and its subgraph is a local Qwen-Image 2.1 Turbo pipeline with one crucial
 * detail — a TURBO-SPECIFIC EIGHT-STEP SCHEDULE fed through `ManualSigmas`.
 * The signmas are copied verbatim below; they are what turns noise into an
 * image at eight steps. The other difference from the broken attempt: the text
 * encoder is `qwen3vl_8b_w4a8`, not the `qwen3.5_9b` PE that belongs to a
 * different stage.
 *
 * What is NOT ported: the workflow's prompt-rewriter (`TextGenerate` +
 * `PrimitiveStringMultiline` + `ComfySwitchNode`). That pass asks a language
 * model to rewrite a short request into a five-hundred-word English scene
 * description. For a stick-figure reference frame the literal instruction is
 * the point, so prompts here are written as the final description directly and
 * go straight into `TextEncodeQwenImage21`.
 *
 * Configuration comes from the environment, never from the repo:
 *
 *   COMFYUI_URL          https://cfui.cpolar.top
 *   COMFYUI_AUTH_HEADER  Authorization
 *   COMFYUI_AUTH_SCHEME  Basic
 *   COMFYUI_AUTH_TOKEN   <base64 user:pass>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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
  const res = await fetch(`${BASE}${route}`, {
    ...init,
    headers: { ...auth(), ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${route} -> ${res.status} ${await res.text().catch(() => '')}`)
  return res
}

/** Poll a queued job to completion and return its output images. */
async function waitFor(promptId, { timeoutMs = 300000, everyMs = 2000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const hist = await (await api(`/history/${promptId}`)).json()
    const entry = hist[promptId]
    /**
     * A FAILED JOB IS NOT A PENDING ONE. ComfyUI leaves an entry in `/history`
     * with `status_str: 'error'` and no outputs; polling for outputs alone
     * sat here for the whole timeout while the job had already died. The
     * exception message is the only thing that explains a malformed graph.
     */
    if (entry?.status?.status_str === 'error') {
      const failure = (entry.status.messages ?? []).find(([kind]) => kind === 'execution_error')?.[1]
      throw new Error(`job ${promptId} failed:\n${failure?.exception_message ?? 'unknown error'}`)
    }
    if (entry?.outputs) {
      const files = []
      for (const node of Object.values(entry.outputs)) {
        for (const img of node.images ?? []) files.push(img)
      }
      if (files.length > 0) return files
    }
    const queue = await (await api('/queue')).json()
    const running = queue.queue_running?.some((job) => job[1] === promptId)
    const pending = queue.queue_pending?.some((job) => job[1] === promptId)
    if (!running && !pending) {
      const again = await (await api(`/history/${promptId}`)).json()
      if (again[promptId]?.outputs || again[promptId]?.status?.status_str === 'error') continue
      throw new Error(`job ${promptId} vanished from the queue without output`)
    }
    await new Promise((r) => setTimeout(r, everyMs))
  }
  throw new Error(`job ${promptId} timed out`)
}

async function run(graph, label) {
  const res = await api('/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: `boot-duel-${Date.now()}` }),
  })
  const { prompt_id: id } = await res.json()
  console.log(`[${label}] queued ${id}`)
  const images = await waitFor(id)
  console.log(`[${label}] done:`, images.map((i) => i.filename).join(', '))
  return images
}

/**
 * The eight-step schedule, copied verbatim from the saved workflow's
 * `ManualSigmas`. This is the single value that made the difference between
 * an image and a field of noise: the distilled turbo checkpoint expects this
 * exact descent, and a stock `simple`/`euler` schedule at eight steps never
 * gets out of the high-frequency region.
 */
const TURBO_SIGMAS = '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0'

/**
 * The local Qwen-Image 2.1 Turbo graph, ported node for node.
 *
 * `TextEncodeQwenImage21` returns `[positive, negative]` from one node — hence
 * the two conditioning slots on the guider. `QwenImage21Cache` sits between the
 * model and the guider. Sampling is `SamplerCustomAdvanced` (not the plain
 * KSampler) because the schedule is supplied as raw sigmas.
 */
function turboGraph(prompt, negative, { width = 1280, height = 720, seed = 1 } = {}) {
  return {
    '1': { class_type: 'UNETLoader', inputs: {
      unet_name: 'qwen_image_2.1_turbo_int8_convrot.safetensors', weight_dtype: 'default',
    } },
    '2': { class_type: 'CLIPLoader', inputs: {
      clip_name: 'qwen3vl_8b_w4a8.safetensors', type: 'qwen_image', device: 'default',
    } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    '4': { class_type: 'TextEncodeQwenImage21', inputs: {
      clip: ['2', 0], prompt, negative_prompt: negative, resolution: 1024,
    } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '6': { class_type: 'QwenImage21Cache', inputs: { model: ['1', 0], device: 'auto', dtype: 'default' } },
    '7': { class_type: 'CFGGuider', inputs: {
      model: ['6', 0], positive: ['4', 0], negative: ['4', 1], cfg: 1,
    } },
    '8': { class_type: 'RandomNoise', inputs: { noise_seed: seed, control_after_generate: 'randomize' } },
    '9': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '10': { class_type: 'ManualSigmas', inputs: { sigmas: TURBO_SIGMAS } },
    '11': { class_type: 'SamplerCustomAdvanced', inputs: {
      noise: ['8', 0], guider: ['7', 0], sampler: ['9', 0], sigmas: ['10', 0], latent_image: ['5', 0],
    } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    '13': { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'boot-duel-ref' } },
  }
}

const STYLE = 'A minimal 2D stick-figure fighting-animation still, on a plain white background. ' +
  'Two pure-black stick figures with thin even line weight, round joints and round heads, ' +
  'no shading, no gradient, no colour, no text, no border, side-on fixed camera, full bodies in frame.'
const NEGATIVE = 'colour, faces, realistic, 3D, shading, gradient, background detail, text, watermark, ' +
  'extra limbs, distortion, blur, low contrast'

/** The keyframes that matter: the moves that were missing an identity. */
export const POSES = [
  { id: 'upper', desc: 'A rising uppercut landing: the black figure explodes up out of a deep crouch and the uppercut carries the white opponent clean off the floor, head thrown back, limbs splayed, an impact ring at the fist.' },
  { id: 'tornado', desc: 'A spinning kick: the black figure sweeps around on one leg at high speed with three concentric rings of afterimages, and the white opponent is caught at the waist and thrown backwards.' },
  { id: 'airX', desc: 'An airborne X-collision: the two figures meet in the air with crossing kicks, a ring-shaped shockwave bursting between their feet, speed lines radiating out from the collision point.' },
  { id: 'chair', desc: 'A workdesk riot finisher: the black figure swings an office chair in a wide arc and the white opponent is thrown back, with chair splinters, a keyboard and a monitor flying through the air.' },
]

const only = process.argv.includes('--pose')
  ? process.argv[process.argv.indexOf('--pose') + 1]
  : null

const outDir = path.join(root, 'test', 'e2e', 'comfy')
mkdirSync(outDir, { recursive: true })

for (const [i, pose] of POSES.entries()) {
  if (only && pose.id !== only) continue
  const prompt = `${STYLE} ${pose.desc} Frozen at the instant of impact, with smears and speed lines, heavy contact.`
  const images = await run(turboGraph(prompt, NEGATIVE, { seed: 1000 + i }), pose.id)
  writeFileSync(path.join(outDir, `${pose.id}.json`), JSON.stringify({ prompt, negative: NEGATIVE, images }, null, 2))
}
console.log('served previews are in the ComfyUI output folder; job records in', outDir)