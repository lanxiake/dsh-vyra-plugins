/**
 * Code-generated video wallpapers (Host side).
 *
 * Renders N frames of a procedural recipe and encodes them with ffmpeg into a
 * short, silent, faststart MP4 — the video channel of the wallpaper model. No
 * GPU, no model weights: the same recipes that produce stills produce motion,
 * because they take a `time` argument.
 *
 * ffmpeg is a hard dependency of this one operation. It is probed first so the
 * caller gets "ffmpeg not found" instead of a stack trace.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { renderArt } from "../shared/art-recipes.js";

const MAX_BYTES = 50 * 1024 * 1024;

export function hasFfmpeg(ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg") {
  const result = spawnSync(ffmpegPath, ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

/**
 * Render + encode one looping clip.
 *
 * @param {{recipe: string, width: number, height: number, seed?: number,
 *          tone?: "light"|"dark", frames?: number, fps?: number, crf?: number,
 *          output: string, posterPath?: string, ffmpegPath?: string}} options
 * @returns {{bytes: number, frames: number, fps: number, poster: Buffer}}
 */
export function renderArtVideo(options) {
  const {
    recipe,
    width,
    height,
    seed = 1,
    tone = "light",
    frames = 48,
    fps = 24,
    crf = 20,
    output,
    posterPath,
    ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg",
  } = options;
  const frameCount = Math.max(2, Math.min(240, Math.round(frames)));
  const frameRate = Math.max(1, Math.min(60, Math.round(fps)));
  const work = mkdtempSync(join(tmpdir(), "vft-anim-"));
  try {
    let poster = null;
    for (let index = 0; index < frameCount; index += 1) {
      const png = renderArt(recipe, { width, height, seed, tone, time: index / frameRate });
      if (index === 0) poster = png;
      writeFileSync(join(work, `frame-${String(index).padStart(4, "0")}.png`), png);
    }
    mkdirSync(dirname(output), { recursive: true });
    const result = spawnSync(ffmpegPath, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-framerate", String(frameRate),
      "-i", join(work, "frame-%04d.png"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", String(crf),
      "-movflags", "+faststart", "-an",
      output,
    ], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed: ${(result.stderr ?? "").slice(0, 400) || `exit ${result.status}`}`);
    }
    const bytes = readFileSync(output).byteLength;
    if (bytes > MAX_BYTES) throw new Error(`generated clip is ${Math.round(bytes / 1024 / 1024)}MB, over the 50MB wallpaper limit`);
    if (posterPath !== undefined) writeFileSync(posterPath, poster);
    return { bytes, frames: frameCount, fps: frameRate, poster };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}