let canvasCtx;
export function toRgb(css2) {
  canvasCtx ?? (canvasCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
  canvasCtx.canvas.width = canvasCtx.canvas.height = 1;
  canvasCtx.clearRect(0, 0, 1, 1);
  canvasCtx.fillStyle = "#000";
  canvasCtx.fillStyle = css2;
  canvasCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvasCtx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
export function themeColor(name, fallback) {
  const el = document.createElement("span");
  el.style.cssText = `position:absolute;visibility:hidden;color:var(${name},${fallback})`;
  document.body.append(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return toRgb(c);
}
export const css = ([r, g, b], a = 1) => a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
export const luminance = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
export const DARK = {
  black: "#3b4252",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#c0caf5",
  brightBlack: "#6b7394",
  brightRed: "#ff899d",
  brightGreen: "#b9f27c",
  brightYellow: "#ffc777",
  brightBlue: "#8db0ff",
  brightMagenta: "#c9a9ff",
  brightCyan: "#a4daff",
  brightWhite: "#eef1ff"
};
export const LIGHT = {
  black: "#24292f",
  red: "#cf222e",
  green: "#116329",
  yellow: "#7d4e00",
  blue: "#0550ae",
  magenta: "#8250df",
  cyan: "#1b7c83",
  white: "#6e7781",
  brightBlack: "#57606a",
  brightRed: "#a40e26",
  brightGreen: "#1a7f37",
  brightYellow: "#9a6700",
  brightBlue: "#0969da",
  brightMagenta: "#a475f9",
  brightCyan: "#3192aa",
  brightWhite: "#8c959f"
};
/**
 * 终端配色。
 *
 * 背景一定要跟宿主一致，否则终端会和面板底色差一层，在浅色主题里看起来
 * 就是"一大块深色"。早先这里取 `--dsw-alias-bg-layer-1` 并把兜底写成
 * `#1e1e1e`(深灰)：宿主若没定义那个变量，整个终端背景直接变深灰。
 *
 * 现在直接读插件根元素上的 `--sx-bg`（style.css 里已经按令牌语义算好了
 * 白色兜底），拿不到才退回白。
 */
export function termTheme() {
  const bg = rootColor('--sx-bg', '#ffffff');
  const fg = rootColor('--sx-fg', '#1f2328');
  const accent = rootColor('--sx-accent', '#3b82f6');
  return {
    background: css(bg),
    foreground: css(fg),
    cursor: css(accent),
    cursorAccent: css(bg),
    selectionBackground: css(accent, 0.35),
    // 调色板按背景亮度二选一：浅底配深色 ANSI，深底配亮色 ANSI
    ...(luminance(bg) < 0.5 ? DARK : LIGHT)
  };
}

/**
 * 从 `.sx-root` 上读一个自定义属性的实际颜色。
 *
 * 为什么不用「临时 span + color:var(--x)」那套：变量没定义时浏览器让 color 继承
 * 父级，读回来是个看似正常的颜色，根本区分不出"没有这个变量"。而我们自己的
 * `--sx-*` 一定定义在 `.sx-root` 上，直接读它最实在。
 *
 * 手写解析是因为这里拿到的可能是 hex、rgb() 或 color-mix() 的结果；
 * 统一丢给 canvas 取色（toRgb 内部就是干这个的）。
 */
function rootColor(name, fallback) {
  const root = document.querySelector('.sx-root');
  const raw = root ? getComputedStyle(root).getPropertyValue(name).trim() : '';
  if (!raw) return toRgb(fallback);
  const rgb = toRgb(raw);
  // toRgb 对无法解析的值会得到纯黑（canvas 初始填充色），这时用兜底
  if (!rgb || (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0 && !/^#?0{3,8}$|black|rgb\(\s*0,\s*0,\s*0/i.test(raw))) {
    return toRgb(fallback);
  }
  return rgb;
}
export function watchTheme(cb) {
  let t;
  const fire = () => {
    clearTimeout(t);
    t = setTimeout(cb, 80);
  };
  const mo = new MutationObserver(fire);
  const opts = { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-scheme"] };
  mo.observe(document.documentElement, opts);
  mo.observe(document.body, opts);
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", fire);
  return () => {
    clearTimeout(t);
    mo.disconnect();
    mq?.removeEventListener?.("change", fire);
  };
}
