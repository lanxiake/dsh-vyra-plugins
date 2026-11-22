/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— TTS provider

   Phase 1.1 只接 edge-tts；但接口按 provider 设计，native / breeze / command 后续补。
   两条硬约束：
     · 不开 shell：命令与参数是 argv 数组，`spawn(..., { shell: false })`。
     · 失败可见：403 / 0 字节 / 找不到命令都带可操作的说明，不拿静音文件冒充成功。
   ───────────────────────────────────────────────────────────────────────── */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { estimateSpeechSeconds } from './audio-rules.ts';

export const DEFAULT_EDGE_VOICE = 'zh-CN-XiaoxiaoNeural';
export const MIN_EDGE_TTS_VERSION = '7.3.1';

export interface TtsRequest {
  text: string;
  output: string;
  /** 自然语言语气指令；Breeze 用，edge / native 忽略。 */
  instruction?: string;
  signal?: AbortSignal;
}

export interface TtsResult {
  file: string;
  mime: string;
  durationMs: number;
  warnings: string[];
}

export interface TtsProvider {
  name: string;
  voice: string;
  /** 已内置到音频里的语速（如 `+20%`）；播放器据此显示「已内置 1.2×」。 */
  rate: string;
  /** 产物扩展名（edge: .mp3；native: .wav）。 */
  extension: string;
  /** 创建期告警（例如 edge-tts 版本过旧），由产物清单原样带出。 */
  warnings: string[];
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export interface TtsProviderOptions {
  provider?: 'edge' | 'native' | 'breeze' | string;
  voice?: string;
  rate?: string;
  /** edge-tts 可执行文件；默认 PATH 上的 `edge-tts`。 */
  command?: string;
  timeoutMs?: number;
  /** Breeze 本地模型路径（默认按本机 Lumii 部署填）。 */
  breezeRoot?: string;
  breezeModel?: string;
  /** Breeze FastAPI 地址；默认 http://127.0.0.1:7860。 */
  breezeApiUrl?: string;
  breezeInstruction?: string;
  breezeRefAudio?: string;
  breezeRefText?: string;
  breezeCfgScale?: number;
  breezeSeed?: number;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function runProcess(
  command: string,
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv; cwd?: string },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        shell: false,
        windowsHide: true,
        ...(options.env === undefined ? {} : { env: options.env }),
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };

    const onAbort = (): void => {
      child.kill();
      finish(new Error('TTS 已取消'));
    };

    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      child.kill();
      finish(new Error(`TTS 超时（${options.timeoutMs}ms）：${command}`));
    }, options.timeoutMs);

    child.stdout?.on('data', (chunk: Buffer | string) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk: Buffer | string) => { stderr += String(chunk); });
    child.on('error', (error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });
    child.on('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(`TTS 命令失败（退出码 ${code}）：${stderr.trim().slice(-2000)}`));
    });
  });
}

/** 用 ffprobe 读音频真实时长；读不到返回 null（调用方按文本估算并记 warning）。 */
export function probeDurationMs(file: string): number | null {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8', timeout: 15_000, windowsHide: true },
  );
  if (result.error || result.status !== 0) return null;
  const seconds = Number(String(result.stdout).trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds * 1000);
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readEdgeVersion(command: string): string | null {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8', timeout: 5_000, windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  const match = /(\d+\.\d+\.\d+)/.exec(String(result.stdout || result.stderr || ''));
  return match ? match[1] : null;
}

function edgeProvider(options: TtsProviderOptions): TtsProvider {
  const voice = options.voice?.trim() || DEFAULT_EDGE_VOICE;
  const rate = options.rate?.trim() || '+20%';
  const command = options.command?.trim() || 'edge-tts';
  const timeoutMs = options.timeoutMs ?? 180_000;
  const version = readEdgeVersion(command);
  const creationWarnings: string[] = [];
  if (version && compareVersions(version, MIN_EDGE_TTS_VERSION) < 0) {
    creationWarnings.push(
      `edge-tts ${version} 低于 ${MIN_EDGE_TTS_VERSION}，服务端可能返回 403；`
      + `建议 pip install -U "edge-tts>=${MIN_EDGE_TTS_VERSION}"，`
      + '或用 media.tts.command 指向新版可执行文件',
    );
  }

  return {
    name: 'edge-tts',
    voice,
    rate,
    extension: '.mp3',
    warnings: creationWarnings,
    async synthesize(request: TtsRequest): Promise<TtsResult> {
      const textFile = path.join(
        os.tmpdir(),
        `studymate-tts-${crypto.randomBytes(6).toString('hex')}.txt`,
      );
      fs.writeFileSync(textFile, request.text, 'utf8');
      try {
        const args = [
          '--voice', voice,
          '--rate', rate,
          '--file', textFile,
          '--write-media', request.output,
        ];
        try {
          await runProcess(command, args, { timeoutMs, signal: request.signal });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/403|WSServerHandshake|Invalid response status/i.test(message)) {
            throw new Error(
              `edge-tts 被服务端拒绝（403）：通常是版本过旧。请升级到 ${MIN_EDGE_TTS_VERSION}+，`
              + '或在配置 media.tts.command 里指向新版可执行文件。'
              + `原始错误：${message}`,
            );
          }
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(
              `找不到 ${command}：先安装 edge-tts（pip install "edge-tts>=${MIN_EDGE_TTS_VERSION}"），`
              + '或在配置 media.tts.command 里指向可执行文件。',
            );
          }
          throw error;
        }

        if (!fs.existsSync(request.output) || fs.statSync(request.output).size === 0) {
          throw new Error('edge-tts 没有产出音频文件（0 字节）；没有拿静音文件冒充成功。');
        }

        let durationMs = probeDurationMs(request.output);
        const warnings = [...creationWarnings];
        if (durationMs === null) {
          durationMs = Math.round(estimateSpeechSeconds(request.text) * 1000);
          warnings.push('ffprobe 读不到音频时长，chapter 时长按文本估算');
        }
        return { file: request.output, mime: 'audio/mpeg', durationMs, warnings };
      } finally {
        fs.rmSync(textFile, { force: true });
      }
    },
  };
}

function percentOf(rate: string): number {
  const match = /^([+-]?)(\d+)%$/.exec(rate.trim());
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * Number(match[2]);
}

function nativeProvider(options: TtsProviderOptions): TtsProvider {
  const platform = process.platform;
  const rate = options.rate?.trim() || '+20%';
  const percent = percentOf(rate);
  const defaultVoice = platform === 'win32'
    ? 'Microsoft Huihui Desktop'
    : platform === 'darwin' ? '' : 'zh';
  const voice = options.voice?.trim() || defaultVoice;
  const timeoutMs = options.timeoutMs ?? 300_000;
  const name = platform === 'win32'
    ? 'native-sapi'
    : platform === 'darwin' ? 'native-say' : 'native-espeak';
  const wpm = String(Math.round(175 * (1 + percent / 100)));
  const sapiRate = String(Math.max(-10, Math.min(10, Math.round(percent / 10))));

  return {
    name,
    voice,
    rate,
    extension: '.wav',
    warnings: [],
    async synthesize(request: TtsRequest): Promise<TtsResult> {
      const textFile = path.join(
        os.tmpdir(),
        `studymate-native-${crypto.randomBytes(6).toString('hex')}.txt`,
      );
      fs.writeFileSync(textFile, request.text, 'utf8');
      try {
        if (platform === 'win32') {
          const script = [
            'Add-Type -AssemblyName System.Speech;',
            '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
            'if ($env:SM_VOICE) { try { $s.SelectVoice($env:SM_VOICE) } catch {} };',
            '$s.Rate = [int]$env:SM_RATE;',
            '$s.SetOutputToWaveFile($env:SM_OUT);',
            '$text = [System.IO.File]::ReadAllText($env:SM_TEXT, [System.Text.Encoding]::UTF8);',
            '$s.Speak($text);',
            '$s.Dispose();',
          ].join(' ');
          await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
            timeoutMs,
            signal: request.signal,
            env: {
              ...process.env,
              SM_TEXT: textFile,
              SM_OUT: request.output,
              SM_VOICE: voice,
              SM_RATE: sapiRate,
            },
          });
        } else if (platform === 'darwin') {
          const args = [
            '-o', request.output,
            '--file-format=WAVE',
            '--data-format=LEI16@22050',
            '-r', wpm,
          ];
          if (voice) args.push('-v', voice);
          args.push('-f', textFile);
          await runProcess('say', args, { timeoutMs, signal: request.signal });
        } else {
          await runProcess(
            'espeak-ng',
            ['-v', voice || 'zh', '-s', wpm, '-w', request.output, '-f', textFile],
            { timeoutMs, signal: request.signal },
          );
        }

        if (!fs.existsSync(request.output) || fs.statSync(request.output).size === 0) {
          throw new Error('native TTS 没有产出音频文件（0 字节）');
        }
        let durationMs = probeDurationMs(request.output);
        const warnings: string[] = [];
        if (durationMs === null) {
          durationMs = Math.round(estimateSpeechSeconds(request.text) * 1000);
          warnings.push('ffprobe 读不到音频时长，chapter 时长按文本估算');
        }
        return { file: request.output, mime: 'audio/wav', durationMs, warnings };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const command = platform === 'win32'
            ? 'powershell.exe'
            : platform === 'darwin' ? 'say' : 'espeak-ng';
          throw new Error(`找不到 native TTS 命令 ${command}：检查系统语音组件或安装它。${message}`);
        }
        throw error;
      } finally {
        fs.rmSync(textFile, { force: true });
      }
    },
  };
}

function wavBuffer(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function portOf(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    return url.port || (url.protocol === 'https:' ? '443' : '80');
  } catch {
    return '7860';
  }
}

function breezeProvider(options: TtsProviderOptions): TtsProvider {
  const root = options.breezeRoot?.trim() || 'E:/ai/breeze-tts';
  const model = options.breezeModel?.trim() || 'E:/ai/breeze-tts-2';
  const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const apiUrl = (options.breezeApiUrl?.trim() || 'http://127.0.0.1:7860').replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 600_000;
  const instruction = options.breezeInstruction?.trim() || '';
  const voice = options.voice?.trim() || 'breeze-tts';
  // Breeze 的自然语速由模型决定；需要 1.2× 请在播放器里调相对倍速。
  const rate = '+0%';
  const creationWarnings = [
    'Breeze 使用本地 FastAPI 服务：首次加载约 4 分钟；自然语速，需要 1.2× 请在播放器里调',
    'Breeze 权重为非商业许可；商用需授权；克隆声音需本人同意',
  ];
  const startup = `cd "${root}" && "${python}" -m breeze_infer.api "${model}" --host 127.0.0.1 --port ${portOf(apiUrl)}`;

  return {
    name: 'breeze-api',
    voice,
    rate,
    extension: '.wav',
    warnings: creationWarnings,
    async synthesize(request: TtsRequest): Promise<TtsResult> {
      const form = new FormData();
      form.set('text', request.text);
      const sceneInstruction = request.instruction?.trim() || instruction;
      if (sceneInstruction) form.set('instruction', sceneInstruction);
      form.set('cfg_scale', String(options.breezeCfgScale ?? 1.0));
      form.set('seed', String(options.breezeSeed ?? 42));
      if (options.breezeRefAudio) {
        if (!options.breezeRefText) {
          throw new Error('Breeze 克隆模式需要 breezeRefText（参考音频的逐字稿）');
        }
        const buffer = fs.readFileSync(options.breezeRefAudio);
        form.set('ref_audio', new Blob([buffer]), path.basename(options.breezeRefAudio));
        form.set('ref_text', options.breezeRefText);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('Breeze API 超时')), timeoutMs);
      const onAbort = () => controller.abort(request.signal?.reason);
      if (request.signal) {
        if (request.signal.aborted) onAbort();
        else request.signal.addEventListener('abort', onAbort, { once: true });
      }

      let response: Response;
      try {
        response = await fetch(apiUrl + '/v1/audio/speech', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Breeze API 没在 ${apiUrl} 上（${message}）。先启动：\n${startup}`,
        );
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Breeze API ${response.status}：${detail.slice(0, 500)}`);
      }

      const pcm = Buffer.from(await response.arrayBuffer());
      if (pcm.length === 0) throw new Error('Breeze API 返回了空 PCM');
      const sampleRate = Number(response.headers.get('x-sample-rate') || 24_000);
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error(`Breeze API 返回了无效采样率：${sampleRate}`);
      }
      fs.writeFileSync(request.output, wavBuffer(pcm, sampleRate));

      let durationMs = probeDurationMs(request.output);
      const warnings = [...creationWarnings];
      if (durationMs === null) {
        durationMs = Math.round((pcm.length / 2 / sampleRate) * 1000);
        warnings.push('ffprobe 读不到音频时长，chapter 时长按 PCM 数据估算');
      }
      return { file: request.output, mime: 'audio/wav', durationMs, warnings };
    },
  };
}

export function createTtsProvider(options: TtsProviderOptions = {}): TtsProvider {
  const provider = options.provider ?? 'edge';
  if (provider === 'edge') return edgeProvider(options);
  if (provider === 'native') return nativeProvider(options);
  if (provider === 'breeze') return breezeProvider(options);
  throw new Error(
    `不支持的 TTS provider：${provider}。目前支持 edge / native / breeze。`,
  );
}
