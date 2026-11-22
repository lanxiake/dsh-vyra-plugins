function __mpBackgroundsBundle() {
  var MPFoliaBackgrounds = (() => {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  
    // src/render/folia/backgrounds-entry.tsx
    var backgrounds_entry_exports = {};
    __export(backgrounds_entry_exports, {
      DEFAULT_LATENT_BACKGROUND_TUNING: () => DEFAULT_LATENT_BACKGROUND_TUNING,
      DEFAULT_MONET_BACKGROUND_TUNING: () => DEFAULT_MONET_BACKGROUND_TUNING,
      DEFAULT_NOMAND_BACKGROUND_TUNING: () => DEFAULT_NOMAND_BACKGROUND_TUNING,
      DEFAULT_SORA_BACKGROUND_TUNING: () => DEFAULT_SORA_BACKGROUND_TUNING,
      DEFAULT_VISUALIZER_BACKGROUND_MODE: () => DEFAULT_VISUALIZER_BACKGROUND_MODE,
      VISUALIZER_BACKGROUND_MODE_IDS: () => VISUALIZER_BACKGROUND_MODE_IDS,
      VISUALIZER_BACKGROUND_REGISTRY: () => VISUALIZER_BACKGROUND_REGISTRY,
      VisualizerBackgroundRenderer: () => VisualizerBackgroundRenderer_default,
      getVisualizerBackgroundRegistryEntry: () => getVisualizerBackgroundRegistryEntry,
      hasVisualizerBackgroundMode: () => hasVisualizerBackgroundMode
    });
  
    // src/render/folia/types/visualizerModes.ts
    var BUILTIN_VISUALIZER_MODES = [
      "cadenza",
      "cappella",
      "claddagh",
      "classic",
      "diorama",
      "nebbia",
      "fume",
      "hanabi",
      "lumiere",
      "machi",
      "monet",
      "partita",
      "pendolo",
      "sonnet",
      "still",
      "tempera",
      "tilt"
    ];
    var BUILTIN_VISUALIZER_BACKGROUND_MODES = [
      "common",
      "latent",
      "monet",
      "nomand",
      "sora",
      "url"
    ];
    var DEFAULT_VISUALIZER_BACKGROUND_MODE = "latent";
    var VISUALIZER_MODE_SET = new Set(BUILTIN_VISUALIZER_MODES);
    var VISUALIZER_BACKGROUND_MODE_SET = new Set(BUILTIN_VISUALIZER_BACKGROUND_MODES);
  
    // src/vendor/react-shim.js
    var BaseReact = globalThis.__MP_REACT__ || {};
    var React = typeof BaseReact.memo === "function" && typeof BaseReact.forwardRef === "function" ? BaseReact : Object.assign({}, BaseReact, {
      memo: typeof BaseReact.memo === "function" ? BaseReact.memo : (component) => component,
      forwardRef: typeof BaseReact.forwardRef === "function" ? BaseReact.forwardRef : (render) => render,
      createContext: typeof BaseReact.createContext === "function" ? BaseReact.createContext : (value) => ({ Provider: (props) => props.children, Consumer: () => null, _currentValue: value }),
      useContext: typeof BaseReact.useContext === "function" ? BaseReact.useContext : () => null,
      lazy: typeof BaseReact.lazy === "function" ? BaseReact.lazy : () => () => null,
      Suspense: BaseReact.Suspense || ((props) => props && props.children || null)
    });
    var react_shim_default = React;
    var Children = React.Children;
    var createElement = React.createElement;
    var cloneElement = React.cloneElement;
    var isValidElement = React.isValidElement;
    var createContext = React.createContext;
    var forwardRef = React.forwardRef;
    var memo = React.memo;
    var Component = React.Component;
    var Fragment = React.Fragment;
    var StrictMode = React.StrictMode;
    var useState = React.useState;
    var useReducer = React.useReducer;
    var useEffect = React.useEffect;
    var useLayoutEffect = React.useLayoutEffect || React.useEffect;
    var useInsertionEffect = React.useInsertionEffect || React.useLayoutEffect || React.useEffect;
    var useRef = React.useRef;
    var useMemo = React.useMemo;
    var useCallback = React.useCallback;
    var useContext = React.useContext;
    var useId = React.useId || (() => "");
    var useImperativeHandle = React.useImperativeHandle;
    var useDebugValue = React.useDebugValue || (() => void 0);
    var useSyncExternalStore = React.useSyncExternalStore || (() => void 0);
    var useTransition = React.useTransition || (() => [false, (run) => run()]);
    var useDeferredValue = React.useDeferredValue || ((value) => value);
    var startTransition = React.startTransition || ((run) => run());
    var useOptimistic = React.useOptimistic || ((value) => value);
    var use = React.use;
    var createRef = React.createRef;
    var Suspense = React.Suspense;
    var lazy = React.lazy;
    var PureComponent = React.PureComponent;
    var version = React.version;
  
    // src/render/folia/shims/lucide-react.js
    var starPath = "M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.68l-5.9 3.1 1.13-6.58L2.45 9.54l6.6-.96L12 2.6z";
    function makeIcon(path) {
      return function Icon(props) {
        const size = Number(props && props.size) || 24;
        return react_shim_default.createElement(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: size,
            height: size,
            viewBox: "0 0 24 24",
            fill: "currentColor",
            stroke: "currentColor",
            strokeWidth: 1,
            "aria-hidden": "true",
            style: props && props.style,
            className: props && props.className
          },
          react_shim_default.createElement("path", { d: path })
        );
      };
    }
    var Star = makeIcon(starPath);
    var Disc3 = makeIcon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z");
    var Aperture = makeIcon(starPath);
    var Cone = makeIcon(starPath);
    var Layers = makeIcon(starPath);
    var Columns3 = makeIcon(starPath);
    var Wind = makeIcon(starPath);
    var Square = makeIcon("M4 4h16v16H4z");
    var ImagePlus = makeIcon(starPath);
    var Trash2 = makeIcon(starPath);
    var Pencil = makeIcon(starPath);
    var Plus = makeIcon("M12 5v14M5 12h14");
    var Upload = makeIcon(starPath);
    var Smile = makeIcon(starPath);
    var SeparatorVertical = makeIcon(starPath);
    var Hourglass = makeIcon(starPath);
    var EyeOff = makeIcon(starPath);
    var RotateCcw = makeIcon(starPath);
    var AlignLeft = makeIcon(starPath);
    var AudioWaveform = makeIcon(starPath);
    var Move = makeIcon(starPath);
    var Spline = makeIcon(starPath);
    var Frame = makeIcon(starPath);
    var Sparkles = makeIcon(starPath);
    var WandSparkles = makeIcon(starPath);
    var Scan = makeIcon(starPath);
    var Ghost = makeIcon(starPath);
    var Highlighter = makeIcon(starPath);
  
    // src/render/folia/components/visualizer/backgrounds/definition.ts
    var defineVisualizerBackground = (entry) => entry;
  
    // src/render/folia/components/shared/QuickControlChip.tsx
    var QuickControlChip = (_props) => null;
    var QuickControlToggle = (_props) => null;
    var cycleValue = (values, current) => {
      const index = values.indexOf(current);
      return values[(index + 1) % values.length] ?? values[0];
    };
  
    // src/render/folia/shims/settings-card.tsx
    var Stub = () => null;
    var MonetBackgroundSettingsCard = Stub;
    var UrlBackgroundSettingsCard = Stub;
    var SettingsKitThemeContext = react_shim_default.createContext(null);
    var settings_card_default = Stub;
  
    // src/render/folia/shims/framer-motion.js
    var framer = typeof MPFramer !== "undefined" && MPFramer !== null ? MPFramer : {};
    var motionFallback = new Proxy({}, {
      get: (_target, tag) => function MotionFallback(props) {
        return react_shim_default.createElement(tag, props);
      }
    });
    var motion = framer.motion || motionFallback;
    var AnimatePresence = framer.AnimatePresence || ((props) => props && props.children || null);
    var MotionConfig = framer.MotionConfig || ((props) => props && props.children || null);
    var LayoutGroup = framer.LayoutGroup || ((props) => props && props.children || null);
    var useMotionValue = framer.useMotionValue || function useMotionValue2(initial) {
      let value = initial;
      return {
        get: () => value,
        set: (next) => {
          value = next;
        },
        on: () => () => {
        },
        subscribe: () => () => {
        },
        destroy: () => {
        }
      };
    };
    var useSpring = framer.useSpring || ((value) => value);
    var useTransform = framer.useTransform || ((value, map) => ({
      get: () => typeof map === "function" ? map(value && typeof value.get === "function" ? value.get() : value) : 0,
      set: () => {
      },
      on: () => () => {
      },
      subscribe: () => () => {
      },
      destroy: () => {
      }
    }));
    var useMotionValueEvent = framer.useMotionValueEvent || function useMotionValueEvent2(value, event, callback) {
      react_shim_default.useEffect(() => {
        if (!value || typeof value.on !== "function") return void 0;
        const unsubscribe = value.on(event, callback);
        if (event === "change" && typeof value.get === "function") callback(value.get());
        return typeof unsubscribe === "function" ? unsubscribe : void 0;
      }, [value, event, callback]);
    };
    var useDragControls = framer.useDragControls || (() => ({ start: () => {
    }, subscribe: () => () => {
    } }));
    var motionValue = framer.motionValue || ((initial) => {
      let value = initial;
      return {
        get: () => value,
        set: (next) => {
          value = next;
        },
        on: () => () => {
        },
        subscribe: () => () => {
        },
        destroy: () => {
        }
      };
    });
    var useReducedMotion = framer.useReducedMotion || (() => false);
    var animate = framer.animate || (() => ({ stop: () => {
    } }));
  
    // src/render/folia/components/visualizer/preview/frozenPicture.ts
    var ARRIVING_MARK = "data-picture-arriving";
  
    // src/render/folia/components/visualizer/styleTransition/firstFrame.ts
    var FirstFrameContext = createContext(null);
    var useFirstFrameDrawn = () => {
      const report = useContext(FirstFrameContext);
      useLayoutEffect(() => {
        report?.claim();
      }, [report]);
      return useCallback(() => report?.drawn(), [report]);
    };
    var LayerUnseenContext = createContext(false);
    var useLayerUnseen = () => useContext(LayerUnseenContext);
  
    // src/render/folia/components/visualizer/textMeasureCache.ts
    var rememberBounded = (cache, key, value, limit) => {
      if (!cache.has(key) && cache.size >= limit) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(key, value);
      return value;
    };
  
    // src/render/folia/components/visualizer/colorMix.ts
    var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    var mix = (from, to, amount) => from + (to - from) * amount;
    var FALLBACK_RGB = { r: 255, g: 255, b: 255 };
    var isFiniteChannel = (value) => Number.isFinite(value);
    var formatRgba = (channels, alpha) => `rgba(${Math.round(clamp(channels.r, 0, 255))}, ${Math.round(clamp(channels.g, 0, 255))}, ${Math.round(clamp(channels.b, 0, 255))}, ${alpha})`;
    var readColor = (normalizedColor) => {
      if (!normalizedColor) return "fallback";
      if (normalizedColor.startsWith("#")) {
        const hex = normalizedColor.slice(1);
        const parse = (value) => Number.parseInt(value, 16);
        if (/^[0-9a-fA-F]{3}$/.test(hex)) {
          return {
            r: parse(hex[0] + hex[0]),
            g: parse(hex[1] + hex[1]),
            b: parse(hex[2] + hex[2])
          };
        }
        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
          return {
            r: parse(hex.slice(0, 2)),
            g: parse(hex.slice(2, 4)),
            b: parse(hex.slice(4, 6))
          };
        }
        return "fallback";
      }
      const rgbMatch = normalizedColor.match(/^rgba?\(([^)]+)\)$/);
      if (rgbMatch) {
        const [r, g, b] = rgbMatch[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
        if ([r, g, b].every(isFiniteChannel)) {
          return { r, g, b };
        }
        return "fallback";
      }
      return "passthrough";
    };
    var parsedColors = /* @__PURE__ */ new Map();
    var PARSED_COLOR_LIMIT = 512;
    var parseColor = (color) => {
      const normalized = typeof color === "string" ? color.trim() : "";
      let parsed = parsedColors.get(normalized);
      if (parsed === void 0) {
        parsed = rememberBounded(parsedColors, normalized, readColor(normalized), PARSED_COLOR_LIMIT);
      }
      return { normalized, parsed };
    };
    var colorWithAlpha = (color, alpha) => {
      const normalizedAlpha = clamp(alpha, 0, 1);
      const { normalized, parsed } = parseColor(color);
      if (parsed === "passthrough") return normalized;
      return formatRgba(parsed === "fallback" ? FALLBACK_RGB : parsed, normalizedAlpha);
    };
    var parseColorChannels = (color) => {
      const { parsed } = parseColor(color);
      return typeof parsed === "string" ? null : { ...parsed };
    };
    var mixColors = (from, to, amount, alpha = 1) => {
      const normalizedAmount = clamp(amount, 0, 1);
      const fromParsed = parseColor(from).parsed;
      const toParsed = parseColor(to).parsed;
      if (typeof fromParsed === "string" || typeof toParsed === "string") {
        return colorWithAlpha(normalizedAmount >= 0.5 ? to : from, alpha);
      }
      return `rgba(${Math.round(mix(fromParsed.r, toParsed.r, normalizedAmount))}, ${Math.round(mix(fromParsed.g, toParsed.g, normalizedAmount))}, ${Math.round(mix(fromParsed.b, toParsed.b, normalizedAmount))}, ${clamp(alpha, 0, 1)})`;
    };
  
    // src/render/folia/services/automix/handoffProgress.ts
    var clamp01 = (value) => Math.max(0, Math.min(1, value));
    var progressSince = (value, start) => start >= 1 ? 1 : clamp01((value - start) / (1 - start));
  
    // src/render/folia/components/visualizer/backgrounds/useBlendedColors.ts
    var easeOut = (t) => 1 - (1 - t) ** 3;
    var sameColors = (left, right) => left.length === right.length && left.every((color, index) => color === right[index]);
    var useBlendedColors = (colors, durationMs, progress) => {
      const key = colors.join("|");
      const target = useMemo(() => key.split("|"), [key]);
      const [drawn, setDrawn] = useState(target);
      const drawnRef = useRef(target);
      useEffect(() => {
        const from = drawnRef.current;
        const show = (next) => {
          drawnRef.current = next;
          setDrawn(next);
        };
        if (sameColors(from, target)) return void 0;
        if (durationMs <= 0 || from.length !== target.length) {
          show(target);
          return void 0;
        }
        const mixed = (t) => t >= 1 ? target : target.map((to, index) => mixColors(from[index], to, t));
        const start = progress?.get() ?? 1;
        if (progress && start < 1) {
          const follow = (value) => show(mixed(progressSince(value, start)));
          return progress.on("change", follow);
        }
        const startedAt = performance.now();
        let frame = 0;
        const step = (now) => {
          const t = Math.min(1, (now - startedAt) / durationMs);
          show(mixed(t >= 1 ? 1 : easeOut(t)));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
      }, [target, durationMs, progress]);
      return durationMs <= 0 ? target : drawn;
    };
  
    // src/vendor/jsx-runtime-shim.js
    var React2 = globalThis.__MP_REACT__ || {};
    var createElement2 = React2.createElement;
    var Fragment2 = React2.Fragment;
    function build(type, props, key) {
      const attributes = {};
      let children;
      for (const name of Object.keys(props || {})) {
        if (name === "children") children = props[name];
        else if (name === "key") continue;
        else attributes[name] = props[name];
      }
      if (key !== void 0) attributes.key = key;
      if (Array.isArray(children)) {
        return createElement2.apply(null, [type, attributes].concat(children));
      }
      return children === void 0 ? createElement2(type, attributes) : createElement2(type, attributes, children);
    }
    function jsx(type, props, key) {
      return build(type, props, key);
    }
    var jsxs = jsx;
  
    // src/render/folia/components/visualizer/backgrounds/common/FluidBackground.tsx
    var IOS_SOFT_FOCUS_SAMPLE_SIZE = 24;
    var IOS_SOFT_FOCUS_OUTPUT_SIZE = 96;
    var detectIOSSafari = () => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent;
      const isAppleMobile = /iPad|iPhone|iPod/i.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      const isWebKit = /WebKit/i.test(ua);
      const isAltIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(ua);
      return isAppleMobile && isWebKit && !isAltIOSBrowser;
    };
    var buildSoftFocusCover = (coverUrl) => new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        try {
          const sourceCanvas = document.createElement("canvas");
          const outputCanvas = document.createElement("canvas");
          sourceCanvas.width = IOS_SOFT_FOCUS_SAMPLE_SIZE;
          sourceCanvas.height = IOS_SOFT_FOCUS_SAMPLE_SIZE;
          outputCanvas.width = IOS_SOFT_FOCUS_OUTPUT_SIZE;
          outputCanvas.height = IOS_SOFT_FOCUS_OUTPUT_SIZE;
          const sourceCtx = sourceCanvas.getContext("2d");
          const outputCtx = outputCanvas.getContext("2d");
          if (!sourceCtx || !outputCtx) {
            resolve(null);
            return;
          }
          const naturalWidth = img.naturalWidth || img.width;
          const naturalHeight = img.naturalHeight || img.height;
          const squareSize2 = Math.min(naturalWidth, naturalHeight);
          const sx = Math.max(0, (naturalWidth - squareSize2) / 2);
          const sy = Math.max(0, (naturalHeight - squareSize2) / 2);
          sourceCtx.imageSmoothingEnabled = true;
          sourceCtx.imageSmoothingQuality = "high";
          sourceCtx.drawImage(
            img,
            sx,
            sy,
            squareSize2,
            squareSize2,
            0,
            0,
            IOS_SOFT_FOCUS_SAMPLE_SIZE,
            IOS_SOFT_FOCUS_SAMPLE_SIZE
          );
          outputCtx.imageSmoothingEnabled = true;
          outputCtx.imageSmoothingQuality = "high";
          outputCtx.globalAlpha = 1;
          outputCtx.drawImage(
            sourceCanvas,
            0,
            0,
            IOS_SOFT_FOCUS_SAMPLE_SIZE,
            IOS_SOFT_FOCUS_SAMPLE_SIZE,
            0,
            0,
            IOS_SOFT_FOCUS_OUTPUT_SIZE,
            IOS_SOFT_FOCUS_OUTPUT_SIZE
          );
          const softPasses = [
            { x: -8, y: -8, size: IOS_SOFT_FOCUS_OUTPUT_SIZE + 16, alpha: 0.22 },
            { x: 6, y: 0, size: IOS_SOFT_FOCUS_OUTPUT_SIZE, alpha: 0.14 },
            { x: 0, y: 6, size: IOS_SOFT_FOCUS_OUTPUT_SIZE, alpha: 0.14 }
          ];
          softPasses.forEach(({ x, y, size, alpha }) => {
            outputCtx.globalAlpha = alpha;
            outputCtx.drawImage(
              sourceCanvas,
              0,
              0,
              IOS_SOFT_FOCUS_SAMPLE_SIZE,
              IOS_SOFT_FOCUS_SAMPLE_SIZE,
              x,
              y,
              size,
              size
            );
          });
          outputCtx.globalAlpha = 1;
          resolve(outputCanvas.toDataURL("image/jpeg", 0.72));
        } catch (error2) {
          console.warn("[FluidBackground] Failed to build soft focus cover", error2);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = coverUrl;
    });
    var COVER_CANVAS_WIDTH = 320;
    var COVER_SOURCE_MAX = 640;
    var OVERLAY_BLEND_MS = 1e3;
    var stopsOf = (ctx, color) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      const solid = String(ctx.fillStyle);
      const [r, g, b] = solid.startsWith("#") ? [1, 3, 5].map((at) => parseInt(solid.slice(at, at + 2), 16)) : solid.match(/[\d.]+/g) ?? ["0", "0", "0"];
      return [solid, `rgba(${r}, ${g}, ${b}, 0)`];
    };
    var createCanvas = (width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    var canvasBlurSupported = null;
    var canvasBlurWorks = () => {
      if (canvasBlurSupported !== null) return canvasBlurSupported;
      try {
        const ctx = createCanvas(4, 1).getContext("2d", { willReadFrequently: true });
        if (!ctx || typeof ctx.filter !== "string") {
          canvasBlurSupported = false;
        } else {
          ctx.filter = "blur(1px)";
          ctx.fillStyle = "#fff";
          ctx.fillRect(2, 0, 1, 1);
          canvasBlurSupported = ctx.getImageData(1, 0, 1, 1).data[3] > 0;
        }
      } catch {
        canvasBlurSupported = false;
      }
      return canvasBlurSupported;
    };
    var blurByScaling = (source, blurPx) => {
      const { width: w, height: h } = source;
      const smallest = w / Math.max(1, blurPx * 2.5);
      const sizes = [];
      let sw = w;
      let sh = h;
      while (sw / 2 >= smallest && sw > 2 && sh > 2) {
        sw = Math.ceil(sw / 2);
        sh = Math.ceil(sh / 2);
        sizes.push([sw, sh]);
      }
      const steps = [...sizes, ...sizes.slice(0, -1).reverse(), [w, h]];
      let current = source;
      for (const [stepWidth, stepHeight] of steps) {
        const next = createCanvas(stepWidth, stepHeight);
        const ctx = next.getContext("2d");
        if (!ctx) return current;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(current, 0, 0, stepWidth, stepHeight);
        current = next;
      }
      return current;
    };
    var bakeBlurredCover = (image, w, h, cssWidth) => {
      const baked = createCanvas(w, h);
      const ctx = baked.getContext("2d");
      if (!ctx) return null;
      const scale = Math.max(w / image.width, h / image.height) * 1.5;
      const dw = image.width * scale;
      const dh = image.height * scale;
      const blurPx = 40 * 1.5 * w / cssWidth;
      const filtered = canvasBlurWorks();
      if (filtered) ctx.filter = `blur(${blurPx}px)`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return filtered ? baked : blurByScaling(baked, blurPx);
    };
    var drawCover = (canvas, blurred, primary, secondary) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      if (!blurred) return;
      ctx.drawImage(blurred, 0, 0, w, h);
      const diagonal = Math.hypot(w, h);
      const half = w * h / diagonal;
      const dx = h / diagonal * half;
      const dy = w / diagonal * half;
      const gradient = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
      const [primarySolid, primaryClear] = stopsOf(ctx, primary);
      const [secondarySolid, secondaryClear] = stopsOf(ctx, secondary);
      gradient.addColorStop(0, primarySolid);
      gradient.addColorStop(0.5, primaryClear);
      gradient.addColorStop(0.5, secondaryClear);
      gradient.addColorStop(1, secondarySolid);
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };
    var CoverCanvas = ({ image, primaryColor, secondaryColor, onDrawn }) => {
      const canvasRef = useRef(null);
      const [box, setBox] = useState(null);
      useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return void 0;
        const measure = () => {
          const width = canvas.clientWidth;
          const height = canvas.clientHeight;
          setBox((prev) => prev && prev.width === width && prev.height === height ? prev : { width, height });
        };
        measure();
        if (typeof ResizeObserver === "undefined") return void 0;
        const observer = new ResizeObserver(measure);
        observer.observe(canvas);
        return () => observer.disconnect();
      }, []);
      const onDrawnRef = useRef(onDrawn);
      useLayoutEffect(() => {
        onDrawnRef.current = onDrawn;
      });
      const reportedRef = useRef(false);
      const bakedRef = useRef(null);
      useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !box) return void 0;
        if (box.width > 0 && box.height > 0) {
          const height = Math.max(1, Math.round(COVER_CANVAS_WIDTH * box.height / box.width));
          if (canvas.width !== COVER_CANVAS_WIDTH || canvas.height !== height) {
            canvas.width = COVER_CANVAS_WIDTH;
            canvas.height = height;
          }
          let baked = bakedRef.current;
          if (!image) {
            baked = null;
          } else if (!baked || baked.image !== image || baked.width !== canvas.width || baked.height !== canvas.height || baked.cssWidth !== box.width) {
            baked = {
              image,
              width: canvas.width,
              height: canvas.height,
              cssWidth: box.width,
              canvas: bakeBlurredCover(image, canvas.width, canvas.height, box.width)
            };
          }
          bakedRef.current = baked;
          drawCover(canvas, baked?.canvas ?? null, primaryColor, secondaryColor);
        }
        if (reportedRef.current) return void 0;
        const frame = requestAnimationFrame(() => {
          reportedRef.current = true;
          onDrawnRef.current();
        });
        return () => cancelAnimationFrame(frame);
      }, [box, image, primaryColor, secondaryColor]);
      return /* @__PURE__ */ jsx("canvas", { ref: canvasRef, "aria-hidden": "true", className: "absolute inset-0 w-full h-full" });
    };
    var FluidBackground = memo(({ coverUrl, theme }) => {
      const isIOSSafari = useMemo(detectIOSSafari, []);
      const [softFocusCoverUrl, setSoftFocusCoverUrl] = useState(null);
      const [overlayPrimary, overlaySecondary] = useBlendedColors([theme.primaryColor, theme.secondaryColor], OVERLAY_BLEND_MS);
      useEffect(() => {
        let cancelled = false;
        if (!isIOSSafari || !coverUrl) {
          setSoftFocusCoverUrl(null);
          return () => {
            cancelled = true;
          };
        }
        setSoftFocusCoverUrl(null);
        void buildSoftFocusCover(coverUrl).then((nextUrl) => {
          if (!cancelled) {
            setSoftFocusCoverUrl(nextUrl);
          }
        });
        return () => {
          cancelled = true;
        };
      }, [coverUrl, isIOSSafari]);
      const coverDrawn = useFirstFrameDrawn();
      const coverKeyRef = useRef(0);
      const [coverLayers, setCoverLayers] = useState([]);
      const [readyCoverKeys, setReadyCoverKeys] = useState(() => /* @__PURE__ */ new Set());
      const openBitmapsRef = useRef(/* @__PURE__ */ new Set());
      useEffect(() => {
        const drawn = new Set(coverLayers.map((layer) => layer.image));
        openBitmapsRef.current.forEach((bitmap) => {
          if (drawn.has(bitmap)) return;
          bitmap.close();
          openBitmapsRef.current.delete(bitmap);
        });
      }, [coverLayers]);
      useEffect(() => () => {
        openBitmapsRef.current.forEach((bitmap) => bitmap.close());
        openBitmapsRef.current.clear();
      }, []);
      useEffect(() => {
        if (isIOSSafari) return void 0;
        if (!coverUrl) {
          setCoverLayers([]);
          return void 0;
        }
        let cancelled = false;
        const image = new Image();
        image.decoding = "async";
        image.src = coverUrl;
        image.decode().then(() => {
          const fit = Math.min(1, COVER_SOURCE_MAX / Math.max(image.naturalWidth, image.naturalHeight));
          return createImageBitmap(image, {
            resizeWidth: Math.max(1, Math.round(image.naturalWidth * fit)),
            resizeHeight: Math.max(1, Math.round(image.naturalHeight * fit)),
            resizeQuality: "high"
          });
        }).then((bitmap) => {
          if (cancelled) {
            bitmap.close();
            return;
          }
          openBitmapsRef.current.add(bitmap);
          setCoverLayers((prev) => {
            const top = prev[prev.length - 1];
            if (top && top.sourceCover === coverUrl) return prev;
            coverKeyRef.current += 1;
            return [...top ? [top] : [], { image: bitmap, sourceCover: coverUrl, key: coverKeyRef.current }];
          });
        }, () => {
          if (cancelled) return;
          setCoverLayers((prev) => {
            if (prev.length > 0) return prev;
            coverKeyRef.current += 1;
            return [{ image: null, sourceCover: coverUrl, key: coverKeyRef.current }];
          });
          coverDrawn();
        });
        return () => {
          cancelled = true;
        };
      }, [coverUrl, isIOSSafari, coverDrawn]);
      const unseen = useLayerUnseen();
      const unseenRef = useRef(unseen);
      useLayoutEffect(() => {
        unseenRef.current = unseen;
      });
      const [atOnceCoverKey, setAtOnceCoverKey] = useState(null);
      useEffect(() => {
        if (!coverUrl || isIOSSafari) coverDrawn();
      }, [coverUrl, isIOSSafari, coverDrawn]);
      const markCoverReady = useCallback((key) => {
        if (unseenRef.current) setAtOnceCoverKey(key);
        setReadyCoverKeys((prev) => prev.has(key) ? prev : new Set(prev).add(key));
        coverDrawn();
      }, [coverDrawn]);
      const [arrivedCoverKey, setArrivedCoverKey] = useState(null);
      const topCoverLayer = coverLayers[coverLayers.length - 1];
      const isCoverArriving = Boolean(coverUrl) && !isIOSSafari && !(topCoverLayer && topCoverLayer.sourceCover === coverUrl && topCoverLayer.key === arrivedCoverKey);
      const iosDisplayCoverUrl = isIOSSafari ? softFocusCoverUrl ?? coverUrl ?? null : null;
      const isSoftFocusReady = isIOSSafari && Boolean(softFocusCoverUrl);
      const coverLayerStyle = useMemo(() => ({
        transform: `scale(${isSoftFocusReady ? 1.28 : 1.2}) translateZ(0)`,
        opacity: isSoftFocusReady ? 0.94 : 0.3,
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden"
      }), [isSoftFocusReady]);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0",
          style: {
            isolation: "isolate",
            contain: "paint",
            transform: "translateZ(0)"
          },
          ...isCoverArriving ? { [ARRIVING_MARK]: "" } : {},
          children: [
            coverUrl ? /* @__PURE__ */ jsxs(Fragment2, { children: [
              isIOSSafari ? /* @__PURE__ */ jsx(
                "img",
                {
                  src: iosDisplayCoverUrl ?? coverUrl,
                  alt: "",
                  "aria-hidden": "true",
                  draggable: false,
                  decoding: "async",
                  className: "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out",
                  style: coverLayerStyle
                }
              ) : /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "absolute inset-0 w-full h-full transition-colors duration-1000",
                    style: { backgroundColor: theme.backgroundColor, opacity: 0.8 }
                  }
                ),
                coverLayers.map((layer, index) => {
                  const isTop = index === coverLayers.length - 1;
                  const ready = readyCoverKeys.has(layer.key);
                  return /* @__PURE__ */ jsx(
                    motion.div,
                    {
                      className: "absolute inset-0 w-full h-full",
                      style: { willChange: "opacity" },
                      initial: { opacity: isTop ? 0 : 1 },
                      animate: { opacity: isTop && !ready ? 0 : 1 },
                      transition: { duration: layer.key === atOnceCoverKey ? 0 : 1.5, ease: "easeInOut" },
                      onAnimationComplete: () => {
                        if (isTop && ready) {
                          setCoverLayers((prev) => prev.filter((l) => l.key === layer.key));
                          setReadyCoverKeys((prev) => prev.has(layer.key) ? /* @__PURE__ */ new Set([layer.key]) : prev);
                          setArrivedCoverKey(layer.key);
                        }
                      },
                      children: /* @__PURE__ */ jsx(
                        CoverCanvas,
                        {
                          image: layer.image,
                          primaryColor: overlayPrimary,
                          secondaryColor: overlaySecondary,
                          onDrawn: () => markCoverReady(layer.key)
                        }
                      )
                    },
                    layer.key
                  );
                })
              ] }),
              isIOSSafari && /* @__PURE__ */ jsxs(Fragment2, { children: [
                !isSoftFocusReady && /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: coverUrl,
                    alt: "",
                    "aria-hidden": "true",
                    draggable: false,
                    decoding: "async",
                    className: "absolute inset-0 w-full h-full object-cover",
                    style: {
                      transform: "scale(1.36) translateZ(0)",
                      opacity: 0.12,
                      willChange: "transform, opacity",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden"
                    }
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "absolute inset-0 w-full h-full",
                    style: {
                      backgroundColor: theme.backgroundColor,
                      opacity: 0.28
                    }
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "absolute inset-0 w-full h-full",
                    style: {
                      background: `radial-gradient(circle at 20% 20%, ${theme.accentColor}55 0%, transparent 42%), radial-gradient(circle at 80% 28%, ${theme.secondaryColor}50 0%, transparent 44%), radial-gradient(circle at 50% 78%, ${theme.primaryColor}28 0%, transparent 52%)`,
                      opacity: isSoftFocusReady ? 0.52 : 0.7
                    }
                  }
                )
              ] })
            ] }) : /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute inset-0 w-full h-full transition-colors duration-1000",
                style: {
                  backgroundColor: theme.backgroundColor,
                  opacity: 0.8
                }
              }
            ),
            (!coverUrl || isIOSSafari || topCoverLayer && !topCoverLayer.image) && /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute inset-0 w-full h-full",
                style: {
                  background: `linear-gradient(to bottom right, ${overlayPrimary}, transparent, ${overlaySecondary})`,
                  opacity: isIOSSafari ? 0.2 : 0.4,
                  mixBlendMode: isIOSSafari ? "normal" : "overlay"
                }
              }
            )
          ]
        }
      );
    }, (prevProps, nextProps) => {
      if (prevProps.coverUrl !== nextProps.coverUrl) return false;
      const pTheme = prevProps.theme;
      const nTheme = nextProps.theme;
      return pTheme.backgroundColor === nTheme.backgroundColor && pTheme.primaryColor === nTheme.primaryColor && pTheme.secondaryColor === nTheme.secondaryColor;
    });
    var FluidBackground_default = FluidBackground;
  
    // src/render/folia/hooks/useLucideIcons.ts
    var useLucideIcons = (_names) => 0;
  
    // src/render/folia/services/lucideIconResolver.ts
    var resolveLucideIcon = (_name) => null;
    var getLucideIconStatus = (_name) => "ready";
  
    // src/render/folia/components/visualizer/backgrounds/common/GeometricBackground.tsx
    var getShapeScaleKey = (shape) => {
      switch (shape.type) {
        case "circle":
          return "bass";
        case "square":
          return "lowMid";
        case "triangle":
          return "mid";
        case "cross":
          return "treble";
        default:
          return "default";
      }
    };
    var getShapeClipPath = (shapeType) => {
      if (shapeType === "triangle") {
        return "polygon(50% 0%, 0% 100%, 100% 100%)";
      }
      if (shapeType === "cross") {
        return "polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)";
      }
      return "none";
    };
    var getShapeFaceStyle = (shape, theme) => {
      const isCircleOrSquare = shape.type === "circle" || shape.type === "square";
      const useStroke = isCircleOrSquare && !shape.filled;
      return {
        border: useStroke ? `1px solid ${theme.secondaryColor}` : "none",
        backgroundColor: !useStroke ? theme.secondaryColor : "transparent",
        borderRadius: shape.type === "circle" ? "50%" : "0%",
        opacity: shape.opacity,
        clipPath: getShapeClipPath(shape.type)
      };
    };
    var getShapeDriftStyle = (shape) => ({
      left: `${shape.initialX}%`,
      top: `${shape.initialY}%`,
      width: shape.size,
      height: shape.size,
      animationDuration: `${shape.duration}s`,
      animationDelay: `${shape.delay}s`,
      "--geometric-dir": shape.reverse ? -1 : 1,
      "--geometric-rotate": `${shape.initialRotation}deg`
    });
    var getShapeIcon = (shape, icons) => {
      if (shape.iconSlot === null || icons.length === 0) return null;
      const name = icons[Math.floor(shape.iconSlot * icons.length)];
      if (getLucideIconStatus(name) === "loading") return "loading";
      return resolveLucideIcon(name);
    };
    var VignetteOverlay = ({ disabled = false }) => disabled ? null : /* @__PURE__ */ jsx(
      "div",
      {
        className: "absolute inset-0 pointer-events-none",
        style: { background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)" }
      }
    );
    var GeometricScene = ({ theme, audioPower, audioBands, shapes, particles, hideShapes, disableVignette, paused }) => {
      const useBandScale = (value) => {
        const source = value || audioPower;
        const spring = useSpring(source, { stiffness: 300, damping: 30 });
        return useTransform(spring, [10, 200], [0.95, 1.45]);
      };
      const scales = {
        bass: useBandScale(audioBands?.bass),
        lowMid: useBandScale(audioBands?.lowMid),
        mid: useBandScale(audioBands?.mid),
        vocal: useBandScale(audioBands?.vocal),
        treble: useBandScale(audioBands?.treble),
        default: useBandScale(audioPower)
      };
      const icons = theme.lyricsIcons || [];
      return /* @__PURE__ */ jsxs("div", { className: paused ? "absolute inset-0 geometric-paused" : "absolute inset-0", children: [
        !hideShapes && /* @__PURE__ */ jsxs(Fragment2, { children: [
          shapes.map((shape) => {
            const icon = getShapeIcon(shape, icons);
            const IconComponent = icon === "loading" ? null : icon;
            return /* @__PURE__ */ jsxs("div", { className: "absolute geometric-drift", style: getShapeDriftStyle(shape), children: [
              /* @__PURE__ */ jsx(
                motion.div,
                {
                  className: "w-full h-full transition-[color,background-color,border-color,opacity] duration-1000",
                  style: {
                    ...getShapeFaceStyle(shape, theme),
                    ...icon !== null ? { opacity: 0 } : {},
                    scale: scales[getShapeScaleKey(shape)]
                  }
                }
              ),
              shape.iconSlot !== null && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 transition-opacity duration-1000", style: { opacity: IconComponent ? 1 : 0 }, children: /* @__PURE__ */ jsx(
                motion.div,
                {
                  className: "w-full h-full flex items-center justify-center geometric-pulse transition-colors duration-1000",
                  style: {
                    color: theme.secondaryColor,
                    scale: scales.vocal,
                    animationDuration: `${shape.duration * 0.5}s`,
                    animationDelay: `${shape.delay}s`,
                    "--geometric-peak": shape.opacity * 3
                  },
                  children: IconComponent && /* @__PURE__ */ jsx(IconComponent, { size: shape.size, strokeWidth: 1, absoluteStrokeWidth: true })
                }
              ) })
            ] }, shape.id);
          }),
          particles.map((particle) => /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute rounded-full geometric-rise transition-colors duration-1000",
              style: {
                backgroundColor: theme.accentColor,
                width: particle.size,
                height: particle.size,
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
                "--geometric-peak": particle.opacity
              }
            },
            `p-${particle.id}`
          ))
        ] }),
        /* @__PURE__ */ jsx(VignetteOverlay, { disabled: disableVignette })
      ] });
    };
    var GeometricLayer = ({
      theme,
      audioPower,
      audioBands,
      seed,
      hideShapes = false,
      disableVignette = false,
      paused = false
    }) => {
      useLucideIcons(theme.lyricsIcons);
      const shapes = useMemo(() => {
        const shapeTypes = ["circle", "square", "triangle", "cross"];
        let iconSlots = 0;
        return Array.from({ length: 15 }).map((_, index) => {
          const iconSlot = iconSlots < 6 && Math.random() > 0.7 ? Math.random() : null;
          if (iconSlot !== null) {
            iconSlots += 1;
          }
          return {
            id: index,
            type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
            iconSlot,
            initialX: Math.random() * 100,
            initialY: Math.random() * 100,
            size: 40 + Math.random() * 100,
            duration: iconSlot !== null ? 20 + Math.random() * 20 : 30 + Math.random() * 30,
            delay: Math.random() * 5,
            opacity: 0.11 + Math.random() * 0.08,
            reverse: Math.random() > 0.5,
            filled: Math.random() < 0.3,
            initialRotation: Math.random() * 360
          };
        });
      }, [seed]);
      const particles = useMemo(() => Array.from({ length: 20 }).map((_, index) => ({
        id: index,
        size: Math.random() * 4 + 1,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: Math.random() * 0.3,
        duration: 15 + Math.random() * 20,
        delay: Math.random() * 10
      })), [seed]);
      return /* @__PURE__ */ jsx(
        motion.div,
        {
          className: "absolute inset-0",
          initial: false,
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.6, ease: "easeInOut" },
          children: /* @__PURE__ */ jsx(
            GeometricScene,
            {
              theme,
              audioPower,
              audioBands,
              shapes,
              particles,
              hideShapes,
              disableVignette,
              paused
            }
          )
        }
      );
    };
    var GeometricBackground = react_shim_default.memo((props) => {
      const layerKey = String(props.seed ?? "default");
      return /* @__PURE__ */ jsx("div", { className: "absolute inset-0 overflow-hidden pointer-events-none", children: /* @__PURE__ */ jsx(AnimatePresence, { mode: "sync", children: /* @__PURE__ */ jsx(GeometricLayer, { ...props }, layerKey) }) });
    }, (prevProps, nextProps) => {
      if (prevProps.seed !== nextProps.seed) return false;
      if (prevProps.audioPower !== nextProps.audioPower) return false;
      if (prevProps.hideShapes !== nextProps.hideShapes) return false;
      if (prevProps.disableVignette !== nextProps.disableVignette) return false;
      if (prevProps.paused !== nextProps.paused) return false;
      const previousBands = prevProps.audioBands;
      const nextBands = nextProps.audioBands;
      if (!previousBands !== !nextBands) return false;
      let bandsEqual = true;
      if (previousBands && nextBands) {
        bandsEqual = previousBands.bass === nextBands.bass && previousBands.lowMid === nextBands.lowMid && previousBands.mid === nextBands.mid && previousBands.vocal === nextBands.vocal && previousBands.treble === nextBands.treble;
      }
      if (!bandsEqual) return false;
      const previousTheme = prevProps.theme;
      const nextTheme = nextProps.theme;
      const colorsEqual = previousTheme.backgroundColor === nextTheme.backgroundColor && previousTheme.primaryColor === nextTheme.primaryColor && previousTheme.secondaryColor === nextTheme.secondaryColor && previousTheme.accentColor === nextTheme.accentColor;
      const iconsEqual = Boolean(
        previousTheme.lyricsIcons === nextTheme.lyricsIcons || previousTheme.lyricsIcons?.length === nextTheme.lyricsIcons?.length && previousTheme.lyricsIcons?.every((value, index) => value === nextTheme.lyricsIcons?.[index])
      );
      return colorsEqual && iconsEqual;
    });
    var GeometricBackground_default = GeometricBackground;
  
    // src/render/folia/components/visualizer/backgrounds/common/entry.tsx
    var entry_default = defineVisualizerBackground({
      mode: "common",
      order: 10,
      labelKey: "options.visualizerBackgroundModeCommon",
      labelFallback: "Common",
      // 通用：几何图形氛围层
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("path", { d: "M4 17l5-8 5 8z" }),
        /* @__PURE__ */ jsx("circle", { cx: "17.5", cy: "8.5", r: "3", opacity: "0.55" })
      ] }),
      command: {
        title: "Background: Common",
        description: "Switch background to general layout",
        keywords: ["background general", "common", "general", "\u901A\u7528\u80CC\u666F", "ty", "\u80CC\u666F\u5207\u6362\u5230 \u901A\u7528", "\u80CC\u666F\u5207\u6362\u5230\u901A\u7528"]
      },
      // The geometry is laid out from the seed, and the cover colour layer draws the cover. The theme
      // colours change in place: the base colour glides, as it did.
      song: ({ config, coverUrl, seed, staticMode }) => [
        staticMode ? null : seed ?? null,
        config?.common?.useCoverColorBg ? coverUrl ?? null : null
      ],
      render: ({
        config,
        theme,
        coverUrl,
        audioPower,
        audioBands,
        seed,
        staticMode,
        paused
      }) => {
        const common = config?.common;
        const useCoverColorBg = common?.useCoverColorBg ?? false;
        return /* @__PURE__ */ jsxs(Fragment2, { children: [
          useCoverColorBg && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 z-0", children: /* @__PURE__ */ jsx(FluidBackground_default, { coverUrl, theme }) }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0 z-0 transition-all duration-1000",
              style: {
                backgroundColor: theme.backgroundColor,
                opacity: useCoverColorBg ? common?.opacity ?? 0.75 : 1
              }
            }
          ),
          !staticMode && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 z-0", children: /* @__PURE__ */ jsx(
            GeometricBackground_default,
            {
              theme,
              audioPower,
              audioBands,
              seed,
              hideShapes: common?.disableGeometricBackground ?? false,
              disableVignette: common?.disableVignette ?? false,
              paused
            }
          ) })
        ] });
      },
      renderSettingsPanel: (props) => /* @__PURE__ */ jsx(settings_card_default, { ...props }),
      renderQuickControls: ({ config, actions, t }) => {
        const useCoverColorBg = config?.common?.useCoverColorBg ?? false;
        const vignette = !(config?.common?.disableVignette ?? false);
        return /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: useCoverColorBg,
              label: t(useCoverColorBg ? "theme.addCoverColor" : "theme.useDefaultColor"),
              onToggle: () => actions?.common?.onCoverColorChange?.(!useCoverColorBg),
              children: /* @__PURE__ */ jsx(Cone, { size: 14 })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: vignette,
              label: t("options.visualizerVignette"),
              onToggle: () => actions?.common?.onDisableVignetteChange?.(vignette),
              children: /* @__PURE__ */ jsx(Aperture, { size: 14 })
            }
          )
        ] });
      },
      resetSettings: (actions) => {
        actions?.common?.onOpacityChange?.(0.75);
        actions?.common?.onCoverColorChange?.(false);
        actions?.common?.onDisableVignetteChange?.(false);
        actions?.common?.onDisableGeometricChange?.(false);
      }
    });
  
    // src/render/folia/types.ts
    var DEFAULT_MONET_BACKGROUND_TUNING = {
      backgroundSource: "cover-derived",
      backgroundLayout: "full-overlay",
      backgroundBlurPx: 6,
      backgroundOverlayOpacity: 0.74,
      backgroundGrayscale: 0,
      backgroundSaturation: 1.05,
      backgroundWash: 0.34,
      backgroundHalfPaneOffsetX: 0,
      backgroundWashColorMode: "theme",
      backgroundWashCustomColor: "#8fb7ff",
      backgroundDriftEnabled: true,
      backgroundDriftStrength: 0.5,
      backgroundStreaksEnabled: true
    };
    var DEFAULT_NOMAND_BACKGROUND_TUNING = {
      imageSource: "cover-derived",
      effect: "dithering",
      ditheringType: "8x8",
      size: 3,
      colorSteps: 4,
      originalColors: false,
      inverted: false,
      flutedGlassSize: 0.5,
      flutedGlassDistortion: 0.5,
      flutedGlassBlur: 0.08,
      paperTextureContrast: 0.32,
      paperTextureRoughness: 0.42,
      paperTextureFiber: 0.3,
      halftoneDotsSize: 0.5,
      halftoneDotsRadius: 1.25,
      halftoneDotsContrast: 0.4,
      halftoneDotsOriginalColors: false,
      halftoneDotsInverted: false,
      lensDistortionSpread: 0.45,
      lensDistortionBulge: 0.3,
      lensDistortionDispersion: 0.65,
      overlayEnabled: true,
      overlayOpacity: 0.35
    };
    var DEFAULT_LATENT_BACKGROUND_TUNING = {
      displayMode: "both",
      colorSource: "cover-theme",
      dynamicOnlyInPlayer: true,
      enhancedBeatResponse: true,
      ditheringSpeed: 0.1,
      ditheringAudioSpeed: 1.2,
      ditheringSize: 2.5,
      ditheringOpacity: 0.55,
      meshSpeed: 0.3,
      meshAudioSpeed: 2,
      meshDistortion: 0.8,
      meshSwirl: 0.1,
      overlayEnabled: true,
      overlayOpacity: 0.35
    };
    var DEFAULT_SORA_BACKGROUND_TUNING = {
      blank: false
    };
  
    // src/render/folia/vendor/paper-shaders/dist/vertex-shader.js
    var vertexShaderSource = `#version 300 es
  precision mediump float;
  
  layout(location = 0) in vec4 a_position;
  
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_imageAspectRatio;
  uniform float u_originX;
  uniform float u_originY;
  uniform float u_worldWidth;
  uniform float u_worldHeight;
  uniform float u_fit;
  uniform float u_scale;
  uniform float u_rotation;
  uniform float u_offsetX;
  uniform float u_offsetY;
  
  out vec2 v_objectUV;
  out vec2 v_objectBoxSize;
  out vec2 v_responsiveUV;
  out vec2 v_responsiveBoxGivenSize;
  out vec2 v_patternUV;
  out vec2 v_patternBoxSize;
  out vec2 v_imageUV;
  
  vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
    vec2 box = vec2(0.);
    // fit = none
    box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
    float noFitBoxWidth = box.x;
    if (u_fit == 1.) { // fit = contain
      box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
    }
    box.y = box.x / boxRatio;
    return vec3(box, noFitBoxWidth);
  }
  
  void main() {
    gl_Position = a_position;
  
    vec2 uv = gl_Position.xy * .5;
    vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
    vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
    givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
    float r = u_rotation * 3.14159265358979323846 / 180.;
    mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
    vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);
  
  
    // ===================================================
  
    float fixedRatio = 1.;
    vec2 fixedRatioBoxGivenSize = vec2(
    (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
    (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
    );
  
    v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
    vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;
  
    v_objectUV = uv;
    v_objectUV *= objectWorldScale;
    v_objectUV += boxOrigin * (objectWorldScale - 1.);
    v_objectUV += graphicOffset;
    v_objectUV /= u_scale;
    v_objectUV = graphicRotation * v_objectUV;
  
    // ===================================================
  
    v_responsiveBoxGivenSize = vec2(
    (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
    (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
    );
    float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
    vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
    vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;
  
    #ifdef ADD_HELPERS
    v_responsiveHelperBox = uv;
    v_responsiveHelperBox *= responsiveBoxScale;
    v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
    #endif
  
    v_responsiveUV = uv;
    v_responsiveUV *= responsiveBoxScale;
    v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
    v_responsiveUV += graphicOffset;
    v_responsiveUV /= u_scale;
    v_responsiveUV.x *= responsiveRatio;
    v_responsiveUV = graphicRotation * v_responsiveUV;
    v_responsiveUV.x /= responsiveRatio;
  
    // ===================================================
  
    float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
    vec2 patternBoxGivenSize = vec2(
    (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
    (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
    );
    patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;
  
    vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
    v_patternBoxSize = boxSizeData.xy;
    float patternBoxNoFitBoxWidth = boxSizeData.z;
    vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;
  
    v_patternUV = uv;
    v_patternUV += graphicOffset / patternBoxScale;
    v_patternUV += boxOrigin;
    v_patternUV -= boxOrigin / patternBoxScale;
    v_patternUV *= u_resolution.xy;
    v_patternUV /= u_pixelRatio;
    if (u_fit > 0.) {
      v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
    }
    v_patternUV /= u_scale;
    v_patternUV = graphicRotation * v_patternUV;
    v_patternUV += boxOrigin / patternBoxScale;
    v_patternUV -= boxOrigin;
    // x100 is a default multiplier between vertex and fragmant shaders
    // we use it to avoid UV presision issues
    v_patternUV *= .01;
  
    // ===================================================
  
    vec2 imageBoxSize;
    if (u_fit == 1.) { // contain
      imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
    } else if (u_fit == 2.) { // cover
      imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
    } else {
      imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
    }
    imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
    vec2 imageBoxScale = u_resolution.xy / imageBoxSize;
  
    v_imageUV = uv;
    v_imageUV *= imageBoxScale;
    v_imageUV += boxOrigin * (imageBoxScale - 1.);
    v_imageUV += graphicOffset;
    v_imageUV /= u_scale;
    v_imageUV.x *= u_imageAspectRatio;
    v_imageUV = graphicRotation * v_imageUV;
    v_imageUV.x /= u_imageAspectRatio;
  
    v_imageUV += .5;
    v_imageUV.y = 1. - v_imageUV.y;
  }`;
  
    // src/render/folia/vendor/paper-shaders/dist/shader-mount.js
    var DEFAULT_MAX_PIXEL_COUNT = 1920 * 1080 * 4;
    var ShaderMount = class {
      parentElement;
      canvasElement;
      gl;
      program = null;
      uniformLocations = {};
      /** The fragment shader that we are using */
      fragmentShader;
      /** Stores the RAF for the render loop */
      rafId = null;
      /** Time of the last rendered frame */
      lastRenderTime = 0;
      /** Total time that we have played any animation, passed as a uniform to the shader for time-based VFX */
      currentFrame = 0;
      /** The speed that we progress through animation time (multiplies by delta time every update). Allows negatives to play in reverse. If set to 0, rAF will stop entirely so static shaders have no recurring performance costs */
      speed = 0;
      /** Actual speed used that accounts for visibility: we pause the shader if the tab is hidden or the element out of the viewport */
      currentSpeed = 0;
      /** Uniforms that are provided by the user for the specific shader being mounted (not including uniforms that this Mount adds, like time and resolution) */
      providedUniforms;
      /** Names of the uniforms that should have mipmaps generated for them */
      mipmaps = [];
      /** Just a sanity check to make sure frames don't run after we're disposed */
      hasBeenDisposed = false;
      /** If the resolution of the canvas has changed since the last render */
      resolutionChanged = true;
      /** Store textures that are provided by the user */
      textures = /* @__PURE__ */ new Map();
      minPixelRatio;
      maxPixelCount;
      isSafari = isSafari();
      uniformCache = {};
      textureUnitMap = /* @__PURE__ */ new Map();
      ownerDocument;
      constructor(parentElement, fragmentShader, uniforms, webGlContextAttributes, speed = 0, frame = 0, minPixelRatio = 2, maxPixelCount = DEFAULT_MAX_PIXEL_COUNT, mipmaps = []) {
        if (parentElement?.nodeType === 1) {
          this.parentElement = parentElement;
        } else {
          throw new Error("Paper Shaders: parent element must be an HTMLElement");
        }
        this.ownerDocument = parentElement.ownerDocument;
        if (!this.ownerDocument.querySelector("style[data-paper-shader]")) {
          const styleElement = this.ownerDocument.createElement("style");
          styleElement.innerHTML = defaultStyle;
          styleElement.setAttribute("data-paper-shader", "");
          this.ownerDocument.head.prepend(styleElement);
        }
        const canvasElement = this.ownerDocument.createElement("canvas");
        this.canvasElement = canvasElement;
        this.parentElement.prepend(canvasElement);
        this.fragmentShader = fragmentShader;
        this.providedUniforms = uniforms;
        this.mipmaps = mipmaps;
        this.currentFrame = frame;
        this.minPixelRatio = minPixelRatio;
        this.maxPixelCount = maxPixelCount;
        const gl = canvasElement.getContext("webgl2", webGlContextAttributes);
        if (!gl) {
          throw new Error("Paper Shaders: WebGL is not supported in this browser");
        }
        this.gl = gl;
        this.initProgram();
        this.setupPositionAttribute();
        this.setupUniforms();
        this.setUniformValues(this.providedUniforms);
        this.setupResizeObserver();
        visualViewport?.addEventListener("resize", this.handleVisualViewportChange);
        this.setupIntersectionObserver();
        this.setSpeed(speed);
        this.parentElement.setAttribute("data-paper-shader", "");
        this.parentElement.paperShaderMount = this;
        this.ownerDocument.addEventListener("visibilitychange", this.handleDocumentVisibilityChange);
      }
      initProgram = () => {
        const program = createProgram(this.gl, vertexShaderSource, this.fragmentShader);
        if (!program) return;
        this.program = program;
      };
      setupPositionAttribute = () => {
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
      };
      setupUniforms = () => {
        const uniformLocations = {
          u_time: this.gl.getUniformLocation(this.program, "u_time"),
          u_pixelRatio: this.gl.getUniformLocation(this.program, "u_pixelRatio"),
          u_resolution: this.gl.getUniformLocation(this.program, "u_resolution")
        };
        Object.entries(this.providedUniforms).forEach(([key, value]) => {
          uniformLocations[key] = this.gl.getUniformLocation(this.program, key);
          if (value instanceof HTMLImageElement) {
            const aspectRatioUniformName = `${key}AspectRatio`;
            uniformLocations[aspectRatioUniformName] = this.gl.getUniformLocation(this.program, aspectRatioUniformName);
          }
        });
        this.uniformLocations = uniformLocations;
      };
      /**
       * The scale that we should render at.
       * - Used to target 2x rendering even on 1x screens for better antialiasing
       * - Prevents the virtual resolution from going beyond the maximum resolution
       * - Accounts for the page zoom level so we render in physical device pixels rather than CSS pixels
       */
      renderScale = 1;
      parentWidth = 0;
      parentHeight = 0;
      parentDevicePixelWidth = 0;
      parentDevicePixelHeight = 0;
      devicePixelsSupported = false;
      intersectionObserver = null;
      isInViewport = true;
      resizeObserver = null;
      setupResizeObserver = () => {
        this.resizeObserver = new ResizeObserver(([entry]) => {
          if (entry?.borderBoxSize[0]) {
            const physicalPixelSize = entry.devicePixelContentBoxSize?.[0];
            if (physicalPixelSize !== void 0) {
              this.devicePixelsSupported = true;
              this.parentDevicePixelWidth = physicalPixelSize.inlineSize;
              this.parentDevicePixelHeight = physicalPixelSize.blockSize;
            }
            this.parentWidth = entry.borderBoxSize[0].inlineSize;
            this.parentHeight = entry.borderBoxSize[0].blockSize;
          }
          this.handleResize();
        });
        this.resizeObserver.observe(this.parentElement);
      };
      setupIntersectionObserver = () => {
        const view = this.ownerDocument.defaultView;
        if (!view?.IntersectionObserver) return;
        this.intersectionObserver = new view.IntersectionObserver(([entry]) => {
          this.isInViewport = entry?.isIntersecting ?? true;
          this.updateCurrentSpeed();
        });
        this.intersectionObserver.observe(this.parentElement);
      };
      // Visual viewport resize handler, mainly used to react to browser zoom changes.
      // Resize observer by itself does not react to pinch zoom, and although it usually
      // reacts to classic browser zoom, it's not guaranteed in edge cases.
      // Since timing between visual viewport changes and resize observer is complex
      // and because we'd like to know the device pixel sizes of elements, we just restart
      // the observer to get a guaranteed fresh callback regardless if it would have triggered or not.
      handleVisualViewportChange = () => {
        this.resizeObserver?.disconnect();
        this.setupResizeObserver();
      };
      /** Resize handler for when the container div changes size or the max pixel count changes and we want to resize our canvas to match */
      handleResize = () => {
        let targetPixelWidth = 0;
        let targetPixelHeight = 0;
        const dpr = Math.max(1, window.devicePixelRatio);
        const pinchZoom = visualViewport?.scale ?? 1;
        if (this.devicePixelsSupported) {
          const scaleToMeetMinPixelRatio = Math.max(1, this.minPixelRatio / dpr);
          targetPixelWidth = this.parentDevicePixelWidth * scaleToMeetMinPixelRatio * pinchZoom;
          targetPixelHeight = this.parentDevicePixelHeight * scaleToMeetMinPixelRatio * pinchZoom;
        } else {
          let targetRenderScale = Math.max(dpr, this.minPixelRatio) * pinchZoom;
          if (this.isSafari) {
            const zoomLevel = bestGuessBrowserZoom(this.ownerDocument);
            targetRenderScale *= Math.max(1, zoomLevel);
          }
          targetPixelWidth = Math.round(this.parentWidth) * targetRenderScale;
          targetPixelHeight = Math.round(this.parentHeight) * targetRenderScale;
        }
        const maxPixelCountHeadroom = Math.sqrt(this.maxPixelCount) / Math.sqrt(targetPixelWidth * targetPixelHeight);
        const scaleToMeetMaxPixelCount = Math.min(1, maxPixelCountHeadroom);
        const newWidth = Math.round(targetPixelWidth * scaleToMeetMaxPixelCount);
        const newHeight = Math.round(targetPixelHeight * scaleToMeetMaxPixelCount);
        const newRenderScale = newWidth / Math.round(this.parentWidth);
        if (this.canvasElement.width !== newWidth || this.canvasElement.height !== newHeight || this.renderScale !== newRenderScale) {
          this.renderScale = newRenderScale;
          this.canvasElement.width = newWidth;
          this.canvasElement.height = newHeight;
          this.resolutionChanged = true;
          this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
          this.render(performance.now());
        }
      };
      render = (currentTime) => {
        if (this.hasBeenDisposed) return;
        if (this.program === null) {
          console.warn("Tried to render before program or gl was initialized");
          return;
        }
        const dt = currentTime - this.lastRenderTime;
        this.lastRenderTime = currentTime;
        if (this.currentSpeed !== 0) {
          this.currentFrame += dt * this.currentSpeed;
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.useProgram(this.program);
        this.gl.uniform1f(this.uniformLocations.u_time, this.currentFrame * 1e-3);
        if (this.resolutionChanged) {
          this.gl.uniform2f(this.uniformLocations.u_resolution, this.gl.canvas.width, this.gl.canvas.height);
          this.gl.uniform1f(this.uniformLocations.u_pixelRatio, this.renderScale);
          this.resolutionChanged = false;
        }
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        if (this.currentSpeed !== 0) {
          this.requestRender();
        } else {
          this.rafId = null;
        }
      };
      requestRender = () => {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(this.render);
      };
      /** Creates a texture from an image and sets it into a uniform value */
      setTextureUniform = (uniformName, image) => {
        if (!image.complete || image.naturalWidth === 0) {
          throw new Error(`Paper Shaders: image for uniform ${uniformName} must be fully loaded`);
        }
        const existingTexture = this.textures.get(uniformName);
        if (existingTexture) {
          this.gl.deleteTexture(existingTexture);
        }
        if (!this.textureUnitMap.has(uniformName)) {
          this.textureUnitMap.set(uniformName, this.textureUnitMap.size);
        }
        const textureUnit = this.textureUnitMap.get(uniformName);
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        if (this.mipmaps.includes(uniformName)) {
          this.gl.generateMipmap(this.gl.TEXTURE_2D);
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        }
        const error2 = this.gl.getError();
        if (error2 !== this.gl.NO_ERROR || texture === null) {
          console.error("Paper Shaders: WebGL error when uploading texture:", error2);
          return;
        }
        this.textures.set(uniformName, texture);
        const location2 = this.uniformLocations[uniformName];
        if (location2) {
          this.gl.uniform1i(location2, textureUnit);
          const aspectRatioUniformName = `${uniformName}AspectRatio`;
          const aspectRatioLocation = this.uniformLocations[aspectRatioUniformName];
          if (aspectRatioLocation) {
            const aspectRatio = image.naturalWidth / image.naturalHeight;
            this.gl.uniform1f(aspectRatioLocation, aspectRatio);
          }
        }
      };
      /** Utility: recursive equality test for all the uniforms */
      areUniformValuesEqual = (a, b) => {
        if (a === b) return true;
        if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
          return a.every((val, i) => this.areUniformValuesEqual(val, b[i]));
        }
        return false;
      };
      /** Sets the provided uniform values into the WebGL program, can be a partial list of uniforms that have changed */
      setUniformValues = (updatedUniforms) => {
        this.gl.useProgram(this.program);
        Object.entries(updatedUniforms).forEach(([key, value]) => {
          let cacheValue = value;
          if (value instanceof HTMLImageElement) {
            cacheValue = `${value.src.slice(0, 200)}|${value.naturalWidth}x${value.naturalHeight}`;
          }
          if (this.areUniformValuesEqual(this.uniformCache[key], cacheValue)) return;
          this.uniformCache[key] = cacheValue;
          const location2 = this.uniformLocations[key];
          if (!location2) {
            console.warn(`Uniform location for ${key} not found`);
            return;
          }
          if (value instanceof HTMLImageElement) {
            this.setTextureUniform(key, value);
          } else if (Array.isArray(value)) {
            let flatArray = null;
            let valueLength = null;
            if (value[0] !== void 0 && Array.isArray(value[0])) {
              const firstChildLength = value[0].length;
              if (value.every((arr) => arr.length === firstChildLength)) {
                flatArray = value.flat();
                valueLength = firstChildLength;
              } else {
                console.warn(`All child arrays must be the same length for ${key}`);
                return;
              }
            } else {
              flatArray = value;
              valueLength = flatArray.length;
            }
            switch (valueLength) {
              case 2:
                this.gl.uniform2fv(location2, flatArray);
                break;
              case 3:
                this.gl.uniform3fv(location2, flatArray);
                break;
              case 4:
                this.gl.uniform4fv(location2, flatArray);
                break;
              case 9:
                this.gl.uniformMatrix3fv(location2, false, flatArray);
                break;
              case 16:
                this.gl.uniformMatrix4fv(location2, false, flatArray);
                break;
              default:
                console.warn(`Unsupported uniform array length: ${valueLength}`);
            }
          } else if (typeof value === "number") {
            this.gl.uniform1f(location2, value);
          } else if (typeof value === "boolean") {
            this.gl.uniform1i(location2, value ? 1 : 0);
          } else {
            console.warn(`Unsupported uniform type for ${key}: ${typeof value}`);
          }
        });
      };
      /** Gets the current total animation time from 0ms */
      getCurrentFrame = () => {
        return this.currentFrame;
      };
      /** Set a frame to get a deterministic result, frames are literally just milliseconds from zero since the animation started */
      setFrame = (newFrame) => {
        this.currentFrame = newFrame;
        this.lastRenderTime = performance.now();
        this.render(performance.now());
      };
      /** Set an animation speed (or 0 to stop animation) */
      setSpeed = (newSpeed = 1) => {
        this.speed = newSpeed;
        this.updateCurrentSpeed();
      };
      /** Apply the target speed, pausing (0) while the tab is hidden or the element is out of the viewport */
      updateCurrentSpeed = () => {
        this.setCurrentSpeed(this.ownerDocument.hidden || !this.isInViewport ? 0 : this.speed);
      };
      setCurrentSpeed = (newSpeed) => {
        this.currentSpeed = newSpeed;
        if (this.rafId === null && newSpeed !== 0) {
          this.lastRenderTime = performance.now();
          this.rafId = requestAnimationFrame(this.render);
        }
        if (this.rafId !== null && newSpeed === 0) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      };
      /** Set the maximum pixel count for the shader, this will limit the number of pixels that will be rendered */
      setMaxPixelCount = (newMaxPixelCount = DEFAULT_MAX_PIXEL_COUNT) => {
        this.maxPixelCount = newMaxPixelCount;
        this.handleResize();
      };
      /** Set the minimum pixel ratio for the shader */
      setMinPixelRatio = (newMinPixelRatio = 2) => {
        this.minPixelRatio = newMinPixelRatio;
        this.handleResize();
      };
      /** Update the uniforms that are provided by the outside shader, can be a partial set with only the uniforms that have changed */
      setUniforms = (newUniforms) => {
        this.setUniformValues(newUniforms);
        this.providedUniforms = { ...this.providedUniforms, ...newUniforms };
        this.render(performance.now());
      };
      handleDocumentVisibilityChange = () => {
        this.updateCurrentSpeed();
      };
      /** Dispose of the shader mount, cleaning up all of the WebGL resources */
      dispose = () => {
        this.hasBeenDisposed = true;
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.gl && this.program) {
          this.textures.forEach((texture) => {
            this.gl.deleteTexture(texture);
          });
          this.textures.clear();
          this.gl.deleteProgram(this.program);
          this.program = null;
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
          this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
          this.gl.getError();
        }
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver = null;
        }
        if (this.intersectionObserver) {
          this.intersectionObserver.disconnect();
          this.intersectionObserver = null;
        }
        visualViewport?.removeEventListener("resize", this.handleVisualViewportChange);
        this.ownerDocument.removeEventListener("visibilitychange", this.handleDocumentVisibilityChange);
        this.uniformLocations = {};
        this.canvasElement.remove();
        delete this.parentElement.paperShaderMount;
      };
    };
    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }
    function createProgram(gl, vertexShaderSource2, fragmentShaderSource) {
      const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
      const precision = format ? format.precision : null;
      if (precision && precision < 23) {
        vertexShaderSource2 = vertexShaderSource2.replace(/precision\s+(lowp|mediump)\s+float;/g, "precision highp float;");
        fragmentShaderSource = fragmentShaderSource.replace(/precision\s+(lowp|mediump)\s+float/g, "precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g, "$1 highp $3");
      }
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource2);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vertexShader || !fragmentShader) return null;
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
      }
      gl.detachShader(program, vertexShader);
      gl.detachShader(program, fragmentShader);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return program;
    }
    var defaultStyle = `@layer paper-shaders {
    :where([data-paper-shader]) {
      isolation: isolate;
      position: relative;
  
      & canvas {
        contain: strict;
        display: block;
        position: absolute;
        inset: 0;
        z-index: -1;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        corner-shape: inherit;
      }
    }
  }`;
    function isSafari() {
      const ua = navigator.userAgent.toLowerCase();
      return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
    }
    function bestGuessBrowserZoom(doc) {
      const viewportScale = visualViewport?.scale ?? 1;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const scrollbarWidth = window.innerWidth - doc.documentElement.clientWidth;
      const innerWidth = viewportScale * viewportWidth + scrollbarWidth;
      const ratio = outerWidth / innerWidth;
      const zoomPercentageRounded = Math.round(100 * ratio);
      if (zoomPercentageRounded % 5 === 0) {
        return zoomPercentageRounded / 100;
      }
      if (zoomPercentageRounded === 33) {
        return 1 / 3;
      }
      if (zoomPercentageRounded === 67) {
        return 2 / 3;
      }
      if (zoomPercentageRounded === 133) {
        return 4 / 3;
      }
      return ratio;
    }
  
    // src/render/folia/vendor/paper-shaders/dist/shader-sizing.js
    var defaultObjectSizing = {
      fit: "contain",
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      originX: 0.5,
      originY: 0.5,
      worldWidth: 0,
      worldHeight: 0
    };
    var defaultPatternSizing = {
      fit: "none",
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      originX: 0.5,
      originY: 0.5,
      worldWidth: 0,
      worldHeight: 0
    };
    var ShaderFitOptions = {
      none: 0,
      contain: 1,
      cover: 2
    };
  
    // src/render/folia/vendor/paper-shaders/dist/shader-utils.js
    var declarePI = `
  #define TWO_PI 6.28318530718
  #define PI 3.14159265358979323846
  `;
    var rotation2 = `
  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }
  `;
    var proceduralHash11 = `
    float hash11(float p) {
      p = fract(p * 0.3183099) + 0.1;
      p *= p + 19.19;
      return fract(p * p);
    }
  `;
    var proceduralHash21 = `
    float hash21(vec2 p) {
      p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
  `;
    var textureRandomizerR = `
    float randomR(vec2 p) {
      vec2 uv = floor(p) / 100. + .5;
      return texture(u_noiseTexture, fract(uv)).r;
    }
  `;
    var simplexNoise = `
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
      + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  `;
    var fiberNoise = `
  float fiberRandom(vec2 p) {
    vec2 uv = floor(p) / 100.;
    return texture(u_noiseTexture, fract(uv)).b;
  }
  
  float fiberValueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = fiberRandom(i);
    float b = fiberRandom(i + vec2(1.0, 0.0));
    float c = fiberRandom(i + vec2(0.0, 1.0));
    float d = fiberRandom(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }
  
  float fiberNoiseFbm(in vec2 n, vec2 seedOffset) {
    float total = 0.0, amplitude = 1.;
    for (int i = 0; i < 4; i++) {
      n = rotate(n, .7);
      total += fiberValueNoise(n + seedOffset) * amplitude;
      n *= 2.;
      amplitude *= 0.6;
    }
    return total;
  }
  
  float fiberNoise(vec2 uv, vec2 seedOffset) {
    float epsilon = 0.001;
    float n1 = fiberNoiseFbm(uv + vec2(epsilon, 0.0), seedOffset);
    float n2 = fiberNoiseFbm(uv - vec2(epsilon, 0.0), seedOffset);
    float n3 = fiberNoiseFbm(uv + vec2(0.0, epsilon), seedOffset);
    float n4 = fiberNoiseFbm(uv - vec2(0.0, epsilon), seedOffset);
    return length(vec2(n1 - n2, n3 - n4)) / (2.0 * epsilon);
  }
  `;
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/mesh-gradient.js
    var meshGradientMeta = {
      maxColorCount: 10
    };
    var meshGradientFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform float u_time;
  
  uniform vec4 u_colors[${meshGradientMeta.maxColorCount}];
  uniform float u_colorsCount;
  
  uniform float u_distortion;
  uniform float u_swirl;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  
  in vec2 v_objectUV;
  out vec4 fragColor;
  
  ${declarePI}
  ${rotation2}
  ${proceduralHash21}
  
  float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }
  
  float noise(vec2 n, vec2 seedOffset) {
    return valueNoise(n + seedOffset);
  }
  
  vec2 getPosition(int i, float t) {
    float a = float(i) * .37;
    float b = .6 + fract(float(i) / 3.) * .9;
    float c = .8 + fract(float(i + 1) / 4.);
  
    float x = sin(t * b + a);
    float y = cos(t * c + a * 1.5);
  
    return .5 + .5 * vec2(x, y);
  }
  
  void main() {
    vec2 uv = v_objectUV;
    uv += .5;
    vec2 grainUV = uv * 1000.;
  
    float grain = noise(grainUV, vec2(0.));
    float mixerGrain = .4 * u_grainMixer * (grain - .5);
  
    const float firstFrameOffset = 41.5;
    float t = .5 * (u_time + firstFrameOffset);
  
    float radius = smoothstep(0., 1., length(uv - .5));
    float center = 1. - radius;
    for (float i = 1.; i <= 2.; i++) {
      uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
      uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
    }
  
    vec2 uvRotated = uv;
    uvRotated -= vec2(.5);
    float angle = 3. * u_swirl * radius;
    uvRotated = rotate(uvRotated, -angle);
    uvRotated += vec2(.5);
  
    vec3 color = vec3(0.);
    float opacity = 0.;
    float totalWeight = 0.;
  
    for (int i = 0; i < ${meshGradientMeta.maxColorCount}; i++) {
      if (i >= int(u_colorsCount)) break;
  
      vec2 pos = getPosition(i, t) + mixerGrain;
      vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
      float opacityFraction = u_colors[i].a;
  
      float dist = length(uvRotated - pos);
  
      dist = pow(dist, 3.5);
      float weight = 1. / (dist + 1e-3);
      color += colorFraction * weight;
      opacity += opacityFraction * weight;
      totalWeight += weight;
    }
  
    color /= max(1e-4, totalWeight);
    opacity /= max(1e-4, totalWeight);
  
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);
  
    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);
  
    opacity += .5 * grainOverlayStrength;
    opacity = clamp(opacity, 0., 1.);
  
    fragColor = vec4(color, opacity);
  }
  `;
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/dithering.js
    var ditheringFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform float u_time;
  
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_originX;
  uniform float u_originY;
  uniform float u_worldWidth;
  uniform float u_worldHeight;
  uniform float u_fit;
  uniform float u_scale;
  uniform float u_rotation;
  uniform float u_offsetX;
  uniform float u_offsetY;
  
  uniform float u_pxSize;
  uniform vec4 u_colorBack;
  uniform vec4 u_colorFront;
  uniform float u_shape;
  uniform float u_type;
  
  out vec4 fragColor;
  
  ${simplexNoise}
  ${declarePI}
  ${proceduralHash11}
  ${proceduralHash21}
  
  float getSimplexNoise(vec2 uv, float t) {
    float noise = .5 * snoise(uv - vec2(0., .3 * t));
    noise += .5 * snoise(2. * uv + vec2(0., .32 * t));
  
    return noise;
  }
  
  const int bayer2x2[4] = int[4](0, 2, 3, 1);
  const int bayer4x4[16] = int[16](
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
  );
  
  const int bayer8x8[64] = int[64](
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
  );
  
  float getBayerValue(vec2 uv, int size) {
    ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
    int index = pos.y * size + pos.x;
  
    if (size == 2) {
      return float(bayer2x2[index]) / 4.0;
    } else if (size == 4) {
      return float(bayer4x4[index]) / 16.0;
    } else if (size == 8) {
      return float(bayer8x8[index]) / 64.0;
    }
    return 0.0;
  }
  
  
  void main() {
    float t = .5 * u_time;
  
    float pxSize = u_pxSize * u_pixelRatio;
    vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
    pxSizeUV /= pxSize;
    vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
    vec2 normalizedUV = canvasPixelizedUV / u_resolution;
  
    vec2 ditheringNoiseUV = canvasPixelizedUV;
    vec2 shapeUV = normalizedUV;
  
    vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
    vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
    givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
    float r = u_rotation * PI / 180.;
    mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
    vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);
  
    float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
    vec2 boxSize = vec2(
    (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
    (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
    );
    
    if (u_shape > 3.5) {
      vec2 objectBoxSize = vec2(0.);
      // fit = none
      objectBoxSize.x = min(boxSize.x, boxSize.y);
      if (u_fit == 1.) { // fit = contain
        objectBoxSize.x = min(u_resolution.x, u_resolution.y);
      } else if (u_fit == 2.) { // fit = cover
        objectBoxSize.x = max(u_resolution.x, u_resolution.y);
      }
      objectBoxSize.y = objectBoxSize.x;
      vec2 objectWorldScale = u_resolution.xy / objectBoxSize;
  
      shapeUV *= objectWorldScale;
      shapeUV += boxOrigin * (objectWorldScale - 1.);
      shapeUV += vec2(-u_offsetX, u_offsetY);
      shapeUV /= u_scale;
      shapeUV = graphicRotation * shapeUV;
    } else {
      vec2 patternBoxSize = vec2(0.);
      // fit = none
      patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
      float patternWorldNoFitBoxWidth = patternBoxSize.x;
      if (u_fit == 1.) { // fit = contain
        patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
      } else if (u_fit == 2.) { // fit = cover
        patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
      }
      patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
      vec2 patternWorldScale = u_resolution.xy / patternBoxSize;
  
      shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
      shapeUV += boxOrigin;
      shapeUV -= boxOrigin / patternWorldScale;
      shapeUV *= u_resolution.xy;
      shapeUV /= u_pixelRatio;
      if (u_fit > 0.) {
        shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
      }
      shapeUV /= u_scale;
      shapeUV = graphicRotation * shapeUV;
      shapeUV += boxOrigin / patternWorldScale;
      shapeUV -= boxOrigin;
      shapeUV += .5;
    }
  
    float shape = 0.;
    if (u_shape < 1.5) {
      // Simplex noise
      shapeUV *= .001;
  
      shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
      shape = smoothstep(0.3, 0.9, shape);
  
    } else if (u_shape < 2.5) {
      // Warp
      shapeUV *= .003;
  
      for (float i = 1.0; i < 6.0; i++) {
        shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
        shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
      }
  
      shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
      shape = smoothstep(0.02, 1., shape);
  
    } else if (u_shape < 3.5) {
      // Dots
      shapeUV *= .05;
  
      float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
      float rand = hash11(stripeIdx * 10.);
      rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
      shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
      shape = pow(abs(shape), 6.);
  
    } else if (u_shape < 4.5) {
      // Sine wave
      shapeUV *= 4.;
  
      float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
      shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);
  
    } else if (u_shape < 5.5) {
      // Ripple
  
      float dist = length(shapeUV);
      float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
      shape = waves;
  
    } else if (u_shape < 6.5) {
      // Swirl
  
      float l = length(shapeUV);
      float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
      float twist = 1.2;
      float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
      float mid = smoothstep(0., 1., pow(l, twist));
      shape = mix(0., fract(offset), mid);
  
    } else {
      // Sphere
      shapeUV *= 2.;
  
      float d = 1. - pow(length(shapeUV), 2.);
      vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
      vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
      shape = .5 + .5 * dot(lightPos, pos);
      shape *= step(0., d);
    }
  
  
    int type = int(floor(u_type));
    float dithering = 0.0;
  
    switch (type) {
      case 1: {
        dithering = step(hash21(ditheringNoiseUV), shape);
      } break;
      case 2:
      dithering = getBayerValue(pxSizeUV, 2);
      break;
      case 3:
      dithering = getBayerValue(pxSizeUV, 4);
      break;
      default :
      dithering = getBayerValue(pxSizeUV, 8);
      break;
    }
  
    dithering -= .5;
    float res = step(.5, shape + dithering);
  
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
  
    vec3 color = fgColor * res;
    float opacity = fgOpacity * res;
  
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
  
    fragColor = vec4(color, opacity);
  }
  `;
    var DitheringShapes = {
      simplex: 1,
      warp: 2,
      dots: 3,
      wave: 4,
      ripple: 5,
      swirl: 6,
      sphere: 7
    };
    var DitheringTypes = {
      "random": 1,
      "2x2": 2,
      "4x4": 3,
      "8x8": 4
    };
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/paper-texture.js
    var paperTextureFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  
  uniform vec4 u_colorFront;
  uniform vec4 u_colorBack;
  
  uniform sampler2D u_image;
  uniform float u_imageAspectRatio;
  
  uniform float u_contrast;
  uniform float u_roughness;
  uniform float u_fiber;
  uniform float u_fiberSize;
  uniform float u_crumples;
  uniform float u_crumpleSize;
  uniform float u_folds;
  uniform float u_foldCount;
  uniform float u_drops;
  uniform float u_seed;
  uniform float u_fade;
  
  uniform sampler2D u_noiseTexture;
  
  in vec2 v_imageUV;
  
  out vec4 fragColor;
  
  float getUvFrame(vec2 uv) {
    float aax = 2. * fwidth(uv.x);
    float aay = 2. * fwidth(uv.y);
  
    float left   = smoothstep(0., aax, uv.x);
    float right = 1. - smoothstep(1. - aax, 1., uv.x);
    float bottom = smoothstep(0., aay, uv.y);
    float top = 1. - smoothstep(1. - aay, 1., uv.y);
  
    return left * right * bottom * top;
  }
  
  ${declarePI}
  ${rotation2}
  ${textureRandomizerR}
  float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = randomR(i);
    float b = randomR(i + vec2(1.0, 0.0));
    float c = randomR(i + vec2(0.0, 1.0));
    float d = randomR(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }
  float fbm(vec2 n) {
    float total = 0.0, amplitude = .4;
    for (int i = 0; i < 3; i++) {
      total += valueNoise(n) * amplitude;
      n *= 1.99;
      amplitude *= 0.65;
    }
    return total;
  }
  
  
  float randomG(vec2 p) {
    vec2 uv = floor(p) / 50. + .5;
    return texture(u_noiseTexture, fract(uv)).g;
  }
  float roughness(vec2 p) {
    p *= .1;
    float o = 0.;
    for (float i = 0.; ++i < 4.; p *= 2.1) {
      vec4 w = vec4(floor(p), ceil(p));
      vec2 f = fract(p);
      o += mix(
      mix(randomG(w.xy), randomG(w.xw), f.y),
      mix(randomG(w.zy), randomG(w.zw), f.y),
      f.x);
      o += .2 / exp(2. * abs(sin(.2 * p.x + .5 * p.y)));
    }
    return o / 3.;
  }
  
  ${fiberNoise}
  
  vec2 randomGB(vec2 p) {
    vec2 uv = floor(p) / 50. + .5;
    return texture(u_noiseTexture, fract(uv)).gb;
  }
  float crumpledNoise(vec2 t, float pw) {
    vec2 p = floor(t);
    float wsum = 0.;
    float cl = 0.;
    for (int y = -1; y < 2; y += 1) {
      for (int x = -1; x < 2; x += 1) {
        vec2 b = vec2(float(x), float(y));
        vec2 q = b + p;
        vec2 q2 = q - floor(q / 8.) * 8.;
        vec2 c = q + randomGB(q2);
        vec2 r = c - t;
        float w = pow(smoothstep(0., 1., 1. - abs(r.x)), pw) * pow(smoothstep(0., 1., 1. - abs(r.y)), pw);
        cl += (.5 + .5 * sin((q2.x + q2.y * 5.) * 8.)) * w;
        wsum += w;
      }
    }
    return pow(wsum != 0.0 ? cl / wsum : 0.0, .5) * 2.;
  }
  float crumplesShape(vec2 uv) {
    return crumpledNoise(uv * .25, 16.) * crumpledNoise(uv * .5, 2.);
  }
  
  
  vec2 folds(vec2 uv) {
    vec3 pp = vec3(0.);
    float l = 9.;
    for (float i = 0.; i < 15.; i++) {
      if (i >= u_foldCount) break;
      vec2 rand = randomGB(vec2(i, i * u_seed));
      float an = rand.x * TWO_PI;
      vec2 p = vec2(cos(an), sin(an)) * rand.y;
      float dist = distance(uv, p);
      l = min(l, dist);
  
      if (l == dist) {
        pp.xy = (uv - p.xy);
        pp.z = dist;
      }
    }
    return mix(pp.xy, vec2(0.), pow(pp.z, .25));
  }
  
  float drops(vec2 uv) {
    vec2 iDropsUV = floor(uv);
    vec2 fDropsUV = fract(uv);
    float dropsMinDist = 1.;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 neighbor = vec2(float(i), float(j));
        vec2 offset = randomGB(iDropsUV + neighbor);
        offset = .5 + .5 * sin(10. * u_seed + TWO_PI * offset);
        vec2 pos = neighbor + offset - fDropsUV;
        float dist = length(pos);
        dropsMinDist = min(dropsMinDist, dropsMinDist*dist);
      }
    }
    return 1. - smoothstep(.05, .09, pow(dropsMinDist, .5));
  }
  
  float lst(float edge0, float edge1, float x) {
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }
  
  void main() {
  
    vec2 imageUV = v_imageUV;
    vec2 patternUV = v_imageUV - .5;
    patternUV = 5. * (patternUV * vec2(u_imageAspectRatio, 1.));
  
    vec2 roughnessUv = 1.5 * (gl_FragCoord.xy - .5 * u_resolution) / u_pixelRatio;
    float roughness = roughness(roughnessUv + vec2(1., 0.)) - roughness(roughnessUv - vec2(1., 0.));
  
    vec2 crumplesUV = fract(patternUV * .02 / u_crumpleSize - u_seed) * 32.;
    float crumples = u_crumples * (crumplesShape(crumplesUV + vec2(.05, 0.)) - crumplesShape(crumplesUV));
  
    vec2 fiberUV = 2. / u_fiberSize * patternUV;
    float fiber = fiberNoise(fiberUV, vec2(0.));
    fiber = .5 * u_fiber * (fiber - 1.);
  
    vec2 normal = vec2(0.);
    vec2 normalImage = vec2(0.);
  
    vec2 foldsUV = patternUV * .12;
    foldsUV = rotate(foldsUV, 4. * u_seed);
    vec2 w = folds(foldsUV);
    foldsUV = rotate(foldsUV + .007 * cos(u_seed), .01 * sin(u_seed));
    vec2 w2 = folds(foldsUV);
  
    float drops = u_drops * drops(patternUV * 2.);
  
    float fade = u_fade * fbm(.17 * patternUV + 10. * u_seed);
    fade = clamp(8. * fade * fade * fade, 0., 1.);
  
    w = mix(w, vec2(0.), fade);
    w2 = mix(w2, vec2(0.), fade);
    crumples = mix(crumples, 0., fade);
    drops = mix(drops, 0., fade);
    fiber *= mix(1., .5, fade);
    roughness *= mix(1., .5, fade);
  
    normal.xy += u_folds * min(5. * u_contrast, 1.) * 4. * max(vec2(0.), w + w2);
    normalImage.xy += u_folds * 2. * w;
  
    normal.xy += crumples;
    normalImage.xy += 1.5 * crumples;
  
    normal.xy += 3. * drops;
    normalImage.xy += .2 * drops;
  
    normal.xy += u_roughness * 1.5 * roughness;
    normal.xy += fiber;
  
    normalImage += u_roughness * .75 * roughness;
    normalImage += .2 * fiber;
  
    vec3 lightPos = vec3(1., 2., 1.);
    float res = dot(normalize(vec3(normal, 9.5 - 9. * pow(u_contrast, .1))), normalize(lightPos));
  
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
  
    imageUV += .02 * normalImage;
    float frame = getUvFrame(imageUV);
    vec4 image = texture(u_image, imageUV);
    image.rgb += .6 * pow(u_contrast, .4) * (res - .7);
  
    frame *= image.a;
  
    vec3 color = fgColor * res;
    float opacity = fgOpacity * res;
  
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
    opacity = mix(opacity, 1., frame);
  
    color -= .007 * drops;
  
    color.rgb = mix(color, image.rgb, frame);
  
    fragColor = vec4(color, opacity);
  }
  `;
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/fluted-glass.js
    var flutedGlassFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_rotation;
  
  uniform vec4 u_colorBack;
  uniform vec4 u_colorShadow;
  uniform vec4 u_colorHighlight;
  
  uniform sampler2D u_image;
  uniform float u_imageAspectRatio;
  
  uniform float u_size;
  uniform float u_shadows;
  uniform float u_angle;
  uniform float u_stretch;
  uniform float u_shape;
  uniform float u_distortion;
  uniform float u_highlights;
  uniform float u_distortionShape;
  uniform float u_shift;
  uniform float u_blur;
  uniform float u_edges;
  uniform float u_marginLeft;
  uniform float u_marginRight;
  uniform float u_marginTop;
  uniform float u_marginBottom;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  
  in vec2 v_imageUV;
  
  out vec4 fragColor;
  
  ${declarePI}
  ${rotation2}
  ${proceduralHash21}
  
  float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }
  
  float getUvFrame(vec2 uv, float softness) {
    float aax = 2. * fwidth(uv.x);
    float aay = 2. * fwidth(uv.y);
    float left   = smoothstep(0., aax + softness, uv.x);
    float right  = 1. - smoothstep(1. - softness - aax, 1., uv.x);
    float bottom = smoothstep(0., aay + softness, uv.y);
    float top    = 1. - smoothstep(1. - softness - aay, 1., uv.y);
    return left * right * bottom * top;
  }
  
  const int MAX_RADIUS = 50;
  vec4 samplePremultiplied(sampler2D tex, vec2 uv) {
    vec4 c = texture(tex, uv);
    c.rgb *= c.a;
    return c;
  }
  vec4 getBlur(sampler2D tex, vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
    if (sigma <= .5) return texture(tex, uv);
    int radius = int(min(float(MAX_RADIUS), ceil(3.0 * sigma)));
  
    float twoSigma2 = 2.0 * sigma * sigma;
    float gaussianNorm = 1.0 / sqrt(TWO_PI * sigma * sigma);
  
    vec4 sum = samplePremultiplied(tex, uv) * gaussianNorm;
    float weightSum = gaussianNorm;
  
    for (int i = 1; i <= MAX_RADIUS; i++) {
      if (i > radius) break;
  
      float x = float(i);
      float w = exp(-(x * x) / twoSigma2) * gaussianNorm;
  
      vec2 offset = dir * texelSize * x;
      vec4 s1 = samplePremultiplied(tex, uv + offset);
      vec4 s2 = samplePremultiplied(tex, uv - offset);
  
      sum += (s1 + s2) * w;
      weightSum += 2.0 * w;
    }
  
    vec4 result = sum / weightSum;
    if (result.a > 0.) {
      result.rgb /= result.a;
    }
  
    return result;
  }
  
  vec2 rotateAspect(vec2 p, float a, float aspect) {
    p.x *= aspect;
    p = rotate(p, a);
    p.x /= aspect;
    return p;
  }
  
  float smoothFract(float x) {
    float f = fract(x);
    float w = fwidth(x);
  
    float edge = abs(f - 0.5) - 0.5;
    float band = smoothstep(-w, w, edge);
  
    return mix(f, 1.0 - f, band);
  }
  
  void main() {
  
    float patternRotation = -u_angle * PI / 180.;
    float patternSize = mix(200., 5., u_size);
  
    vec2 uv = v_imageUV;
  
    vec2 uvMask = gl_FragCoord.xy / u_resolution.xy;
    vec2 sw = vec2(.005);
    vec4 margins = vec4(u_marginLeft, u_marginTop, u_marginRight, u_marginBottom);
    float mask =
    smoothstep(margins[0], margins[0] + sw.x, uvMask.x + sw.x) *
    smoothstep(margins[2], margins[2] + sw.x, 1.0 - uvMask.x + sw.x) *
    smoothstep(margins[1], margins[1] + sw.y, uvMask.y + sw.y) *
    smoothstep(margins[3], margins[3] + sw.y, 1.0 - uvMask.y + sw.y);
    float maskOuter =
    smoothstep(margins[0] - sw.x, margins[0], uvMask.x + sw.x) *
    smoothstep(margins[2] - sw.x, margins[2], 1.0 - uvMask.x + sw.x) *
    smoothstep(margins[1] - sw.y, margins[1], uvMask.y + sw.y) *
    smoothstep(margins[3] - sw.y, margins[3], 1.0 - uvMask.y + sw.y);
    float maskStroke = maskOuter - mask;
    float maskInner =
    smoothstep(margins[0] - 2. * sw.x, margins[0], uvMask.x) *
    smoothstep(margins[2] - 2. * sw.x, margins[2], 1.0 - uvMask.x) *
    smoothstep(margins[1] - 2. * sw.y, margins[1], uvMask.y) *
    smoothstep(margins[3] - 2. * sw.y, margins[3], 1.0 - uvMask.y);
    float maskStrokeInner = maskInner - mask;
  
    uv -= .5;
    uv *= patternSize;
    uv = rotateAspect(uv, patternRotation, u_imageAspectRatio);
  
    float curve = 0.;
    float patternY = uv.y / u_imageAspectRatio;
    if (u_shape > 4.5) {
      // pattern
      curve = .5 + .5 * sin(.5 * PI * uv.x) * cos(.5 * PI * patternY);
    } else if (u_shape > 3.5) {
      // zigzag
      curve = 10. * abs(fract(.1 * patternY) - .5);
    } else if (u_shape > 2.5) {
      // wave
      curve = 4. * sin(.23 * patternY);
    } else if (u_shape > 1.5) {
      // lines irregular
      curve = .5 + .5 * sin(.5 * uv.x) * sin(1.7 * uv.x);
    } else {
      // lines
    }
  
    vec2 UvToFract = uv + curve;
    vec2 fractOrigUV = fract(uv);
    vec2 floorOrigUV = floor(uv);
  
    float x = smoothFract(UvToFract.x);
    float xNonSmooth = fract(UvToFract.x) + .0001;
  
    float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));
    highlightsWidth += 2. * maskStrokeInner;
    float highlights = smoothstep(0., highlightsWidth, xNonSmooth);
    highlights *= smoothstep(1., 1. - highlightsWidth, xNonSmooth);
    highlights = 1. - highlights;
    highlights *= u_highlights;
    highlights = clamp(highlights, 0., 1.);
    highlights *= mask;
  
    float shadows = pow(x, 1.3);
    float distortion = 0.;
    float fadeX = 1.;
    float frameFade = 0.;
  
    float aa = fwidth(xNonSmooth);
    aa = max(aa, fwidth(uv.x));
    aa = max(aa, fwidth(UvToFract.x));
    aa = max(aa, .0001);
  
    if (u_distortionShape == 1.) {
      distortion = -pow(1.5 * x, 3.);
      distortion += (.5 - u_shift);
  
      frameFade = pow(1.5 * x, 3.);
      aa = max(.2, aa);
      aa += mix(.2, 0., u_size);
      fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
      distortion = mix(.5, distortion, fadeX);
    } else if (u_distortionShape == 2.) {
      distortion = 2. * pow(x, 2.);
      distortion -= (.5 + u_shift);
  
      frameFade = pow(abs(x - .5), 4.);
      aa = max(.2, aa);
      aa += mix(.2, 0., u_size);
      fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
      distortion = mix(.5, distortion, fadeX);
      frameFade = mix(1., frameFade, .5 * fadeX);
    } else if (u_distortionShape == 3.) {
      distortion = pow(2. * (xNonSmooth - .5), 6.);
      distortion -= .25;
      distortion -= u_shift;
  
      frameFade = 1. - 2. * pow(abs(x - .4), 2.);
      aa = .15;
      aa += mix(.1, 0., u_size);
      fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
      frameFade = mix(1., frameFade, fadeX);
  
    } else if (u_distortionShape == 4.) {
      x = xNonSmooth;
      distortion = sin((x + .25) * TWO_PI);
      shadows = .5 + .5 * asin(distortion) / (.5 * PI);
      distortion *= .5;
      distortion -= u_shift;
      frameFade = .5 + .5 * sin(x * TWO_PI);
    } else if (u_distortionShape == 5.) {
      distortion -= pow(abs(x), .2) * x;
      distortion += .33;
      distortion -= 3. * u_shift;
      distortion *= .33;
  
      frameFade = .3 * (smoothstep(.0, 1., x));
      shadows = pow(x, 2.5);
  
      aa = max(.1, aa);
      aa += mix(.1, 0., u_size);
      fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
      distortion *= fadeX;
    }
  
    vec2 dudx = dFdx(v_imageUV);
    vec2 dudy = dFdy(v_imageUV);
    vec2 grainUV = v_imageUV - .5;
    grainUV *= (.8 / vec2(length(dudx), length(dudy)));
    grainUV += .5;
    float grain = valueNoise(grainUV);
    grain = smoothstep(.4, .7, grain);
    grain *= u_grainMixer;
    distortion = mix(distortion, 0., grain);
  
    shadows = min(shadows, 1.);
    shadows += maskStrokeInner;
    shadows *= mask;
    shadows = min(shadows, 1.);
    shadows *= pow(u_shadows, 2.);
    shadows = clamp(shadows, 0., 1.);
  
    distortion *= 3. * u_distortion;
    frameFade *= u_distortion;
  
    fractOrigUV.x += distortion;
    floorOrigUV = rotateAspect(floorOrigUV, -patternRotation, u_imageAspectRatio);
    fractOrigUV = rotateAspect(fractOrigUV, -patternRotation, u_imageAspectRatio);
  
    uv = (floorOrigUV + fractOrigUV) / patternSize;
    uv += pow(maskStroke, 4.);
  
    uv += vec2(.5);
  
    uv = mix(v_imageUV, uv, smoothstep(0., .7, mask));
    float blur = mix(0., 50., u_blur);
    blur = mix(0., blur, smoothstep(.5, 1., mask));
  
    float edgeDistortion = mix(.0, .04, u_edges);
    edgeDistortion += .06 * frameFade * u_edges;
    edgeDistortion *= mask;
    float frame = getUvFrame(uv, edgeDistortion);
  
    float stretch = 1. - smoothstep(0., .5, xNonSmooth) * smoothstep(1., 1. - .5, xNonSmooth);
    stretch = pow(stretch, 2.);
    stretch *= mask;
    stretch *= getUvFrame(uv, .1 + .05 * mask * frameFade);
    uv.y = mix(uv.y, .5, u_stretch * stretch);
  
    vec4 image = getBlur(u_image, uv, 1. / u_resolution / u_pixelRatio, vec2(0., 1.), blur);
    image.rgb *= image.a;
    vec4 backColor = u_colorBack;
    backColor.rgb *= backColor.a;
    vec4 highlightColor = u_colorHighlight;
    highlightColor.rgb *= highlightColor.a;
    vec4 shadowColor = u_colorShadow;
  
    vec3 color = highlightColor.rgb * highlights;
    float opacity = highlightColor.a * highlights;
  
    shadows = mix(shadows * shadowColor.a, 0., highlights);
    color = mix(color, shadowColor.rgb * shadowColor.a, .5 * shadows);
    color += .5 * pow(shadows, .5) * shadowColor.rgb;
    opacity += shadows;
    color = clamp(color, vec3(0.), vec3(1.));
    opacity = clamp(opacity, 0., 1.);
  
    color += image.rgb * (1. - opacity) * frame;
    opacity += image.a * (1. - opacity) * frame;
  
    color += backColor.rgb * (1. - opacity);
    opacity += backColor.a * (1. - opacity);
  
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);
  
    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    grainOverlayStrength *= mask;
    color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);
  
    opacity += .5 * grainOverlayStrength;
    opacity = clamp(opacity, 0., 1.);
  
    fragColor = vec4(color, opacity);
  }
  `;
    var GlassGridShapes = {
      lines: 1,
      linesIrregular: 2,
      wave: 3,
      zigzag: 4,
      pattern: 5
    };
    var GlassDistortionShapes = {
      prism: 1,
      lens: 2,
      contour: 3,
      cascade: 4,
      flat: 5
    };
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/image-dithering.js
    var imageDitheringFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_originX;
  uniform float u_originY;
  uniform float u_worldWidth;
  uniform float u_worldHeight;
  uniform float u_fit;
  
  uniform float u_scale;
  uniform float u_rotation;
  uniform float u_offsetX;
  uniform float u_offsetY;
  
  uniform vec4 u_colorFront;
  uniform vec4 u_colorBack;
  uniform vec4 u_colorHighlight;
  
  uniform sampler2D u_image;
  uniform float u_imageAspectRatio;
  
  uniform float u_type;
  uniform float u_pxSize;
  uniform bool u_originalColors;
  uniform bool u_inverted;
  uniform float u_colorSteps;
  
  out vec4 fragColor;
  
  
  ${proceduralHash21}
  ${declarePI}
  
  float getUvFrame(vec2 uv, vec2 pad) {
    float aa = 0.0001;
  
    float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
    float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
    float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
    float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);
  
    return left * right * bottom * top;
  }
  
  vec2 getImageUV(vec2 uv) {
    vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
    float r = u_rotation * PI / 180.;
    mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
    vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);
  
    vec2 imageBoxSize;
    if (u_fit == 1.) { // contain
      imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
    } else if (u_fit == 2.) { // cover
      imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
    } else {
      imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
    }
    imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
    vec2 imageBoxScale = u_resolution.xy / imageBoxSize;
  
    vec2 imageUV = uv;
    imageUV *= imageBoxScale;
    imageUV += boxOrigin * (imageBoxScale - 1.);
    imageUV += graphicOffset;
    imageUV /= u_scale;
    imageUV.x *= u_imageAspectRatio;
    imageUV = graphicRotation * imageUV;
    imageUV.x /= u_imageAspectRatio;
  
    imageUV += .5;
    imageUV.y = 1. - imageUV.y;
  
    return imageUV;
  }
  
  const int bayer2x2[4] = int[4](0, 2, 3, 1);
  const int bayer4x4[16] = int[16](
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
  );
  
  const int bayer8x8[64] = int[64](
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
  );
  
  float getBayerValue(vec2 uv, int size) {
    ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
    int index = pos.y * size + pos.x;
  
    if (size == 2) {
      return float(bayer2x2[index]) / 4.0;
    } else if (size == 4) {
      return float(bayer4x4[index]) / 16.0;
    } else if (size == 8) {
      return float(bayer8x8[index]) / 64.0;
    }
    return 0.0;
  }
  
  
  void main() {
  
    float pxSize = u_pxSize * u_pixelRatio;
    vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
    pxSizeUV /= pxSize;
    vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
    vec2 normalizedUV = canvasPixelizedUV / u_resolution;
  
    vec2 imageUV = getImageUV(normalizedUV);
    vec2 ditheringNoiseUV = canvasPixelizedUV;
    vec4 image = texture(u_image, imageUV);
    float frame = getUvFrame(imageUV, pxSize / u_resolution);
  
    int type = int(floor(u_type));
    float dithering = 0.0;
  
    float lum = dot(vec3(.2126, .7152, .0722), image.rgb);
    lum = u_inverted ? (1. - lum) : lum;
  
    switch (type) {
      case 1: {
        dithering = step(hash21(ditheringNoiseUV), lum);
      } break;
      case 2:
      dithering = getBayerValue(pxSizeUV, 2);
      break;
      case 3:
      dithering = getBayerValue(pxSizeUV, 4);
      break;
      default :
      dithering = getBayerValue(pxSizeUV, 8);
      break;
    }
  
    float colorSteps = max(floor(u_colorSteps), 1.);
    vec3 color = vec3(0.0);
    float opacity = 1.;
  
    dithering -= .5;
    float brightness = clamp(lum + dithering / colorSteps, 0.0, 1.0);
    brightness = mix(0.0, brightness, frame);
    brightness = mix(0.0, brightness, image.a);
    float quantLum = floor(brightness * colorSteps + 0.5) / colorSteps;
    quantLum = mix(0.0, quantLum, frame);
  
    if (u_originalColors == true) {
      vec3 normColor = image.rgb / max(lum, 0.001);
      color = normColor * quantLum;
  
      float quantAlpha = floor(image.a * colorSteps + 0.5) / colorSteps;
      opacity = mix(quantLum, 1., quantAlpha);
    } else {
      vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
      float fgOpacity = u_colorFront.a;
      vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
      float bgOpacity = u_colorBack.a;
      vec3 hlColor = u_colorHighlight.rgb * u_colorHighlight.a;
      float hlOpacity = u_colorHighlight.a;
  
      fgColor = mix(fgColor, hlColor, step(1.02 - .02 * u_colorSteps, brightness));
      fgOpacity = mix(fgOpacity, hlOpacity, step(1.02 - .02 * u_colorSteps, brightness));
  
      color = fgColor * quantLum;
      opacity = fgOpacity * quantLum;
      color += bgColor * (1.0 - opacity);
      opacity += bgOpacity * (1.0 - opacity);
    }
  
    fragColor = vec4(color, opacity);
  }
  `;
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/lens-distortion.js
    var lensDistortionMeta = {
      maxSamples: 50
    };
    var lensDistortionFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform sampler2D u_image;
  uniform float u_imageAspectRatio;
  uniform float u_spread;
  uniform float u_bias;
  uniform float u_angle;
  uniform float u_perspective;
  uniform float u_count;
  uniform float u_dispersion;
  uniform float u_dispersionShift;
  uniform float u_dispersionColor;
  uniform float u_focusCenter;
  uniform float u_focusEdges;
  uniform float u_swirl;
  uniform float u_noise;
  uniform float u_noiseFrequency;
  uniform float u_noiseOffset;
  uniform float u_lensBulge;
  uniform float u_lensCircle;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  uniform float u_imageX;
  uniform float u_imageY;
  
  in vec2 v_imageUV;
  
  out vec4 fragColor;
  
  ${declarePI}
  ${proceduralHash21}
  ${rotation2}
  
  float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash21(i);
    float b = hash21(i + vec2(1., 0.));
    float c = hash21(i + vec2(0., 1.));
    float d = hash21(i + vec2(1., 1.));
    vec2 u = f * f * (3. - 2. * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  
  float getUvFrame(vec2 uv) {
    vec2 invAA = 1. / clamp(fwidth(uv), 1e-5, .02);
    vec2 lo = clamp(uv * invAA + .5, 0., 1.);
    vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
    return lo.x * hi.x * lo.y * hi.y;
  }
  
  vec4 sampleOverWhite(vec2 uv) {
    vec4 img = texture(u_image, uv);
    float cover = img.a * getUvFrame(uv);
    vec3 colorOverWhite = mix(vec3(1.), img.rgb, cover);
    return vec4(colorOverWhite, cover);
  }
  
  vec3 hueColor(float hue) {
    vec3 rgb = clamp(abs(mod(hue * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);
    rgb = rgb * rgb * (3. - 2. * rgb);
    return rgb;
  }
                                              
  float boxInradius() {
    return .5 * min(u_imageAspectRatio, 1.);
  }
  
  float boxOutradius() {
    return .5 * length(vec2(u_imageAspectRatio, 1.));
  }
  
  float spreadReach() {
    return .7 * pow(u_spread, 1.3 + 2.7 * u_spread);
  }
  
  float innerCircleMask(float radius, float inradius) {
    return 1. - smoothstep(.5 * inradius, 1.1 * inradius, radius);
  }
  
  float dispersionCurve(float t, float biasPow) {
    float mirroredT = u_bias < 0. ? 1. - t : t;
    float curved = pow(mirroredT, biasPow);
    return u_bias < 0. ? 1. - curved : curved;
  }
  
  vec2 getSpread(vec2 fromCenter, float radius, vec2 warpedUV, float edgeAA, float inradius, float outradius, float reach, out float outStrength) {
    float angleRad = radians(u_angle);
    vec2 uniformDir = vec2(cos(angleRad), sin(angleRad));
  
    float invInradius = 1. / inradius;
    vec2 radialDir = fromCenter * invInradius;
    float maxLen = (outradius + reach) * invInradius;
    float radialLen = radius * invInradius;
    if (radialLen > maxLen) radialDir *= maxLen / radialLen;
    vec2 spreadDir = mix(uniformDir, radialDir, u_perspective);
  
    float bandProximity = smoothstep(inradius * .8, inradius, radius);
    float lensCircleMaxing = bandProximity * u_lensCircle * u_lensCircle * u_lensCircle;
    spreadDir = mix(spreadDir, radialDir, lensCircleMaxing);
  
    vec2 warpedAbs = abs(warpedUV - .5);
    float inner = mix(1., smoothstep(0., mix(inradius, outradius, u_focusCenter), radius), u_focusCenter);
    float boxDist = max(warpedAbs.x, warpedAbs.y) * 2.;
    float outer = mix(1., 1. - min(boxDist, 1.), u_focusEdges);
    float strength = inner * outer;
  
    strength *= mix(1., mix(.15, .03, max(-u_lensBulge, 0.)), lensCircleMaxing);
  
    vec2 outside = max(warpedAbs - .5, 0.);
    float margin = max(reach * length(spreadDir) * (1. - u_lensCircle), edgeAA);
    strength *= 1. - smoothstep(0., margin, length(outside));
  
    outStrength = strength;
    vec2 axis = spreadDir * (reach * strength);
  
    if (u_noise > 0.) {
      float turn = (valueNoise(fromCenter * u_noiseFrequency * 18. + u_noiseOffset * 30.) - .5) * 2. * u_noise;
      float cs = cos(turn), sn = sin(turn);
      axis = mat2(cs, -sn, sn, cs) * axis;
    }
  
    axis.x /= u_imageAspectRatio;
    return axis;
  }
  
  vec2 lensWarp(vec2 fromCenter, float radius, float inradius, out float bulgeFade) {
    bulgeFade = 1.;
    if (u_lensBulge == 0. && u_lensCircle <= 0.) return fromCenter;
    if (radius < 1e-5) return fromCenter;
    
    float r = radius;
  
    if (u_lensBulge != 0.) {
      float rn = radius / inradius;
      float bulge = abs(u_lensBulge) * (u_lensBulge > 0. ? 1.4 : 1.2);
      if (u_lensBulge > 0.) bulgeFade = 1. - smoothstep(1.45, 1.53, rn * bulge);
      float map = u_lensBulge > 0.
        ? tan(min(rn * bulge, 1.53)) / tan(bulge)
        : atan(rn * tan(bulge)) / bulge;
      float bulgeScale = map / rn;
      fromCenter *= bulgeScale;
      r *= bulgeScale;
    }
  
    if (u_lensCircle > 0.) {
      vec2 dir = fromCenter / max(r, 1e-5);
      vec2 halfBox = vec2(u_imageAspectRatio, 1.) * .5;
      float rBox = min(halfBox.x / max(abs(dir.x), 1e-4), halfBox.y / max(abs(dir.y), 1e-4));
      float band = inradius * mix(.03, .2, .5 * (u_lensBulge + 1.));
      float innerEdge = inradius - band;
      float over = smoothstep(0., 1., (r - innerEdge) / band);
      float g = r + (rBox - inradius) * pow(over, 14.);
      fromCenter = dir * mix(r, g, u_lensCircle);
    }
  
    return fromCenter;
  }
  
  void main() {
    vec2 uv = v_imageUV;
  
    float invAspect = 1. / u_imageAspectRatio;
    float inradius = boxInradius();
    float outradius = boxOutradius();
    float reach = spreadReach();
  
    vec2 fromCenter = uv - .5;
    fromCenter.x *= u_imageAspectRatio;
    float radius = length(fromCenter);
  
    float bulgeFade;
    vec2 warpedFromCenter = lensWarp(fromCenter, radius, inradius, bulgeFade);
    vec2 baseUV = vec2(warpedFromCenter.x * invAspect, warpedFromCenter.y) + .5;
  
    vec2 baseDerivative = fwidth(baseUV);
    float edgeAA = clamp(2. * max(baseDerivative.x, baseDerivative.y), .001, .02);
  
    float spreadStrength;
    vec2 spreadAxis = getSpread(fromCenter, radius, baseUV, edgeAA, inradius, outradius, reach, spreadStrength);
  
    vec2 grainUV = vec2(0.);
    if (u_grainMixer > 0. || u_grainOverlay > 0.) {
      vec2 dudx = dFdx(v_imageUV);
      vec2 dudy = dFdy(v_imageUV);
      grainUV = (v_imageUV - .5) * (.8 / vec2(length(dudx), length(dudy))) + .5;
    }
  
    if (u_grainMixer > 0.) {
      float grainSeed = valueNoise(grainUV);
      vec2 jit = fract(grainSeed * vec2(157.31, 113.57)) * 2. - 1.;
      spreadAxis += jit * .3 * u_grainMixer * length(spreadAxis);
    }
  
    float count = floor(u_count);
    int countInteger = int(count);
  
    float invCount = 1. / count;
    float invSpan = 1. / max(count - 1., 1.);
    float hueBase = u_dispersionColor + .5;
    float biasPower = 1. + 2. * abs(u_bias);
    vec2 tapBias = .5 - vec2(u_imageX, u_imageY);
  
    float centerAmount = clamp(1. - u_dispersionShift, 0., 1.);
    float edgesAmount = clamp(1. + u_dispersionShift, 0., 1.);
    float dispersion = u_dispersion * mix(edgesAmount, centerAmount, innerCircleMask(radius, inradius));
    float dispersionPower = pow(dispersion, .8);
  
    float warpedRadius = length(warpedFromCenter);
    float swirlAngle = u_swirl * .4 * PI * spreadStrength * u_spread * min(1., inradius / max(warpedRadius, 1e-4));
  
    vec3 colorSum = vec3(0.);
    vec3 weightSum = vec3(0.);
    float coverSum = 0.;
  
    for (int i = 0; i < ${lensDistortionMeta.maxSamples}; i++) {
      if (i >= countInteger) break;
  
      float layer = float(i);
      float hue = hueBase + layer * invCount;
  
      float spread = layer * invSpan;
      if (u_bias != 0.) spread = dispersionCurve(spread, biasPower);
  
      // mix(axis, -axis, spread) is axis scaled by the signed position along the fan
      float fanPos = 1. - 2. * spread;
      vec2 tapUV = baseUV + spreadAxis * fanPos - .5;
  
      if (u_swirl != 0.) {
        tapUV.x *= u_imageAspectRatio;
        tapUV = rotate(tapUV, swirlAngle * fanPos);
        tapUV.x *= invAspect;
      }
  
      vec4 tap = sampleOverWhite(tapUV + tapBias);
      vec3 weight = 1. - dispersionPower * hueColor(hue);
  
      colorSum += tap.rgb * weight;
      weightSum += weight;
      coverSum += tap.a;
    }
  
    vec3 color = colorSum / max(weightSum, 1e-4);
    float coverAvg = coverSum * invCount;
  
    float ground = min(color.r, min(color.g, color.b));
    float alpha = max(coverAvg, 1. - ground);
    vec3 premult = max(color - (1. - alpha), 0.);
    fragColor = vec4(premult, alpha) * bulgeFade;
  
    if (u_grainOverlay > 0.) {
      float grain = valueNoise(rotate(grainUV, 1.) + vec2(3.));
      grain = mix(grain, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
      grain = pow(grain, 1.3);
      float grainV = grain * 2. - 1.;
      float grainStrength = pow(u_grainOverlay * abs(grainV), .8) * fragColor.a;
      fragColor.rgb = mix(fragColor.rgb, vec3(step(0., grainV)) * fragColor.a, .35 * grainStrength);
    }
  }
  `;
  
    // src/render/folia/vendor/paper-shaders/dist/shaders/halftone-dots.js
    var halftoneDotsFragmentShader = `#version 300 es
  precision mediump float;
  
  uniform float u_rotation;
  
  uniform float u_time;
  
  uniform vec4 u_colorFront;
  uniform vec4 u_colorBack;
  uniform float u_radius;
  uniform float u_contrast;
  
  uniform sampler2D u_image;
  uniform float u_imageAspectRatio;
  
  uniform float u_size;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  uniform float u_grainSize;
  uniform float u_grid;
  uniform bool u_originalColors;
  uniform bool u_inverted;
  uniform float u_type;
  
  in vec2 v_imageUV;
  
  out vec4 fragColor;
  
  ${declarePI}
  ${rotation2}
  ${proceduralHash21}
  
  float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }
  
  float lst(float edge0, float edge1, float x) {
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }
  
  float sst(float edge0, float edge1, float x) {
    return smoothstep(edge0, edge1, x);
  }
  
  float getCircle(vec2 uv, float r, float baseR) {
    r = mix(.25 * baseR, 0., r);
    float d = length(uv - .5);
    float aa = fwidth(d);
    return 1. - smoothstep(r - aa, r + aa, d);
  }
  
  float getCell(vec2 uv) {
    float insideX = step(0.0, uv.x) * (1.0 - step(1.0, uv.x));
    float insideY = step(0.0, uv.y) * (1.0 - step(1.0, uv.y));
    return insideX * insideY;
  }
  
  float getCircleWithHole(vec2 uv, float r, float baseR) {
    float cell = getCell(uv);
  
    r = mix(.75 * baseR, 0., r);
    float rMod = mod(r, .5);
  
    float d = length(uv - .5);
    float aa = fwidth(d);
    float circle = 1. - smoothstep(rMod - aa, rMod + aa, d);
    if (r < .5) {
      return circle;
    } else {
      return cell - circle;
    }
  }
  
  float getGooeyBall(vec2 uv, float r, float baseR) {
    float d = length(uv - .5);
    float sizeRadius = .3;
    if (u_grid == 1.) {
      sizeRadius = .42;
    }
    sizeRadius = mix(sizeRadius * baseR, 0., r);
    d = 1. - sst(0., sizeRadius, d);
  
    d = pow(d, 2. + baseR);
    return d;
  }
  
  float getSoftBall(vec2 uv, float r, float baseR) {
    float d = length(uv - .5);
    float sizeRadius = clamp(baseR, 0., 1.);
    sizeRadius = mix(.5 * sizeRadius, 0., r);
    d = 1. - lst(0., sizeRadius, d);
    float powRadius = 1. - lst(0., 2., baseR);
    d = pow(d, 4. + 3. * powRadius);
    return d;
  }
  
  float getUvFrame(vec2 uv, vec2 pad) {
    float aa = 0.0001;
  
    float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
    float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
    float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
    float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);
  
    return left * right * bottom * top;
  }
  
  float sigmoid(float x, float k) {
    return 1.0 / (1.0 + exp(-k * (x - 0.5)));
  }
  
  float getLumAtPx(vec2 uv, float contrast) {
    vec4 tex = texture(u_image, uv);
    vec3 color = vec3(
    sigmoid(tex.r, contrast),
    sigmoid(tex.g, contrast),
    sigmoid(tex.b, contrast)
    );
    float lum = dot(vec3(0.2126, 0.7152, 0.0722), color);
    lum = mix(1., lum, tex.a);
    lum = u_inverted ? (1. - lum) : lum;
    return lum;
  }
  
  float getLumBall(vec2 p, vec2 pad, vec2 inCellOffset, float contrast, float baseR, float stepSize, out vec4 ballColor) {
    p += inCellOffset;
    vec2 uv_i = floor(p);
    vec2 uv_f = fract(p);
    vec2 samplingUV = (uv_i + .5 - inCellOffset) * pad + vec2(.5);
    float outOfFrame = getUvFrame(samplingUV, pad * stepSize);
  
    float lum = getLumAtPx(samplingUV, contrast);
    ballColor = texture(u_image, samplingUV);
    ballColor.rgb *= ballColor.a;
    ballColor *= outOfFrame;
  
    float ball = 0.;
    if (u_type == 0.) {
      // classic
      ball = getCircle(uv_f, lum, baseR);
    } else if (u_type == 1.) {
      // gooey
      ball = getGooeyBall(uv_f, lum, baseR);
    } else if (u_type == 2.) {
      // holes
      ball = getCircleWithHole(uv_f, lum, baseR);
    } else if (u_type == 3.) {
      // soft
      ball = getSoftBall(uv_f, lum, baseR);
    }
  
    return ball * outOfFrame;
  }
  
  
  void main() {
  
    float stepMultiplier = 1.;
    if (u_type == 0.) {
      // classic
      stepMultiplier = 2.;
    } else if (u_type == 1. || u_type == 3.) {
      // gooey & soft
      stepMultiplier = 6.;
    }
  
    float cellsPerSide = mix(300., 7., pow(u_size, .7));
    cellsPerSide /= stepMultiplier;
    float cellSizeY = 1. / cellsPerSide;
    vec2 pad = cellSizeY * vec2(1. / u_imageAspectRatio, 1.);
    if (u_type == 1. && u_grid == 1.) {
      // gooey diagonal grid works differently
      pad *= .7;
    }
  
    vec2 uv = v_imageUV;
    uv -= vec2(.5);
    uv /= pad;
  
    float contrast = mix(0., 15., pow(u_contrast, 1.5));
    float baseRadius = u_radius;
    if (u_originalColors == true) {
      contrast = mix(.1, 4., pow(u_contrast, 2.));
      baseRadius = 2. * pow(.5 * u_radius, .3);
    }
  
    float totalShape = 0.;
    vec3 totalColor = vec3(0.);
    float totalOpacity = 0.;
  
    vec4 ballColor;
    float shape;
    float stepSize = 1. / stepMultiplier;
    for (float x = -0.5; x < 0.5; x += stepSize) {
      for (float y = -0.5; y < 0.5; y += stepSize) {
        vec2 offset = vec2(x, y);
  
        if (u_grid == 1.) {
          float rowIndex = floor((y + .5) / stepSize);
          float colIndex = floor((x + .5) / stepSize);
          if (stepSize == 1.) {
            rowIndex = floor(uv.y + y + 1.);
            if (u_type == 1.) {
              colIndex = floor(uv.x + x + 1.);
            }
          }
          if (u_type == 1.) {
            if (mod(rowIndex + colIndex, 2.) == 1.) {
              continue;
            }
          } else {
            if (mod(rowIndex, 2.) == 1.) {
              offset.x += .5 * stepSize;
            }
          }
        }
  
        shape = getLumBall(uv, pad, offset, contrast, baseRadius, stepSize, ballColor);
        totalColor   += ballColor.rgb * shape;
        totalShape   += shape;
        totalOpacity += shape;
      }
    }
  
    const float eps = 1e-4;
  
    totalColor /= max(totalShape, eps);
    totalOpacity /= max(totalShape, eps);
  
    float finalShape = 0.;
    if (u_type == 0.) {
      finalShape = min(1., totalShape);
    } else if (u_type == 1.) {
      float aa = fwidth(totalShape);
      float th = .5;
      finalShape = smoothstep(th - aa, th + aa, totalShape);
    } else if (u_type == 2.) {
      finalShape = min(1., totalShape);
    } else if (u_type == 3.) {
      finalShape = totalShape;
    }
  
    vec2 grainSize = mix(2000., 200., u_grainSize) * vec2(1., 1. / u_imageAspectRatio);
    vec2 grainUV = v_imageUV - .5;
    grainUV *= grainSize;
    grainUV += .5;
    float grain = valueNoise(grainUV);
    grain = smoothstep(.55, .7 + .2 * u_grainMixer, grain);
    grain *= u_grainMixer;
    finalShape = mix(finalShape, 0., grain);
  
    vec3 color = vec3(0.);
    float opacity = 0.;
  
    if (u_originalColors == true) {
      color = totalColor * finalShape;
      opacity = totalOpacity * finalShape;
  
      vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
      color = color + bgColor * (1. - opacity);
      opacity = opacity + u_colorBack.a * (1. - opacity);
    } else {
      vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
      float fgOpacity = u_colorFront.a;
      vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
      float bgOpacity = u_colorBack.a;
  
      color = fgColor * finalShape;
      opacity = fgOpacity * finalShape;
      color += bgColor * (1. - opacity);
      opacity += bgOpacity * (1. - opacity);
    }
  
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);
  
    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);
  
    opacity += .5 * grainOverlayStrength;
    opacity = clamp(opacity, 0., 1.);
  
    fragColor = vec4(color, opacity);
  }
  `;
    var HalftoneDotsTypes = {
      classic: 0,
      gooey: 1,
      holes: 2,
      soft: 3
    };
    var HalftoneDotsGrids = {
      square: 0,
      hex: 1
    };
  
    // src/render/folia/vendor/paper-shaders/dist/get-shader-color-from-string.js
    function getShaderColorFromString(colorString) {
      if (Array.isArray(colorString)) {
        if (colorString.length === 4) return colorString;
        if (colorString.length === 3) return [...colorString, 1];
        return fallbackColor;
      }
      if (typeof colorString !== "string") {
        return fallbackColor;
      }
      let r, g, b, a = 1;
      if (colorString.startsWith("#")) {
        [r, g, b, a] = hexToRgba(colorString);
      } else if (colorString.startsWith("rgb")) {
        const rgba = parseRgba(colorString);
        if (rgba === null) return fallbackColor;
        [r, g, b, a] = rgba;
      } else if (colorString.startsWith("hsl")) {
        const hsla = parseHsla(colorString);
        if (hsla === null) return fallbackColor;
        [r, g, b, a] = hslaToRgba(hsla);
      } else {
        console.error("Unsupported color format", colorString);
        return fallbackColor;
      }
      return [clamp2(r, 0, 1), clamp2(g, 0, 1), clamp2(b, 0, 1), clamp2(a, 0, 1)];
    }
    function hexToRgba(hex) {
      hex = hex.replace(/^#/, "");
      if (hex.length === 3 || hex.length === 4) {
        hex = hex.split("").map((char) => char + char).join("");
      }
      if (hex.length === 6) {
        hex = hex + "ff";
      }
      if (!/^[0-9a-f]{8}$/i.test(hex)) {
        console.warn("Invalid hex color");
        return fallbackColor;
      }
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
    function parseRgba(rgba) {
      const match = rgba.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);
      if (!match) return null;
      return [
        parseInt(match[1] ?? "0") / 255,
        parseInt(match[2] ?? "0") / 255,
        parseInt(match[3] ?? "0") / 255,
        match[4] === void 0 ? 1 : parseFloat(match[4])
      ];
    }
    function parseHsla(hsla) {
      const match = hsla.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);
      if (!match) return null;
      return [
        parseInt(match[1] ?? "0"),
        parseInt(match[2] ?? "0"),
        parseInt(match[3] ?? "0"),
        match[4] === void 0 ? 1 : parseFloat(match[4])
      ];
    }
    function hslaToRgba(hsla) {
      const [h, s, l, a] = hsla;
      const hDecimal = h / 360;
      const sDecimal = s / 100;
      const lDecimal = l / 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = lDecimal;
      } else {
        const hue2rgb = (p2, q2, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
          if (t < 1 / 2) return q2;
          if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
          return p2;
        };
        const q = lDecimal < 0.5 ? lDecimal * (1 + sDecimal) : lDecimal + sDecimal - lDecimal * sDecimal;
        const p = 2 * lDecimal - q;
        r = hue2rgb(p, q, hDecimal + 1 / 3);
        g = hue2rgb(p, q, hDecimal);
        b = hue2rgb(p, q, hDecimal - 1 / 3);
      }
      return [r, g, b, a];
    }
    var clamp2 = (n, min, max) => Math.min(Math.max(n, min), max);
    var fallbackColor = [0.5, 0.5, 0.5, 1];
  
    // src/render/folia/vendor/paper-shaders/dist/get-shader-noise-texture.js
    function getShaderNoiseTexture() {
      if (typeof window === "undefined") {
        return void 0;
      }
      const img = new Image();
      img.src = noiseSrc;
      return img;
    }
    var noiseSrc = "data:image/png;base64,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";
  
    // src/render/folia/vendor/paper-shaders/dist/empty-pixel.js
    var emptyPixel = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  
    // src/render/folia/vendor/paper-shaders-react/dist/use-merge-refs.js
    function useMergeRefs(refs) {
      const cleanupRef = useRef(void 0);
      const refEffect = useCallback((instance) => {
        const cleanups = refs.map((ref) => {
          if (ref == null) {
            return;
          }
          if (typeof ref === "function") {
            const refCallback = ref;
            const refCleanup = refCallback(instance);
            return typeof refCleanup === "function" ? refCleanup : () => {
              refCallback(null);
            };
          }
          ref.current = instance;
          return () => {
            ref.current = null;
          };
        });
        return () => {
          cleanups.forEach((refCleanup) => refCleanup?.());
        };
      }, refs);
      return useMemo(() => {
        if (refs.every((ref) => ref == null)) {
          return null;
        }
        return (value) => {
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = void 0;
          }
          if (value != null) {
            cleanupRef.current = refEffect(value);
          }
        };
      }, refs);
    }
  
    // src/render/folia/vendor/paper-shaders-react/dist/set-min-image-size.js
    function setMinImageSize(img) {
      if (img.naturalWidth < 1024 && img.naturalHeight < 1024) {
        if (img.naturalWidth < 1 || img.naturalHeight < 1) {
          return;
        }
        const aspect = img.naturalWidth / img.naturalHeight;
        img.width = Math.round(aspect > 1 ? 1024 * aspect : 1024);
        img.height = Math.round(aspect > 1 ? 1024 : 1024 / aspect);
      }
    }
  
    // src/render/folia/vendor/paper-shaders-react/dist/shader-mount.js
    async function processUniforms(uniformsProp) {
      const processedUniforms = {};
      const imageLoadPromises = [];
      const isValidUrl = (url) => {
        try {
          if (url.startsWith("/")) return true;
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
      const isExternalUrl = (url) => {
        try {
          if (url.startsWith("/")) return false;
          const urlObject = new URL(url, window.location.origin);
          return urlObject.origin !== window.location.origin;
        } catch {
          return false;
        }
      };
      Object.entries(uniformsProp).forEach(([key, value]) => {
        if (typeof value === "string") {
          const url = value || emptyPixel;
          if (!isValidUrl(url)) {
            console.warn(`Uniform "${key}" has invalid URL "${url}". Skipping image loading.`);
            return;
          }
          const imagePromise = new Promise((resolve, reject) => {
            const img = new Image();
            if (isExternalUrl(url)) {
              img.crossOrigin = "anonymous";
            }
            img.onload = () => {
              setMinImageSize(img);
              processedUniforms[key] = img;
              resolve();
            };
            img.onerror = () => {
              console.error(`Could not set uniforms. Failed to load image at ${url}`);
              reject();
            };
            img.src = url;
          });
          imageLoadPromises.push(imagePromise);
        } else if (value instanceof HTMLImageElement) {
          const imagePromise = value.decode().then(() => {
            setMinImageSize(value);
            processedUniforms[key] = value;
          });
          imageLoadPromises.push(imagePromise);
        } else {
          processedUniforms[key] = value;
        }
      });
      await Promise.all(imageLoadPromises);
      return processedUniforms;
    }
    var ShaderMount2 = forwardRef(
      function ShaderMountImpl({
        fragmentShader,
        uniforms: uniformsProp,
        webGlContextAttributes,
        speed = 0,
        frame = 0,
        width,
        height,
        minPixelRatio,
        maxPixelCount,
        mipmaps,
        style,
        ...divProps
      }, forwardedRef) {
        const [isInitialized, setIsInitialized] = useState(false);
        const divRef = useRef(null);
        const shaderMountRef = useRef(null);
        const webGlContextAttributesRef = useRef(webGlContextAttributes);
        useEffect(() => {
          const initShader = async () => {
            const uniforms = await processUniforms(uniformsProp);
            if (divRef.current && !shaderMountRef.current) {
              shaderMountRef.current = new ShaderMount(
                divRef.current,
                fragmentShader,
                uniforms,
                webGlContextAttributesRef.current,
                speed,
                frame,
                minPixelRatio,
                maxPixelCount,
                mipmaps
              );
              setIsInitialized(true);
            }
          };
          initShader();
          return () => {
            shaderMountRef.current?.dispose();
            shaderMountRef.current = null;
          };
        }, [fragmentShader]);
        useEffect(() => {
          let isStale = false;
          const updateUniforms = async () => {
            const uniforms = await processUniforms(uniformsProp);
            if (!isStale) {
              shaderMountRef.current?.setUniforms(uniforms);
            }
          };
          updateUniforms();
          return () => {
            isStale = true;
          };
        }, [uniformsProp, isInitialized]);
        useEffect(() => {
          shaderMountRef.current?.setSpeed(speed);
        }, [speed, isInitialized]);
        useEffect(() => {
          shaderMountRef.current?.setMaxPixelCount(maxPixelCount);
        }, [maxPixelCount, isInitialized]);
        useEffect(() => {
          shaderMountRef.current?.setMinPixelRatio(minPixelRatio);
        }, [minPixelRatio, isInitialized]);
        useEffect(() => {
          shaderMountRef.current?.setFrame(frame);
        }, [frame, isInitialized]);
        const mergedRef = useMergeRefs([divRef, forwardedRef]);
        return /* @__PURE__ */ jsx(
          "div",
          {
            ref: mergedRef,
            style: width !== void 0 || height !== void 0 ? {
              width: typeof width === "string" && isNaN(+width) === false ? +width : width,
              height: typeof height === "string" && isNaN(+height) === false ? +height : height,
              ...style
            } : style,
            ...divProps
          }
        );
      }
    );
    ShaderMount2.displayName = "ShaderMount";
  
    // src/render/folia/vendor/paper-shaders-react/dist/color-props-are-equal.js
    function colorPropsAreEqual(prevProps, nextProps) {
      if (Object.keys(prevProps).length !== Object.keys(nextProps).length) {
        return false;
      }
      for (const key in prevProps) {
        if (key === "colors") {
          const prevIsArray = Array.isArray(prevProps.colors);
          const nextIsArray = Array.isArray(nextProps.colors);
          if (!prevIsArray || !nextIsArray) {
            if (Object.is(prevProps.colors, nextProps.colors) === false) {
              return false;
            }
            continue;
          }
          if (prevProps.colors?.length !== nextProps.colors?.length) {
            return false;
          }
          if (!prevProps.colors?.every((color, index) => color === nextProps.colors?.[index])) {
            return false;
          }
          continue;
        }
        if (Object.is(prevProps[key], nextProps[key]) === false) {
          return false;
        }
      }
      return true;
    }
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/mesh-gradient.js
    var defaultPreset = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        speed: 1,
        frame: 0,
        colors: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
        distortion: 0.8,
        swirl: 0.1,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var purplePreset = {
      name: "Purple",
      params: {
        ...defaultObjectSizing,
        speed: 0.6,
        frame: 0,
        colors: ["#aaa7d7", "#3c2b8e"],
        distortion: 1,
        swirl: 1,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var beachPreset = {
      name: "Beach",
      params: {
        ...defaultObjectSizing,
        speed: 0.1,
        frame: 0,
        colors: ["#bcecf6", "#00aaff", "#00f7ff", "#ffd447"],
        distortion: 0.8,
        swirl: 0.35,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var inkPreset = {
      name: "Ink",
      params: {
        ...defaultObjectSizing,
        speed: 1,
        frame: 0,
        colors: ["#ffffff", "#000000"],
        distortion: 1,
        swirl: 0.2,
        rotation: 90,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var MeshGradient = memo(forwardRef(function MeshGradientImpl({
      // Own props
      speed = defaultPreset.params.speed,
      frame = defaultPreset.params.frame,
      colors = defaultPreset.params.colors,
      distortion = defaultPreset.params.distortion,
      swirl = defaultPreset.params.swirl,
      grainMixer = defaultPreset.params.grainMixer,
      grainOverlay = defaultPreset.params.grainOverlay,
      // Sizing props
      fit = defaultPreset.params.fit,
      rotation = defaultPreset.params.rotation,
      scale = defaultPreset.params.scale,
      originX = defaultPreset.params.originX,
      originY = defaultPreset.params.originY,
      offsetX = defaultPreset.params.offsetX,
      offsetY = defaultPreset.params.offsetY,
      worldWidth = defaultPreset.params.worldWidth,
      worldHeight = defaultPreset.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_colors: colors.map(getShaderColorFromString),
        u_colorsCount: colors.length,
        u_distortion: distortion,
        u_swirl: swirl,
        u_grainMixer: grainMixer,
        u_grainOverlay: grainOverlay,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_rotation: rotation,
        u_scale: scale,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: meshGradientFragmentShader,
          uniforms
        }
      );
    }), colorPropsAreEqual);
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/dithering.js
    var defaultPreset2 = {
      name: "Default",
      params: {
        ...defaultPatternSizing,
        speed: 1,
        frame: 0,
        scale: 0.6,
        colorBack: "#000000",
        colorFront: "#00b2ff",
        shape: "sphere",
        type: "4x4",
        size: 2
      }
    };
    var sinePreset = {
      name: "Sine Wave",
      params: {
        ...defaultPatternSizing,
        speed: 1,
        frame: 0,
        colorBack: "#730d54",
        colorFront: "#00becc",
        shape: "wave",
        type: "4x4",
        size: 11,
        scale: 1.2
      }
    };
    var bugsPreset = {
      name: "Bugs",
      params: {
        ...defaultPatternSizing,
        speed: 1,
        frame: 0,
        colorBack: "#000000",
        colorFront: "#008000",
        shape: "dots",
        type: "random",
        size: 9
      }
    };
    var ripplePreset = {
      name: "Ripple",
      params: {
        ...defaultObjectSizing,
        speed: 1,
        frame: 0,
        colorBack: "#603520",
        colorFront: "#c67953",
        shape: "ripple",
        type: "2x2",
        size: 3
      }
    };
    var swirlPreset = {
      name: "Swirl",
      params: {
        ...defaultObjectSizing,
        speed: 1,
        frame: 0,
        colorBack: "#00000000",
        colorFront: "#47a8e1",
        shape: "swirl",
        type: "8x8",
        size: 2
      }
    };
    var warpPreset = {
      name: "Warp",
      params: {
        ...defaultObjectSizing,
        speed: 1,
        frame: 0,
        colorBack: "#301c2a",
        colorFront: "#56ae6c",
        shape: "warp",
        type: "4x4",
        size: 2.5
      }
    };
    var Dithering = memo(forwardRef(function DitheringImpl({
      // Own props
      speed = defaultPreset2.params.speed,
      frame = defaultPreset2.params.frame,
      colorBack = defaultPreset2.params.colorBack,
      colorFront = defaultPreset2.params.colorFront,
      shape = defaultPreset2.params.shape,
      type = defaultPreset2.params.type,
      pxSize,
      size = pxSize === void 0 ? defaultPreset2.params.size : pxSize,
      // Sizing props
      fit = defaultPreset2.params.fit,
      scale = defaultPreset2.params.scale,
      rotation = defaultPreset2.params.rotation,
      originX = defaultPreset2.params.originX,
      originY = defaultPreset2.params.originY,
      offsetX = defaultPreset2.params.offsetX,
      offsetY = defaultPreset2.params.offsetY,
      worldWidth = defaultPreset2.params.worldWidth,
      worldHeight = defaultPreset2.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_colorBack: getShaderColorFromString(colorBack),
        u_colorFront: getShaderColorFromString(colorFront),
        u_shape: DitheringShapes[shape],
        u_type: DitheringTypes[type],
        u_pxSize: size,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_scale: scale,
        u_rotation: rotation,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(ShaderMount2, { ...props, ref, speed, frame, fragmentShader: ditheringFragmentShader, uniforms });
    }));
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/paper-texture.js
    var defaultPreset3 = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        scale: 0.6,
        speed: 0,
        frame: 0,
        colorFront: "#9fadbc",
        colorBack: "#ffffff",
        contrast: 0.3,
        roughness: 0.4,
        fiber: 0.3,
        fiberSize: 0.2,
        crumples: 0.3,
        crumpleSize: 0.35,
        folds: 0.65,
        foldCount: 5,
        fade: 0,
        drops: 0.2,
        seed: 5.8
      }
    };
    var abstractPreset = {
      name: "Abstract",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        scale: 0.6,
        colorFront: "#00eeff",
        colorBack: "#ff0a81",
        contrast: 0.85,
        roughness: 0,
        fiber: 0.1,
        fiberSize: 0.2,
        crumples: 0,
        crumpleSize: 0.3,
        folds: 1,
        foldCount: 3,
        fade: 0,
        drops: 0.2,
        seed: 2.2
      }
    };
    var cardboardPreset = {
      name: "Cardboard",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        scale: 0.6,
        colorFront: "#c7b89e",
        colorBack: "#999180",
        contrast: 0.4,
        roughness: 0,
        fiber: 0.35,
        fiberSize: 0.14,
        crumples: 0.7,
        crumpleSize: 0.1,
        folds: 0,
        foldCount: 1,
        fade: 0,
        drops: 0.1,
        seed: 1.6
      }
    };
    var detailsPreset = {
      name: "Details",
      params: {
        ...defaultObjectSizing,
        speed: 0,
        frame: 0,
        fit: "cover",
        scale: 3,
        colorFront: "#00000000",
        colorBack: "#00000000",
        contrast: 0,
        roughness: 1,
        fiber: 0.27,
        fiberSize: 0.22,
        crumples: 1,
        crumpleSize: 0.5,
        folds: 1,
        foldCount: 15,
        fade: 0,
        drops: 0,
        seed: 6
      }
    };
    var PaperTexture = memo(forwardRef(function PaperTextureImpl({
      // Own props
      speed = defaultPreset3.params.speed,
      frame = defaultPreset3.params.frame,
      colorFront = defaultPreset3.params.colorFront,
      colorBack = defaultPreset3.params.colorBack,
      image = "",
      contrast = defaultPreset3.params.contrast,
      roughness = defaultPreset3.params.roughness,
      fiber = defaultPreset3.params.fiber,
      crumples = defaultPreset3.params.crumples,
      folds = defaultPreset3.params.folds,
      drops = defaultPreset3.params.drops,
      seed = defaultPreset3.params.seed,
      // Reworked props
      fiberScale,
      fiberSize = fiberScale === void 0 ? defaultPreset3.params.fiberSize : 0.2 / fiberScale,
      crumplesScale,
      crumpleSize = crumplesScale === void 0 ? defaultPreset3.params.crumpleSize : 0.2 / crumplesScale,
      blur,
      fade = blur === void 0 ? defaultPreset3.params.fade : blur,
      foldsNumber,
      foldCount = foldsNumber === void 0 ? defaultPreset3.params.foldCount : foldsNumber,
      // Sizing props
      fit = defaultPreset3.params.fit,
      scale = defaultPreset3.params.scale,
      rotation = defaultPreset3.params.rotation,
      originX = defaultPreset3.params.originX,
      originY = defaultPreset3.params.originY,
      offsetX = defaultPreset3.params.offsetX,
      offsetY = defaultPreset3.params.offsetY,
      worldWidth = defaultPreset3.params.worldWidth,
      worldHeight = defaultPreset3.params.worldHeight,
      ...props
    }, ref) {
      const noiseTexture = typeof window !== "undefined" && { u_noiseTexture: getShaderNoiseTexture() };
      const uniforms = {
        // Own uniforms
        u_image: image,
        u_colorFront: getShaderColorFromString(colorFront),
        u_colorBack: getShaderColorFromString(colorBack),
        u_contrast: contrast,
        u_roughness: roughness,
        u_fiber: fiber,
        u_fiberSize: fiberSize,
        u_crumples: crumples,
        u_crumpleSize: crumpleSize,
        u_foldCount: foldCount,
        u_folds: folds,
        u_fade: fade,
        u_drops: drops,
        u_seed: seed,
        ...noiseTexture,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_scale: scale,
        u_rotation: rotation,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: paperTextureFragmentShader,
          mipmaps: ["u_image"],
          uniforms
        }
      );
    }), colorPropsAreEqual);
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/fluted-glass.js
    var defaultPreset4 = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#00000000",
        colorShadow: "#000000",
        colorHighlight: "#ffffff",
        shadows: 0.25,
        size: 0.5,
        angle: 0,
        distortionShape: "prism",
        highlights: 0.1,
        shape: "lines",
        distortion: 0.5,
        shift: 0,
        blur: 0,
        edges: 0.25,
        stretch: 0,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        marginBottom: 0,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var wavesPreset = {
      name: "Waves",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        scale: 1.2,
        speed: 0,
        frame: 0,
        colorBack: "#00000000",
        colorShadow: "#000000",
        colorHighlight: "#ffffff",
        shadows: 0,
        size: 0.9,
        angle: 0,
        distortionShape: "contour",
        highlights: 0,
        shape: "wave",
        distortion: 0.5,
        shift: 0,
        blur: 0.1,
        edges: 0.5,
        stretch: 1,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        marginBottom: 0,
        grainMixer: 0,
        grainOverlay: 0.05
      }
    };
    var abstractPreset2 = {
      name: "Abstract",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        scale: 4,
        speed: 0,
        frame: 0,
        colorBack: "#00000000",
        colorShadow: "#000000",
        colorHighlight: "#ffffff",
        shadows: 0,
        size: 0.7,
        angle: 30,
        distortionShape: "flat",
        highlights: 0,
        shape: "linesIrregular",
        distortion: 1,
        shift: 0,
        blur: 1,
        edges: 0.5,
        stretch: 1,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        marginBottom: 0,
        grainMixer: 0.1,
        grainOverlay: 0.1
      }
    };
    var foldsPreset = {
      name: "Folds",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#00000000",
        colorShadow: "#000000",
        colorHighlight: "#ffffff",
        shadows: 0.4,
        size: 0.4,
        angle: 0,
        distortionShape: "cascade",
        highlights: 0,
        shape: "lines",
        distortion: 0.75,
        shift: 0,
        blur: 0.25,
        edges: 0.5,
        stretch: 0,
        margin: 0.1,
        marginLeft: 0.1,
        marginRight: 0.1,
        marginTop: 0.1,
        marginBottom: 0.1,
        grainMixer: 0,
        grainOverlay: 0
      }
    };
    var FlutedGlass = memo(forwardRef(function FlutedGlassImpl({
      // Own props
      speed = defaultPreset4.params.speed,
      frame = defaultPreset4.params.frame,
      colorBack = defaultPreset4.params.colorBack,
      colorShadow = defaultPreset4.params.colorShadow,
      colorHighlight = defaultPreset4.params.colorHighlight,
      image = "",
      shadows = defaultPreset4.params.shadows,
      angle = defaultPreset4.params.angle,
      distortion = defaultPreset4.params.distortion,
      distortionShape = defaultPreset4.params.distortionShape,
      highlights = defaultPreset4.params.highlights,
      shape = defaultPreset4.params.shape,
      shift = defaultPreset4.params.shift,
      blur = defaultPreset4.params.blur,
      edges = defaultPreset4.params.edges,
      margin,
      marginLeft = margin ?? defaultPreset4.params.marginLeft,
      marginRight = margin ?? defaultPreset4.params.marginRight,
      marginTop = margin ?? defaultPreset4.params.marginTop,
      marginBottom = margin ?? defaultPreset4.params.marginBottom,
      grainMixer = defaultPreset4.params.grainMixer,
      grainOverlay = defaultPreset4.params.grainOverlay,
      stretch = defaultPreset4.params.stretch,
      // integer `count` was deprecated in favor of the normalized `size` param
      count,
      size = count === void 0 ? defaultPreset4.params.size : Math.pow(1 / (count * 1.6), 1 / 6) / 0.7 - 0.5,
      // Sizing props
      fit = defaultPreset4.params.fit,
      scale = defaultPreset4.params.scale,
      rotation = defaultPreset4.params.rotation,
      originX = defaultPreset4.params.originX,
      originY = defaultPreset4.params.originY,
      offsetX = defaultPreset4.params.offsetX,
      offsetY = defaultPreset4.params.offsetY,
      worldWidth = defaultPreset4.params.worldWidth,
      worldHeight = defaultPreset4.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_image: image,
        u_colorBack: getShaderColorFromString(colorBack),
        u_colorShadow: getShaderColorFromString(colorShadow),
        u_colorHighlight: getShaderColorFromString(colorHighlight),
        u_shadows: shadows,
        u_size: size,
        u_angle: angle,
        u_distortion: distortion,
        u_shift: shift,
        u_blur: blur,
        u_edges: edges,
        u_stretch: stretch,
        u_distortionShape: GlassDistortionShapes[distortionShape],
        u_highlights: highlights,
        u_shape: GlassGridShapes[shape],
        u_marginLeft: marginLeft,
        u_marginRight: marginRight,
        u_marginTop: marginTop,
        u_marginBottom: marginBottom,
        u_grainMixer: grainMixer,
        u_grainOverlay: grainOverlay,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_scale: scale,
        u_rotation: rotation,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: flutedGlassFragmentShader,
          mipmaps: ["u_image"],
          uniforms
        }
      );
    }));
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/image-dithering.js
    var defaultPreset5 = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        // scale: 0.95,
        speed: 0,
        frame: 0,
        colorFront: "#94ffaf",
        colorBack: "#000c38",
        colorHighlight: "#eaff94",
        type: "8x8",
        size: 2,
        colorSteps: 2,
        originalColors: false,
        inverted: false
      }
    };
    var retroPreset = {
      name: "Retro",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorFront: "#eeeeee",
        colorBack: "#5452ff",
        colorHighlight: "#eeeeee",
        type: "2x2",
        size: 3,
        colorSteps: 1,
        originalColors: true,
        inverted: false
      }
    };
    var noisePreset = {
      name: "Noise",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorFront: "#a2997c",
        colorBack: "#000000",
        colorHighlight: "#ededed",
        type: "random",
        size: 1,
        colorSteps: 1,
        originalColors: false,
        inverted: false
      }
    };
    var naturalPreset = {
      name: "Natural",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorFront: "#ffffff",
        colorBack: "#000000",
        colorHighlight: "#ffffff",
        type: "8x8",
        size: 2,
        colorSteps: 5,
        originalColors: true,
        inverted: false
      }
    };
    var ImageDithering = memo(forwardRef(function ImageDitheringImpl({
      // Own props
      speed = defaultPreset5.params.speed,
      frame = defaultPreset5.params.frame,
      colorFront = defaultPreset5.params.colorFront,
      colorBack = defaultPreset5.params.colorBack,
      colorHighlight = defaultPreset5.params.colorHighlight,
      image = "",
      type = defaultPreset5.params.type,
      colorSteps = defaultPreset5.params.colorSteps,
      originalColors = defaultPreset5.params.originalColors,
      inverted = defaultPreset5.params.inverted,
      pxSize,
      size = pxSize === void 0 ? defaultPreset5.params.size : pxSize,
      // Sizing props
      fit = defaultPreset5.params.fit,
      scale = defaultPreset5.params.scale,
      rotation = defaultPreset5.params.rotation,
      originX = defaultPreset5.params.originX,
      originY = defaultPreset5.params.originY,
      offsetX = defaultPreset5.params.offsetX,
      offsetY = defaultPreset5.params.offsetY,
      worldWidth = defaultPreset5.params.worldWidth,
      worldHeight = defaultPreset5.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_image: image,
        u_colorFront: getShaderColorFromString(colorFront),
        u_colorBack: getShaderColorFromString(colorBack),
        u_colorHighlight: getShaderColorFromString(colorHighlight),
        u_type: DitheringTypes[type],
        u_pxSize: size,
        u_colorSteps: colorSteps,
        u_originalColors: originalColors,
        u_inverted: inverted,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_rotation: rotation,
        u_scale: scale,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: imageDitheringFragmentShader,
          uniforms
        }
      );
    }), colorPropsAreEqual);
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/lens-distortion.js
    var defaultPreset6 = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        scale: 1,
        fit: "contain",
        speed: 0,
        frame: 0,
        spread: 0.6,
        bias: 1,
        angle: 0,
        perspective: 0.1,
        count: 35,
        dispersion: 1,
        dispersionShift: 0,
        dispersionColor: 0.6,
        focusCenter: 0.8,
        focusEdges: 1,
        swirl: 0.35,
        noise: 0,
        noiseFrequency: 0.25,
        noiseOffset: 0,
        lensBulge: 0,
        lensCircle: 0,
        grainMixer: 0,
        grainOverlay: 0,
        imageX: 0,
        imageY: 0
      }
    };
    var fisheyePreset = {
      name: "Fisheye",
      params: {
        ...defaultObjectSizing,
        scale: 1,
        fit: "contain",
        speed: 0,
        frame: 0,
        spread: 0.7,
        bias: 1,
        angle: 0,
        perspective: 0.75,
        count: 15,
        dispersion: 1,
        dispersionShift: 0,
        dispersionColor: 0.7,
        focusCenter: 0.9,
        focusEdges: 1,
        swirl: 1,
        noise: 0,
        noiseFrequency: 0.25,
        noiseOffset: 0,
        lensBulge: 0.95,
        lensCircle: 1,
        grainMixer: 0.5,
        grainOverlay: 0,
        imageX: 0,
        imageY: 0
      }
    };
    var duotonePreset = {
      name: "Duotone",
      params: {
        ...defaultObjectSizing,
        fit: "contain",
        speed: 0,
        frame: 0,
        spread: 0.1,
        bias: 0,
        angle: 0,
        perspective: 0,
        count: 2,
        dispersion: 1,
        dispersionShift: 0,
        dispersionColor: 0.1,
        focusCenter: 0,
        focusEdges: 0,
        swirl: 0,
        noise: 0,
        noiseFrequency: 0.25,
        noiseOffset: 0,
        lensBulge: 0,
        lensCircle: 0,
        grainMixer: 0.1,
        grainOverlay: 0.3,
        imageX: 0,
        imageY: 0
      }
    };
    var smokePreset = {
      name: "Smoke",
      params: {
        ...defaultObjectSizing,
        scale: 1,
        fit: "contain",
        speed: 0,
        frame: 0,
        spread: 0.65,
        bias: -1,
        angle: 0,
        perspective: 0.4,
        count: 50,
        dispersion: 0,
        dispersionShift: 0,
        dispersionColor: 0.31,
        focusCenter: 0,
        focusEdges: 0.6,
        swirl: 0,
        noise: 1,
        noiseFrequency: 0.35,
        noiseOffset: 0.3,
        lensBulge: 0,
        lensCircle: 0,
        grainMixer: 0,
        grainOverlay: 0,
        imageX: 0,
        imageY: 0
      }
    };
    var LensDistortion = memo(forwardRef(function LensDistortionImpl({
      // Own props
      speed = defaultPreset6.params.speed,
      frame = defaultPreset6.params.frame,
      image = "",
      spread = defaultPreset6.params.spread,
      bias = defaultPreset6.params.bias,
      angle = defaultPreset6.params.angle,
      perspective = defaultPreset6.params.perspective,
      count = defaultPreset6.params.count,
      dispersion = defaultPreset6.params.dispersion,
      dispersionShift = defaultPreset6.params.dispersionShift,
      dispersionColor = defaultPreset6.params.dispersionColor,
      focusCenter = defaultPreset6.params.focusCenter,
      focusEdges = defaultPreset6.params.focusEdges,
      swirl = defaultPreset6.params.swirl,
      noise = defaultPreset6.params.noise,
      noiseFrequency = defaultPreset6.params.noiseFrequency,
      noiseOffset = defaultPreset6.params.noiseOffset,
      lensBulge = defaultPreset6.params.lensBulge,
      lensCircle = defaultPreset6.params.lensCircle,
      grainMixer = defaultPreset6.params.grainMixer,
      grainOverlay = defaultPreset6.params.grainOverlay,
      imageX = defaultPreset6.params.imageX,
      imageY = defaultPreset6.params.imageY,
      // Sizing props
      fit = defaultPreset6.params.fit,
      scale = defaultPreset6.params.scale,
      rotation = defaultPreset6.params.rotation,
      originX = defaultPreset6.params.originX,
      originY = defaultPreset6.params.originY,
      offsetX = defaultPreset6.params.offsetX,
      offsetY = defaultPreset6.params.offsetY,
      worldWidth = defaultPreset6.params.worldWidth,
      worldHeight = defaultPreset6.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_image: image,
        u_spread: spread,
        u_bias: bias,
        u_angle: angle,
        u_perspective: perspective,
        u_count: count,
        u_dispersion: dispersion,
        u_dispersionShift: dispersionShift,
        u_dispersionColor: dispersionColor,
        u_focusCenter: focusCenter,
        u_focusEdges: focusEdges,
        u_swirl: swirl,
        u_noise: noise,
        u_noiseFrequency: noiseFrequency,
        u_noiseOffset: noiseOffset,
        u_lensBulge: lensBulge,
        u_lensCircle: lensCircle,
        u_grainMixer: grainMixer,
        u_grainOverlay: grainOverlay,
        u_imageX: imageX,
        u_imageY: imageY,
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_rotation: rotation,
        u_scale: scale,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: lensDistortionFragmentShader,
          mipmaps: ["u_image"],
          uniforms
        }
      );
    }), colorPropsAreEqual);
  
    // src/render/folia/vendor/paper-shaders-react/dist/shaders/halftone-dots.js
    var defaultPreset7 = {
      name: "Default",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#f2f1e8",
        colorFront: "#2b2b2b",
        size: 0.5,
        radius: 1.25,
        contrast: 0.4,
        originalColors: false,
        inverted: false,
        grainMixer: 0.2,
        grainOverlay: 0.2,
        grainSize: 0.5,
        grid: "hex",
        type: "gooey"
      }
    };
    var ledPreset = {
      name: "LED screen",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#000000",
        colorFront: "#29ff7b",
        size: 0.5,
        radius: 1.5,
        contrast: 0.3,
        originalColors: false,
        inverted: false,
        grainMixer: 0,
        grainOverlay: 0,
        grainSize: 0.5,
        grid: "square",
        type: "soft"
      }
    };
    var netPreset = {
      name: "Mosaic",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#000000",
        colorFront: "#b2aeae",
        size: 0.6,
        radius: 2,
        contrast: 0.01,
        originalColors: true,
        inverted: false,
        grainMixer: 0,
        grainOverlay: 0,
        grainSize: 0.5,
        grid: "hex",
        type: "classic"
      }
    };
    var roundAndSquarePreset = {
      name: "Round and square",
      params: {
        ...defaultObjectSizing,
        fit: "cover",
        speed: 0,
        frame: 0,
        colorBack: "#141414",
        colorFront: "#ff8000",
        size: 0.8,
        radius: 1,
        contrast: 1,
        originalColors: false,
        inverted: true,
        grainMixer: 0.05,
        grainOverlay: 0.3,
        grainSize: 0.5,
        grid: "square",
        type: "holes"
      }
    };
    var HalftoneDots = memo(forwardRef(function HalftoneDotsImpl({
      // Own props
      speed = defaultPreset7.params.speed,
      frame = defaultPreset7.params.frame,
      colorFront = defaultPreset7.params.colorFront,
      colorBack = defaultPreset7.params.colorBack,
      image = "",
      size = defaultPreset7.params.size,
      radius = defaultPreset7.params.radius,
      contrast = defaultPreset7.params.contrast,
      originalColors = defaultPreset7.params.originalColors,
      inverted = defaultPreset7.params.inverted,
      grainMixer = defaultPreset7.params.grainMixer,
      grainOverlay = defaultPreset7.params.grainOverlay,
      grainSize = defaultPreset7.params.grainSize,
      grid = defaultPreset7.params.grid,
      type = defaultPreset7.params.type,
      // Sizing props
      fit = defaultPreset7.params.fit,
      scale = defaultPreset7.params.scale,
      rotation = defaultPreset7.params.rotation,
      originX = defaultPreset7.params.originX,
      originY = defaultPreset7.params.originY,
      offsetX = defaultPreset7.params.offsetX,
      offsetY = defaultPreset7.params.offsetY,
      worldWidth = defaultPreset7.params.worldWidth,
      worldHeight = defaultPreset7.params.worldHeight,
      ...props
    }, ref) {
      const uniforms = {
        // Own uniforms
        u_image: image,
        u_colorFront: getShaderColorFromString(colorFront),
        u_colorBack: getShaderColorFromString(colorBack),
        u_size: size,
        u_radius: radius,
        u_contrast: contrast,
        u_originalColors: originalColors,
        u_inverted: inverted,
        u_grainMixer: grainMixer,
        u_grainOverlay: grainOverlay,
        u_grainSize: grainSize,
        u_grid: HalftoneDotsGrids[grid],
        u_type: HalftoneDotsTypes[type],
        // Sizing uniforms
        u_fit: ShaderFitOptions[fit],
        u_rotation: rotation,
        u_scale: scale,
        u_offsetX: offsetX,
        u_offsetY: offsetY,
        u_originX: originX,
        u_originY: originY,
        u_worldWidth: worldWidth,
        u_worldHeight: worldHeight
      };
      return /* @__PURE__ */ jsx(
        ShaderMount2,
        {
          ...props,
          ref,
          speed,
          frame,
          fragmentShader: halftoneDotsFragmentShader,
          uniforms
        }
      );
    }), colorPropsAreEqual);
  
    // src/render/folia/utils/colorPalette.ts
    var QUANTIZATION_SHIFT = 4;
    var MIN_ALPHA = 128;
    var getChannelRange = (colors, channel) => {
      let min = 255;
      let max = 0;
      for (const color of colors) {
        min = Math.min(min, color[channel]);
        max = Math.max(max, color[channel]);
      }
      return max - min;
    };
    var splitBucket = (bucket) => {
      if (bucket.colors.length < 2) return null;
      const ranges = {
        r: getChannelRange(bucket.colors, "r"),
        g: getChannelRange(bucket.colors, "g"),
        b: getChannelRange(bucket.colors, "b")
      };
      const channel = Object.keys(ranges).reduce((widest, candidate) => ranges[candidate] > ranges[widest] ? candidate : widest, "r");
      const sorted = [...bucket.colors].sort((a, b) => a[channel] - b[channel]);
      const midpoint = bucket.weight / 2;
      let accumulatedWeight = 0;
      let splitIndex = 1;
      for (let index = 0; index < sorted.length - 1; index += 1) {
        accumulatedWeight += sorted[index].weight;
        splitIndex = index + 1;
        if (accumulatedWeight >= midpoint) break;
      }
      const left = sorted.slice(0, splitIndex);
      const right = sorted.slice(splitIndex);
      return [
        { colors: left, weight: left.reduce((sum, color) => sum + color.weight, 0) },
        { colors: right, weight: right.reduce((sum, color) => sum + color.weight, 0) }
      ];
    };
    var averageBucket = (bucket) => {
      const totals = bucket.colors.reduce((result, color) => ({
        r: result.r + color.r * color.weight,
        g: result.g + color.g * color.weight,
        b: result.b + color.b * color.weight
      }), { r: 0, g: 0, b: 0 });
      return {
        r: Math.round(totals.r / bucket.weight),
        g: Math.round(totals.g / bucket.weight),
        b: Math.round(totals.b / bucket.weight),
        weight: bucket.weight
      };
    };
    var toHex = ({ r, g, b }) => `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    var extractRepresentativeColorsFromPixels = (pixels, count = 5) => {
      if (count <= 0) return [];
      const histogram = /* @__PURE__ */ new Map();
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < MIN_ALPHA) continue;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const key = r >> QUANTIZATION_SHIFT << 8 | g >> QUANTIZATION_SHIFT << 4 | b >> QUANTIZATION_SHIFT;
        const existing = histogram.get(key);
        if (existing) {
          existing.r += r;
          existing.g += g;
          existing.b += b;
          existing.weight += 1;
        } else {
          histogram.set(key, { r, g, b, weight: 1 });
        }
      }
      const colors = [...histogram.values()].map((color) => ({
        r: Math.round(color.r / color.weight),
        g: Math.round(color.g / color.weight),
        b: Math.round(color.b / color.weight),
        weight: color.weight
      }));
      if (colors.length === 0) return [];
      const buckets = [{
        colors,
        weight: colors.reduce((sum, color) => sum + color.weight, 0)
      }];
      while (buckets.length < Math.min(count, colors.length)) {
        let bucketIndex = -1;
        let bestScore = -1;
        for (let index = 0; index < buckets.length; index += 1) {
          const bucket = buckets[index];
          if (bucket.colors.length < 2) continue;
          const widestRange = Math.max(
            getChannelRange(bucket.colors, "r"),
            getChannelRange(bucket.colors, "g"),
            getChannelRange(bucket.colors, "b")
          );
          const score = widestRange * Math.sqrt(bucket.weight);
          if (score > bestScore) {
            bestScore = score;
            bucketIndex = index;
          }
        }
        if (bucketIndex < 0) break;
        const split = splitBucket(buckets[bucketIndex]);
        if (!split) break;
        buckets.splice(bucketIndex, 1, ...split);
      }
      return buckets.map(averageBucket).sort((a, b) => b.weight - a.weight).map(toHex);
    };
  
    // src/render/folia/utils/colorExtractor.ts
    var loadImagePixels = (imageUrl, { silent = false } = {}) => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        const width = 50;
        const height = 50;
        canvas.width = width;
        canvas.height = height;
        try {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(ctx.getImageData(0, 0, width, height).data);
        } catch (error2) {
          if (!silent) console.warn("Failed to read image pixels for color extraction", error2);
          resolve(null);
        }
      };
      img.onerror = (e) => {
        if (!silent) console.warn("Failed to load image for color extraction", e);
        resolve(null);
      };
      img.src = imageUrl;
    });
    var extractRepresentativeColors = async (imageUrl, count = 5) => {
      const pixels = await loadImagePixels(imageUrl);
      return pixels ? extractRepresentativeColorsFromPixels(pixels, count) : [];
    };
  
    // src/render/folia/utils/paperShaderUniforms.ts
    var updatePaperShaderUniforms = (mount, uniforms, animating) => {
      const writer = mount.setUniformValues;
      if (animating && typeof writer === "function") {
        writer(uniforms);
        return;
      }
      mount.setUniforms(uniforms);
    };
  
    // src/render/folia/utils/paperShaderContext.ts
    var PAPER_SHADER_CONTEXT_ATTRIBUTES = Object.freeze({
      antialias: false,
      depth: false
    });
    var createPaperShaderReleaseRef = (target) => ((element) => {
      target.current = element;
      if (!element) return void 0;
      return () => {
        target.current = null;
        const canvas = element.paperShaderMount?.canvasElement;
        if (!canvas) return;
        const gl = canvas.getContext("webgl2");
        queueMicrotask(() => {
          if (!gl || canvas.isConnected || gl.isContextLost()) return;
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        });
      };
    });
  
    // src/render/folia/stores/motionSignals.ts
    var beatImpact = motionValue(0);
    var downbeatImpact = motionValue(0);
  
    // src/render/folia/services/beatFx/beatFxLive.ts
    var isBeatFxReady = () => false;
    var getBeatEffectStrength = (_effectId) => 0;
  
    // src/render/folia/services/beatFx/beatEffects.ts
    var BEAT_EFFECT_IDS = {
      sonnetLensTear: "sonnet.lensTear",
      dioramaRipple: "diorama.ripple",
      pendoloDrumhead: "pendolo.drumhead",
      pendoloGearBeats: "pendolo.gearBeats",
      latentPulse: "latent.pulse",
      hanabiBeatBursts: "hanabi.beatBursts",
      hanabiPush: "hanabi.push",
      temperaInkFlash: "tempera.inkFlash",
      machiNeonPulse: "machi.neonPulse",
      machiDrumRipple: "machi.drumRipple"
    };
  
    // src/render/folia/components/visualizer/backgrounds/latent/LatentBackground.tsx
    var MAX_SHADER_PIXELS = 1280 * 720;
    var PAUSED_SPEED_SCALE = 0.12;
    var PAUSE_EASE_MS = 300;
    var normalizeAudio = (value) => Math.min(1, Math.max(0, value / 255));
    var clampShaderSpeed = (value) => Math.min(2, Math.max(0, value));
    var clampAudioAmount = (value) => Math.min(1, Math.max(0, value));
    var easeTowards = (current, target, amount) => current + (target - current) * amount;
    var resolveLatentBroadbandEnergy = (bass, lowMid, mid, vocal, treble) => {
      const broadbandEnergy = normalizeAudio(bass) * 0.22 + normalizeAudio(lowMid) * 0.18 + normalizeAudio(mid) * 0.22 + normalizeAudio(vocal) * 0.28 + normalizeAudio(treble) * 0.1;
      return Math.pow(broadbandEnergy, 0.55);
    };
    var resolveLatentOnsetPulse = (currentEnergy, previousEnergy, previousPulse) => Math.max(
      previousPulse * 0.84,
      clampAudioAmount((currentEnergy - previousEnergy) * 7)
    );
    var resolveLatentBeatSpeedTarget = (broadbandEnergy, onsetPulse) => clampAudioAmount(broadbandEnergy * 0.42 + onsetPulse * 0.85);
    var resolveLatentBeatFxPulse = (beat, downbeat) => Math.max(beat, downbeat);
    var resolveLatentAudioSpeedTarget = (broadbandEnergy, onsetPulse, enhancedBeatResponse) => enhancedBeatResponse ? resolveLatentBeatSpeedTarget(broadbandEnergy, onsetPulse) : clampAudioAmount(broadbandEnergy);
    var resolveLatentShaderSpeed = (baseSpeed, audioSpeed, audioAmount, paused) => clampShaderSpeed(
      paused ? baseSpeed * PAUSED_SPEED_SCALE : easeTowards(baseSpeed, audioSpeed, audioAmount)
    );
    var resolveLatentShaderColors = (coverColors, theme, colorSource) => {
      const primary = coverColors[0] ?? theme.secondaryColor;
      if (colorSource === "cover-only") {
        const secondary2 = coverColors[1] ?? primary;
        const tertiary2 = coverColors[2] ?? secondary2;
        const quaternary2 = coverColors[3] ?? primary;
        const quinary = coverColors[4] ?? secondary2;
        const senary = coverColors[5] ?? tertiary2;
        return {
          ditheringBack: tertiary2,
          ditheringFront: primary,
          mesh: [primary, secondary2, tertiary2, quaternary2, quinary, senary]
        };
      }
      const secondary = coverColors[1] ?? theme.primaryColor;
      const tertiary = coverColors[2] ?? primary;
      const quaternary = coverColors[3] ?? secondary;
      return {
        ditheringBack: theme.backgroundColor,
        ditheringFront: primary,
        mesh: [primary, secondary, tertiary, quaternary, theme.backgroundColor, theme.accentColor]
      };
    };
    var LatentBackground = ({
      theme,
      coverUrl,
      audioPower,
      audioBands,
      staticMode,
      paused,
      tuning: tuningOverride,
      blendMs = 0,
      blendProgress
    }) => {
      const ditheringRef = useRef(null);
      const meshRef = useRef(null);
      const ditheringShaderRef = useMemo(() => createPaperShaderReleaseRef(ditheringRef), []);
      const meshShaderRef = useMemo(() => createPaperShaderReleaseRef(meshRef), []);
      const ditheringLayerRef = useRef(null);
      const meshLayerRef = useRef(null);
      const pausedRef = useRef(paused);
      const playingRef = useRef(paused ? 0 : 1);
      const [coverColors, setCoverColors] = useState([]);
      const tuning = tuningOverride ?? DEFAULT_LATENT_BACKGROUND_TUNING;
      const showDithering = tuning.displayMode !== "mesh";
      const showMesh = tuning.displayMode !== "dithering";
      pausedRef.current = paused;
      const colorsDrawn = useFirstFrameDrawn();
      useEffect(() => {
        let active = true;
        if (!coverUrl) {
          setCoverColors([]);
          colorsDrawn();
          return () => {
            active = false;
          };
        }
        void extractRepresentativeColors(coverUrl, 6).then((colors) => {
          if (active) {
            setCoverColors(colors);
            colorsDrawn();
          }
        });
        return () => {
          active = false;
        };
      }, [coverUrl, colorsDrawn]);
      const resolvedColors = useMemo(
        () => resolveLatentShaderColors(coverColors, theme, tuning.colorSource),
        [coverColors, theme, tuning.colorSource]
      );
      const blendedColors = useBlendedColors(
        [theme.backgroundColor, resolvedColors.ditheringBack, resolvedColors.ditheringFront, ...resolvedColors.mesh],
        blendMs,
        blendProgress
      );
      const [backgroundColor, ditheringBack, ditheringFront] = blendedColors;
      const shaderColors = useMemo(
        () => ({ ditheringBack, ditheringFront, mesh: blendedColors.slice(3) }),
        [blendedColors, ditheringBack, ditheringFront]
      );
      useEffect(() => {
        const ditheringMount = ditheringRef.current?.paperShaderMount;
        const meshMount = meshRef.current?.paperShaderMount;
        if (staticMode) {
          ditheringMount?.setSpeed(0);
          meshMount?.setSpeed(0);
          return;
        }
        let animationFrame = 0;
        const writtenStyles = /* @__PURE__ */ new WeakMap();
        const writeLayerStyle = (element, property, value) => {
          let written = writtenStyles.get(element);
          if (!written) {
            written = {};
            writtenStyles.set(element, written);
          }
          if (written[property] === value) return;
          written[property] = value;
          element.style[property] = value;
        };
        let smoothedPower = 0;
        let smoothedBass = 0;
        let smoothedMid = 0;
        let smoothedBeatSpeed = 0;
        let previousBeatEnergy = 0;
        let latentOnsetPulse = 0;
        let lastFrameAt = null;
        const speedOf = (baseSpeed, audioSpeed) => easeTowards(
          resolveLatentShaderSpeed(baseSpeed, audioSpeed, smoothedBeatSpeed, true),
          resolveLatentShaderSpeed(baseSpeed, audioSpeed, smoothedBeatSpeed, false),
          playingRef.current
        );
        const updateAudioResponse = (frameAt) => {
          animationFrame = requestAnimationFrame(updateAudioResponse);
          const isPaused = pausedRef.current;
          const pauseStep = lastFrameAt === null ? 0 : 1 - Math.exp((lastFrameAt - frameAt) / PAUSE_EASE_MS);
          lastFrameAt = frameAt;
          playingRef.current = easeTowards(playingRef.current, isPaused ? 0 : 1, pauseStep);
          const targetPower = isPaused ? 0 : normalizeAudio(audioPower.get());
          const targetBass = isPaused ? 0 : normalizeAudio(audioBands.bass.get());
          const targetBeatEnergy = isPaused ? 0 : resolveLatentBroadbandEnergy(
            audioBands.bass.get(),
            audioBands.lowMid.get(),
            audioBands.mid.get(),
            audioBands.vocal.get(),
            audioBands.treble.get()
          );
          const targetMid = isPaused ? 0 : normalizeAudio(Math.max(audioBands.mid.get(), audioBands.vocal.get()));
          smoothedPower = easeTowards(smoothedPower, targetPower, 0.12);
          smoothedBass = easeTowards(smoothedBass, targetBass, 0.16);
          smoothedMid = easeTowards(
            smoothedMid,
            targetMid,
            0.13
          );
          latentOnsetPulse = tuning.enhancedBeatResponse ? resolveLatentOnsetPulse(
            targetBeatEnergy,
            previousBeatEnergy,
            latentOnsetPulse
          ) : 0;
          previousBeatEnergy = targetBeatEnergy;
          const beatSpeedTarget = !isPaused && isBeatFxReady() && getBeatEffectStrength(BEAT_EFFECT_IDS.latentPulse) > 0 ? resolveLatentBeatSpeedTarget(
            targetBeatEnergy,
            resolveLatentBeatFxPulse(beatImpact.get(), downbeatImpact.get())
          ) : resolveLatentAudioSpeedTarget(
            targetBeatEnergy,
            latentOnsetPulse,
            tuning.enhancedBeatResponse
          );
          smoothedBeatSpeed = easeTowards(
            smoothedBeatSpeed,
            beatSpeedTarget,
            beatSpeedTarget > smoothedBeatSpeed ? 0.42 : 0.14
          );
          const currentDitheringMount = ditheringRef.current?.paperShaderMount;
          const currentMeshMount = meshRef.current?.paperShaderMount;
          if (currentDitheringMount) {
            const ditheringSpeed = speedOf(tuning.ditheringSpeed, tuning.ditheringAudioSpeed);
            currentDitheringMount.setSpeed(ditheringSpeed);
            updatePaperShaderUniforms(currentDitheringMount, {
              u_pxSize: Math.max(0.5, tuning.ditheringSize - smoothedBass * tuning.ditheringSize * 0.34)
            }, ditheringSpeed !== 0);
          }
          if (currentMeshMount) {
            const meshSpeed = speedOf(tuning.meshSpeed, tuning.meshAudioSpeed);
            currentMeshMount.setSpeed(meshSpeed);
            updatePaperShaderUniforms(currentMeshMount, {
              u_distortion: tuning.meshDistortion + smoothedPower * 0.62,
              u_swirl: tuning.meshSwirl + smoothedMid * 0.38
            }, meshSpeed !== 0);
          }
          if (ditheringLayerRef.current) {
            writeLayerStyle(ditheringLayerRef.current, "opacity", showMesh ? `${Math.min(1, tuning.ditheringOpacity + smoothedBass * 0.25)}` : "1");
            writeLayerStyle(ditheringLayerRef.current, "transform", `scale(${1.015 + smoothedBass * 0.025})`);
          }
          if (meshLayerRef.current) {
            writeLayerStyle(meshLayerRef.current, "filter", `saturate(${1.04 + smoothedMid * 0.34}) brightness(${0.94 + smoothedPower * 0.16})`);
            writeLayerStyle(meshLayerRef.current, "transform", `scale(${1.025 + smoothedPower * 0.018})`);
          }
        };
        animationFrame = requestAnimationFrame(updateAudioResponse);
        return () => cancelAnimationFrame(animationFrame);
      }, [audioBands, audioPower, showMesh, staticMode, tuning]);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "absolute inset-0 z-0 overflow-hidden",
          style: { backgroundColor, pointerEvents: "none" },
          children: [
            showMesh && /* @__PURE__ */ jsx(
              "div",
              {
                ref: meshLayerRef,
                className: "absolute inset-0",
                style: { transform: "scale(1.025)", transformOrigin: "center" },
                children: /* @__PURE__ */ jsx(
                  MeshGradient,
                  {
                    ref: meshShaderRef,
                    width: "100%",
                    height: "100%",
                    colors: shaderColors.mesh,
                    distortion: tuning.meshDistortion,
                    swirl: tuning.meshSwirl,
                    grainMixer: 0,
                    grainOverlay: 0.01,
                    speed: staticMode ? 0 : tuning.meshSpeed,
                    minPixelRatio: 1,
                    maxPixelCount: MAX_SHADER_PIXELS,
                    webGlContextAttributes: PAPER_SHADER_CONTEXT_ATTRIBUTES,
                    style: { width: "100%", height: "100%" }
                  }
                )
              }
            ),
            showDithering && /* @__PURE__ */ jsx(
              "div",
              {
                ref: ditheringLayerRef,
                className: "absolute inset-0",
                style: {
                  mixBlendMode: showMesh ? "soft-light" : "normal",
                  opacity: showMesh ? tuning.ditheringOpacity : 1,
                  transform: "scale(1.015)",
                  transformOrigin: "center"
                },
                children: /* @__PURE__ */ jsx(
                  Dithering,
                  {
                    ref: ditheringShaderRef,
                    width: "100%",
                    height: "100%",
                    colorBack: shaderColors.ditheringBack,
                    colorFront: shaderColors.ditheringFront,
                    shape: "warp",
                    type: "4x4",
                    size: tuning.ditheringSize,
                    speed: staticMode ? 0 : tuning.ditheringSpeed,
                    minPixelRatio: 1,
                    maxPixelCount: MAX_SHADER_PIXELS,
                    webGlContextAttributes: PAPER_SHADER_CONTEXT_ATTRIBUTES,
                    style: { width: "100%", height: "100%" }
                  }
                )
              }
            ),
            tuning.overlayEnabled && tuning.overlayOpacity > 0 && /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute inset-0",
                style: {
                  backgroundColor,
                  opacity: tuning.overlayOpacity
                }
              }
            )
          ]
        }
      );
    };
    var LatentBackground_default = react_shim_default.memo(LatentBackground);
  
    // src/render/folia/components/visualizer/backgrounds/latent/entry.tsx
    var LATENT_DISPLAY_MODES = ["dithering", "mesh", "both"];
    var LATENT_DISPLAY_LABEL_KEYS = {
      dithering: "options.latentDisplayDithering",
      mesh: "options.latentDisplayMesh",
      both: "options.latentDisplayBoth"
    };
    var LATENT_COLOR_SOURCES = ["cover-theme", "cover-only"];
    var LATENT_COLOR_SOURCE_LABEL_KEYS = {
      "cover-theme": "options.latentColorSourceCoverTheme",
      "cover-only": "options.latentColorSourceCoverOnly"
    };
    var entry_default2 = defineVisualizerBackground({
      mode: "latent",
      order: 35,
      labelKey: "options.visualizerBackgroundModeLatent",
      labelFallback: "Latent",
      // 隐现：上层像素点阵，下层流体
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("path", { d: "M4.5 7.5h.01M9 7.5h.01M13.5 7.5h.01M18 7.5h.01", strokeWidth: "2.2", opacity: "0.55" }),
        /* @__PURE__ */ jsx("path", { d: "M3 15c3-3.5 6-3.5 9 0s6 3.5 9 0" })
      ] }),
      command: {
        title: "Background: Latent",
        description: "Switch background to cover-colored audio-reactive shaders",
        keywords: ["latent", "latent background", "shader background", "\u9690\u73B0", "\u9690\u73B0\u80CC\u666F", "\u97F3\u9891\u54CD\u5E94\u80CC\u666F"]
      },
      // 智能动感模式: the beats replace the band onset in the speed pulse (LatentBackground.tsx).
      // Retired, its code kept: the user set it aside on 2026-10-17.
      beatEffects: [{
        id: BEAT_EFFECT_IDS.latentPulse,
        nameKey: "options.beatEffect_latentPulse",
        descKey: "options.beatEffect_latentPulseDesc",
        source: "beats",
        retired: true
      }],
      // No `song`: a new song's cover colours blend in place (blendMs).
      render: ({ config, theme, coverUrl, audioPower, audioBands, staticMode, paused, blendMs, blendProgress }) => /* @__PURE__ */ jsx(
        LatentBackground_default,
        {
          theme,
          coverUrl,
          audioPower,
          audioBands,
          staticMode,
          paused,
          tuning: config?.latent?.tuning,
          blendMs,
          blendProgress
        }
      ),
      renderSettingsPanel: ({ config, actions, ...props }) => /* @__PURE__ */ jsx(
        settings_card_default,
        {
          ...props,
          tuning: config?.latent?.tuning ?? DEFAULT_LATENT_BACKGROUND_TUNING,
          onTuningChange: actions?.latent?.onTuningChange
        }
      ),
      renderQuickControls: ({ config, actions, t }) => {
        const tuning = config?.latent?.tuning ?? DEFAULT_LATENT_BACKGROUND_TUNING;
        const displayLabel = t(LATENT_DISPLAY_LABEL_KEYS[tuning.displayMode]);
        const colorLabel = t(LATENT_COLOR_SOURCE_LABEL_KEYS[tuning.colorSource]);
        return /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: displayLabel,
              title: `${t("options.latentDisplayMode")}: ${displayLabel}`,
              onClick: () => actions?.latent?.onTuningChange?.({ displayMode: cycleValue(LATENT_DISPLAY_MODES, tuning.displayMode) })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: colorLabel,
              title: `${t("options.latentColorSource")}: ${colorLabel}`,
              onClick: () => actions?.latent?.onTuningChange?.({ colorSource: cycleValue(LATENT_COLOR_SOURCES, tuning.colorSource) })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: tuning.overlayEnabled,
              label: t("options.nomandBackgroundOverlay"),
              onToggle: () => actions?.latent?.onTuningChange?.({ overlayEnabled: !tuning.overlayEnabled }),
              children: /* @__PURE__ */ jsx(Layers, { size: 14 })
            }
          )
        ] });
      },
      resetSettings: (actions) => actions?.latent?.onResetTuning?.()
    });
  
    // src/render/folia/components/visualizer/monet/monetBackgroundPaint.ts
    var MONET_BACKGROUND_WIDTH = 1920;
    var MONET_BACKGROUND_HEIGHT = 1080;
    var FALLBACK_DARK = { r: 10, g: 10, b: 12 };
    var FALLBACK_LIGHT = { r: 245, g: 245, b: 245 };
    var clamp3 = (value, min, max) => Math.min(max, Math.max(min, value));
    var mix2 = (from, to, amount) => from + (to - from) * amount;
    var luminanceOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    var resolveWashEndpoints = (background, primary) => {
      const backgroundLuminance = luminanceOf(background.r, background.g, background.b);
      const primaryLuminance = luminanceOf(primary.r, primary.g, primary.b);
      return backgroundLuminance <= primaryLuminance ? { shadow: background, highlight: primary } : { shadow: primary, highlight: background };
    };
    var drawCoverCropped = (context, image, width, height) => {
      const imageWidth = image.width;
      const imageHeight = image.height;
      if (!imageWidth || !imageHeight) {
        return;
      }
      const scale = Math.max(width / imageWidth, height / imageHeight);
      const drawWidth = imageWidth * scale;
      const drawHeight = imageHeight * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    };
    var resolveThemeChannel = (color, fallback) => {
      const parsed = parseColorChannels(color);
      return parsed ? {
        r: clamp3(parsed.r, 0, 255),
        g: clamp3(parsed.g, 0, 255),
        b: clamp3(parsed.b, 0, 255)
      } : fallback;
    };
    var resolveWashColor = (normalizedLuminance, background, accent, primary) => {
      const { shadow, highlight } = resolveWashEndpoints(background, primary);
      if (normalizedLuminance <= 0.55) {
        const amount2 = normalizedLuminance / 0.55;
        return {
          r: mix2(shadow.r, accent.r, amount2),
          g: mix2(shadow.g, accent.g, amount2),
          b: mix2(shadow.b, accent.b, amount2)
        };
      }
      const amount = (normalizedLuminance - 0.55) / 0.45;
      return {
        r: mix2(accent.r, highlight.r, amount),
        g: mix2(accent.g, highlight.g, amount),
        b: mix2(accent.b, highlight.b, amount)
      };
    };
    var applyBackgroundPostProcessing = (context, width, height, theme, tuning) => {
      const grayscale = clamp3(tuning.backgroundGrayscale, 0, 1);
      const saturation = clamp3(tuning.backgroundSaturation, 0, 2);
      const wash = clamp3(tuning.backgroundWash, 0, 1);
      if (grayscale <= 0 && Math.abs(saturation - 1) < 1e-3 && wash <= 0) {
        return;
      }
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      const background = resolveThemeChannel(theme.backgroundColor, FALLBACK_DARK);
      const accent = resolveThemeChannel(theme.accentColor, background);
      const primary = resolveThemeChannel(theme.primaryColor, FALLBACK_LIGHT);
      const customWash = resolveThemeChannel(tuning.backgroundWashCustomColor, accent);
      const washAccent = tuning.backgroundWashColorMode === "custom" ? customWash : accent;
      for (let index = 0; index < data.length; index += 4) {
        let r = data[index];
        let g = data[index + 1];
        let b = data[index + 2];
        const alpha = data[index + 3];
        if (alpha === 0) {
          continue;
        }
        const luminance = luminanceOf(r, g, b);
        if (grayscale > 0) {
          r = mix2(r, luminance, grayscale);
          g = mix2(g, luminance, grayscale);
          b = mix2(b, luminance, grayscale);
        }
        if (Math.abs(saturation - 1) >= 1e-3) {
          const saturatedLuminance = luminanceOf(r, g, b);
          r = saturatedLuminance + (r - saturatedLuminance) * saturation;
          g = saturatedLuminance + (g - saturatedLuminance) * saturation;
          b = saturatedLuminance + (b - saturatedLuminance) * saturation;
        }
        if (wash > 0) {
          const washColor = resolveWashColor(clamp3(luminance / 255, 0, 1), background, washAccent, primary);
          r = mix2(r, washColor.r, wash);
          g = mix2(g, washColor.g, wash);
          b = mix2(b, washColor.b, wash);
        }
        data[index] = Math.round(clamp3(r, 0, 255));
        data[index + 1] = Math.round(clamp3(g, 0, 255));
        data[index + 2] = Math.round(clamp3(b, 0, 255));
      }
      context.putImageData(imageData, 0, 0);
    };
    var paintMonetOverlay = (context, width, height, theme, tuning) => {
      const overlay = clamp3(tuning.backgroundOverlayOpacity, 0, 1);
      const overlayGradient = context.createLinearGradient(0, 0, width, height);
      overlayGradient.addColorStop(0, colorWithAlpha(theme.accentColor, 0.08 + overlay * 0.62));
      overlayGradient.addColorStop(0.44, colorWithAlpha(theme.backgroundColor, 0.16 + overlay * 0.58));
      overlayGradient.addColorStop(1, colorWithAlpha(theme.primaryColor, 0.06 + overlay * 0.36));
      context.fillStyle = overlayGradient;
      context.fillRect(0, 0, width, height);
      const leftBloom = context.createRadialGradient(width * 0.18, height * 0.34, 0, width * 0.18, height * 0.34, width * 0.55);
      leftBloom.addColorStop(0, colorWithAlpha(theme.accentColor, overlay * 0.42));
      leftBloom.addColorStop(1, colorWithAlpha(theme.backgroundColor, 0));
      context.fillStyle = leftBloom;
      context.fillRect(0, 0, width, height);
      const rightVeil = context.createLinearGradient(width * 0.45, 0, width, 0);
      rightVeil.addColorStop(0, colorWithAlpha(theme.backgroundColor, 0));
      rightVeil.addColorStop(1, colorWithAlpha(theme.backgroundColor, 0.18 + overlay * 0.38));
      context.fillStyle = rightVeil;
      context.fillRect(0, 0, width, height);
      if (tuning.backgroundStreaksEnabled === false) {
        return;
      }
      context.fillStyle = colorWithAlpha(theme.backgroundColor, 0.1 + overlay * 0.08);
      for (let index = 0; index < 18; index += 1) {
        const x = index * 127 % width;
        const y = index * 211 % height - 40;
        context.fillRect(x, y, 1, height * 0.28);
      }
    };
    var paintMonetBackground = (context, image, colors, tuning, blurPx) => {
      const { width, height } = context.canvas;
      context.fillStyle = colors.backgroundColor;
      context.fillRect(0, 0, width, height);
      context.save();
      if (blurPx !== null) {
        context.filter = `blur(${blurPx}px)`;
      }
      drawCoverCropped(context, image, width, height);
      context.restore();
      applyBackgroundPostProcessing(context, width, height, colors, tuning);
      paintMonetOverlay(context, width, height, colors, tuning);
    };
  
    // src/render/folia/components/visualizer/backgrounds/monet/monetBackgroundPipeline.ts
    var monetBackgroundCache = /* @__PURE__ */ new Map();
    var clamp4 = (value, min, max) => Math.min(max, Math.max(min, value));
    var resolveSourceUrl = ({
      coverUrl,
      monetBackgroundImage,
      tuning
    }) => tuning.backgroundSource === "uploaded-global" ? monetBackgroundImage?.url ?? coverUrl ?? null : coverUrl ?? monetBackgroundImage?.url ?? null;
    var loadImage = async (src) => {
      const image = new Image();
      if (!src.startsWith("blob:") && !src.startsWith("data:")) {
        image.crossOrigin = "anonymous";
      }
      image.decoding = "async";
      const loadPromise = new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      });
      image.src = src;
      try {
        await image.decode();
      } catch {
        await loadPromise;
      }
      return image;
    };
    var getMonetBackgroundCacheKey = ({
      coverUrl,
      monetBackgroundImage,
      theme,
      tuning
    }) => JSON.stringify({
      sourceUrl: resolveSourceUrl({ coverUrl, monetBackgroundImage, tuning }),
      uploadedId: tuning.backgroundSource === "uploaded-global" ? monetBackgroundImage?.id ?? null : null,
      theme: {
        backgroundColor: theme.backgroundColor,
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor
      },
      tuning: {
        backgroundSource: tuning.backgroundSource,
        backgroundBlurPx: tuning.backgroundBlurPx,
        backgroundOverlayOpacity: tuning.backgroundOverlayOpacity,
        backgroundGrayscale: tuning.backgroundGrayscale,
        backgroundSaturation: tuning.backgroundSaturation,
        backgroundWash: tuning.backgroundWash,
        backgroundWashColorMode: tuning.backgroundWashColorMode,
        backgroundWashCustomColor: tuning.backgroundWashCustomColor,
        backgroundStreaksEnabled: tuning.backgroundStreaksEnabled
      }
    });
    var isCanvasFilterSupportedCached = null;
    var checkCanvasFilterSupport = () => {
      if (isCanvasFilterSupportedCached !== null) return isCanvasFilterSupportedCached;
      if (typeof document === "undefined") return false;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext("2d");
        if (!ctx || typeof ctx.filter !== "string") {
          isCanvasFilterSupportedCached = false;
          return false;
        }
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 2, 2);
        ctx.filter = "blur(1px)";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1, 1);
        const imgData = ctx.getImageData(1, 1, 1, 1);
        isCanvasFilterSupportedCached = imgData.data[0] > 0;
        return isCanvasFilterSupportedCached;
      } catch {
        isCanvasFilterSupportedCached = false;
        return false;
      }
    };
    var paintPicture = async (request) => {
      try {
        const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(MONET_BACKGROUND_WIDTH, MONET_BACKGROUND_HEIGHT) : Object.assign(document.createElement("canvas"), {
          width: MONET_BACKGROUND_WIDTH,
          height: MONET_BACKGROUND_HEIGHT
        });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no 2D context");
        paintMonetBackground(context, request.image, request.colors, request.tuning, request.blurPx);
        const picture = "convertToBlob" in canvas ? await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 }) : await new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
        });
        return picture;
      } catch (error2) {
        console.warn("[MonetBackground] The picture could not be painted:", error2);
        return null;
      } finally {
        request.image.close();
      }
    };
    var queuedPaints = [];
    var painting = false;
    var paintNext = () => {
      if (painting) return;
      const job = queuedPaints.shift();
      if (!job) return;
      if (!job.wanted()) {
        job.request.image.close();
        job.settle(void 0);
        paintNext();
        return;
      }
      painting = true;
      void paintPicture(job.request).then((picture) => {
        painting = false;
        job.settle(picture);
        paintNext();
      });
    };
    var paintOffThread = (request, wanted) => new Promise((settle) => {
      queuedPaints.push({ request, wanted, settle });
      paintNext();
    });
    var buildMonetBackgroundUrl = async (options, wanted) => {
      const sourceUrl = resolveSourceUrl(options);
      if (!sourceUrl) return null;
      const image = await createImageBitmap(await loadImage(sourceUrl));
      const picture = await paintOffThread({
        image,
        colors: {
          backgroundColor: options.theme.backgroundColor,
          primaryColor: options.theme.primaryColor,
          accentColor: options.theme.accentColor
        },
        tuning: options.tuning,
        blurPx: checkCanvasFilterSupport() ? clamp4(options.tuning.backgroundBlurPx, 0, 60) : null
      }, wanted);
      if (!picture) return picture;
      const url = URL.createObjectURL(picture);
      const decoded = new Image();
      decoded.src = url;
      try {
        await decoded.decode();
      } catch (error2) {
        URL.revokeObjectURL(url);
        throw error2;
      }
      return url;
    };
    var wantMonetBackgroundUrl = (options) => {
      const cacheKey = getMonetBackgroundCacheKey(options);
      let entry = monetBackgroundCache.get(cacheKey);
      if (!entry) {
        const made = { url: Promise.resolve(null), holders: 0 };
        const wanted = () => {
          if (made.holders > 0) return true;
          if (monetBackgroundCache.get(cacheKey) === made) monetBackgroundCache.delete(cacheKey);
          return false;
        };
        const forget = () => {
          if (monetBackgroundCache.get(cacheKey) === made) monetBackgroundCache.delete(cacheKey);
        };
        made.url = buildMonetBackgroundUrl(options, wanted).then(
          (url) => {
            if (url === null) forget();
            return url ?? null;
          },
          (error2) => {
            console.warn("[MonetBackground] The picture could not be made:", error2);
            forget();
            return null;
          }
        );
        monetBackgroundCache.set(cacheKey, made);
        entry = made;
      }
      const held = entry;
      held.holders += 1;
      let released = false;
      return {
        url: held.url,
        release: () => {
          if (!released) {
            released = true;
            held.holders -= 1;
          }
        }
      };
    };
  
    // src/render/folia/components/visualizer/backgrounds/monet/monetBackgroundDrift.ts
    var DRIFT_LOOP_SECONDS = 240;
    var DRIFT_LATTICE_POINTS = 76;
    var DRIFT_SAMPLE_COUNT = 156;
    var DRIFT_MAX_TRAVEL_PERCENT = 3.4;
    var DRIFT_BREATH_AMPLITUDE = 0.035;
    var DRIFT_OVERSCAN_MARGIN = 0.01;
    var DRIFT_SEED_X = 12.9898;
    var DRIFT_SEED_Y = 78.233;
    var DRIFT_SEED_SCALE = 39.425;
    var wrap = (value, modulus) => (value % modulus + modulus) % modulus;
    var hash = (lattice, seed) => {
      const value = Math.sin(lattice * 127.1 + seed * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    var smoothstep = (t) => t * t * (3 - 2 * t);
    var periodicNoise = (t, points, seed) => {
      const cell = Math.floor(t);
      const from = hash(wrap(cell, points), seed);
      const to = hash(wrap(cell + 1, points), seed);
      return from + (to - from) * smoothstep(t - cell);
    };
    var periodicFbm = (t, seed) => {
      const base = periodicNoise(t, DRIFT_LATTICE_POINTS, seed);
      const detail = periodicNoise(t * 2, DRIFT_LATTICE_POINTS * 2, seed + 17.31);
      return (base * 0.68 + detail * 0.32) * 2 - 1;
    };
    var normalize = (samples) => {
      const peak = samples.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
      return peak > 0 ? samples.map((value) => value / peak) : samples;
    };
    var buildMonetDriftTrack = (strength) => {
      const clamped = Math.min(1, Math.max(0, strength));
      const travelPercent = DRIFT_MAX_TRAVEL_PERCENT * clamped;
      const minScale = 1 + travelPercent / 100 * 2 + DRIFT_OVERSCAN_MARGIN;
      const breath = DRIFT_BREATH_AMPLITUDE * clamped;
      const rawX = [];
      const rawY = [];
      const rawScale = [];
      for (let index = 0; index <= DRIFT_SAMPLE_COUNT; index += 1) {
        const t = DRIFT_LATTICE_POINTS * index / DRIFT_SAMPLE_COUNT;
        rawX.push(periodicFbm(t, DRIFT_SEED_X));
        rawY.push(periodicFbm(t, DRIFT_SEED_Y));
        rawScale.push(periodicFbm(t, DRIFT_SEED_SCALE));
      }
      const x = normalize(rawX);
      const y = normalize(rawY);
      const scale = normalize(rawScale);
      const keyframes = x.map((offsetX, index) => ({
        transform: `translate3d(${(offsetX * travelPercent).toFixed(4)}%, ${(y[index] * travelPercent).toFixed(4)}%, 0) scale(${(minScale + breath * ((scale[index] + 1) / 2)).toFixed(5)})`
      }));
      return {
        keyframes,
        durationMs: DRIFT_LOOP_SECONDS * 1e3,
        maxTravelPercent: travelPercent,
        minScale
      };
    };
  
    // src/render/folia/hooks/useReducedMotionFor.ts
    var useReducedMotionFor = (_surface) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    };
  
    // src/render/folia/components/visualizer/backgrounds/monet/MonetBackgroundLayer.tsx
    var PIPELINE_DEBOUNCE_MS = 180;
    var clamp5 = (value, min, max) => Math.min(max, Math.max(min, value));
    var useMonetBackgroundDrift = (ref, enabled, strength, reducedMotion) => {
      useEffect(() => {
        const element = ref.current;
        if (!element || !enabled || strength <= 0 || typeof element.animate !== "function") {
          return;
        }
        if (reducedMotion) return;
        const track = buildMonetDriftTrack(strength);
        const animation = element.animate(track.keyframes, {
          duration: track.durationMs,
          iterations: Infinity,
          easing: "linear"
        });
        return () => animation.cancel();
      }, [enabled, ref, strength, reducedMotion]);
    };
    var resolveMonetSourceUrl = (coverUrl, monetBackgroundImage, tuning) => tuning.backgroundSource === "uploaded-global" ? monetBackgroundImage?.url ?? coverUrl ?? null : coverUrl ?? monetBackgroundImage?.url ?? null;
    var MonetBackgroundLayer = ({
      coverUrl,
      monetBackgroundImage,
      theme,
      isDaylight = false,
      tuning = DEFAULT_MONET_BACKGROUND_TUNING,
      transparentBackground = false,
      staticMode = false
    }) => {
      const [pipelineUrl, setPipelineUrl] = useState(null);
      const [isPipelinePending, setIsPipelinePending] = useState(false);
      const sourceUrl = resolveMonetSourceUrl(coverUrl, monetBackgroundImage, tuning);
      const pictureDrawn = useFirstFrameDrawn();
      const [firstPicture, setFirstPicture] = useState(null);
      const shownSource = useRef(null);
      const fallbackGradient = useMemo(
        () => `linear-gradient(135deg, ${colorWithAlpha(theme.accentColor, 0.22)}, ${colorWithAlpha(theme.backgroundColor, 0.96)} 50%, ${colorWithAlpha(theme.primaryColor, 0.18)})`,
        [theme]
      );
      const readabilityGradient = useMemo(
        () => `linear-gradient(90deg, ${colorWithAlpha(theme.backgroundColor, 0.18)} 0%, ${colorWithAlpha(theme.backgroundColor, 0.32)} 34%, ${colorWithAlpha(theme.backgroundColor, 0.66)} 70%, ${colorWithAlpha(theme.backgroundColor, 0.82)} 100%)`,
        [theme]
      );
      const backgroundCacheKey = useMemo(
        () => getMonetBackgroundCacheKey({
          coverUrl,
          monetBackgroundImage,
          theme,
          tuning
        }),
        [coverUrl, monetBackgroundImage, theme, tuning]
      );
      useEffect(() => {
        let cancelled = false;
        let timeoutId;
        if (!sourceUrl || transparentBackground) {
          setPipelineUrl(null);
          setIsPipelinePending(false);
          pictureDrawn();
          return () => {
            cancelled = true;
          };
        }
        setIsPipelinePending(true);
        const options = { coverUrl, monetBackgroundImage, theme, tuning };
        const early = sourceUrl !== shownSource.current ? wantMonetBackgroundUrl(options) : null;
        let timed = null;
        timeoutId = window.setTimeout(() => {
          timed = wantMonetBackgroundUrl(options);
          void timed.url.then((url) => {
            if (!cancelled) {
              setPipelineUrl((current) => current === url ? current : url);
              setIsPipelinePending(false);
              shownSource.current = sourceUrl;
              if (url) {
                setFirstPicture((current) => current ?? url);
              }
              pictureDrawn();
            }
          });
        }, PIPELINE_DEBOUNCE_MS);
        return () => {
          cancelled = true;
          if (timeoutId !== void 0) {
            window.clearTimeout(timeoutId);
          }
          early?.release();
          timed?.release();
        };
      }, [backgroundCacheKey, sourceUrl, transparentBackground, pictureDrawn]);
      const driftRef = useRef(null);
      const driftStrength = clamp5(tuning.backgroundDriftStrength ?? 0, 0, 1);
      const driftEnabled = Boolean(tuning.backgroundDriftEnabled) && !staticMode && driftStrength > 0;
      const reduceBackgroundMotion = useReducedMotionFor("monetBackground");
      useMonetBackgroundDrift(driftRef, driftEnabled, driftStrength, reduceBackgroundMotion);
      const driftStyle = useMemo(
        () => driftEnabled ? { willChange: "transform" } : void 0,
        [driftEnabled]
      );
      const isCanvasFilterSupported = useMemo(() => checkCanvasFilterSupport(), []);
      const blurValue = !isCanvasFilterSupported ? tuning.backgroundBlurPx : 0;
      const blurStyle = useMemo(() => {
        if (blurValue <= 0) return {};
        return {
          filter: `blur(${blurValue}px)`,
          WebkitFilter: `blur(${blurValue}px)`,
          transform: "scale(1.1) translateZ(0)"
        };
      }, [blurValue]);
      if (transparentBackground) {
        return null;
      }
      const resolvedBackgroundImage = pipelineUrl ? `url(${pipelineUrl})` : sourceUrl ? `linear-gradient(135deg, ${colorWithAlpha(theme.accentColor, 0.2)}, ${colorWithAlpha(theme.backgroundColor, 0.78)}), url(${sourceUrl})` : fallbackGradient;
      const arriving = isPipelinePending ? { [ARRIVING_MARK]: "" } : {};
      const pictureKey = pipelineUrl || sourceUrl || "fallback";
      const comesFrom = pictureKey === firstPicture ? false : { opacity: 0 };
      if (tuning.backgroundLayout === "full-overlay") {
        return /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 z-0 overflow-hidden", ...arriving, children: [
          /* @__PURE__ */ jsx("div", { ref: driftRef, className: "absolute inset-0", style: driftStyle, children: /* @__PURE__ */ jsx(AnimatePresence, { initial: false, children: /* @__PURE__ */ jsx(
            motion.div,
            {
              initial: comesFrom,
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.8, ease: "easeInOut" },
              className: "absolute inset-0",
              style: {
                backgroundColor: theme.backgroundColor,
                backgroundImage: resolvedBackgroundImage,
                backgroundSize: "cover",
                backgroundPosition: "center",
                ...blurStyle
              }
            },
            pictureKey
          ) }) }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0",
              style: { background: readabilityGradient }
            }
          )
        ] });
      }
      const baseImageOpacity = isDaylight ? 0.7 : 0.3;
      const imageOpacity = baseImageOpacity + clamp5(tuning.backgroundOverlayOpacity, 0, 1) * 0.16;
      const imagePositionX = clamp5(50 + tuning.backgroundHalfPaneOffsetX, 10, 90);
      return /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 z-0 overflow-hidden", ...arriving, children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              backgroundColor: theme.backgroundColor,
              backgroundImage: fallbackGradient
            }
          }
        ),
        /* @__PURE__ */ jsx(AnimatePresence, { initial: false, children: pipelineUrl || sourceUrl ? /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden",
            style: {
              WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)"
            },
            children: /* @__PURE__ */ jsx("div", { ref: driftRef, className: "absolute inset-0", style: driftStyle, children: /* @__PURE__ */ jsx(
              motion.div,
              {
                initial: comesFrom,
                animate: { opacity: imageOpacity },
                exit: { opacity: 0 },
                transition: { duration: 0.8, ease: "easeInOut" },
                className: "absolute inset-0",
                style: {
                  backgroundImage: resolvedBackgroundImage,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                  backgroundPosition: `${imagePositionX}% center`,
                  ...blurStyle
                }
              },
              pictureKey
            ) })
          }
        ) : null }),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              background: `linear-gradient(90deg, ${colorWithAlpha(theme.backgroundColor, 0.14)} 0%, ${colorWithAlpha(theme.backgroundColor, 0.28)} 28%, ${colorWithAlpha(theme.backgroundColor, 0.62)} 64%, ${colorWithAlpha(theme.backgroundColor, 0.86)} 100%)`
            }
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              backgroundImage: `radial-gradient(circle at 18% 34%, ${colorWithAlpha(theme.accentColor, 0.18)}, transparent 36%)`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: { background: readabilityGradient }
          }
        )
      ] });
    };
    var MonetBackgroundLayer_default = MonetBackgroundLayer;
  
    // src/render/folia/utils/coverUrl.ts
    var KUWO_COVER_HOST_PATTERN = /^img\d*(?:\.(?:sycdn|kwcdn))?\.kuwo\.cn$/i;
    var KUWO_COVER_PATH_PATTERN = /^(\/star\/(?:albumcover|starheads)\/)(\d+)(\/)/;
    var QQ_COVER_HOSTNAMES = /* @__PURE__ */ new Set(["y.gtimg.cn", "y.qq.com"]);
    var QQ_COVER_PATH_PATTERN = /(T00[12])(?:R(\d+)x\d+)?(M000)/;
    var APPLE_COVER_HOST_PATTERN = /(?:^|\.)mzstatic\.com$/i;
    var APPLE_COVER_PATH_PATTERN = /\/(\d+)x(\d+)([a-z]{2})?\.(jpe?g|png|webp)$/i;
    var APPLE_COVER_ORIGINAL_BOX = 5e3;
    var GOOGLE_COVER_HOST_PATTERN = /\.(?:googleusercontent|ggpht)\.com$/i;
    var GOOGLE_COVER_SIZE_PATTERN = /=w(\d+)-h(\d+)((?:-[^=/]*)?)$/;
    var isKuwoCoverUrl = (url) => KUWO_COVER_HOST_PATTERN.test(url.hostname) && KUWO_COVER_PATH_PATTERN.test(url.pathname);
    var withKuwoCoverSize = (url, size) => {
      url.pathname = url.pathname.replace(KUWO_COVER_PATH_PATTERN, `$1${size}$3`);
      return url.toString();
    };
    var isQqCoverUrl = (url) => QQ_COVER_HOSTNAMES.has(url.hostname) && QQ_COVER_PATH_PATTERN.test(url.pathname);
    var squareSize = (match) => match && match[1] === match[2] ? Number(match[1]) : null;
    var isAppleCoverUrl = (url) => APPLE_COVER_HOST_PATTERN.test(url.hostname) && squareSize(APPLE_COVER_PATH_PATTERN.exec(url.pathname)) !== null;
    var withAppleCoverSize = (url, size) => {
      url.pathname = url.pathname.replace(APPLE_COVER_PATH_PATTERN, (_match, _w, _h, box = "", extension) => `/${size}x${size}${box}.${extension}`);
      return url.toString();
    };
    var isGoogleCoverUrl = (url) => GOOGLE_COVER_HOST_PATTERN.test(url.hostname) && squareSize(GOOGLE_COVER_SIZE_PATTERN.exec(url.pathname)) !== null;
    var withQqCoverSize = (url, size) => {
      url.pathname = url.pathname.replace(
        QQ_COVER_PATH_PATTERN,
        size ? `$1R${size}x${size}$3` : "$1$3"
      );
      return url.toString();
    };
    var getOriginalCoverUrl = (url) => {
      const trimmedUrl = url?.trim() ?? "";
      if (!trimmedUrl) return "";
      try {
        const urlObj = new URL(trimmedUrl);
        if (urlObj.hostname.includes("126.net") && urlObj.searchParams.has("param")) {
          urlObj.searchParams.delete("param");
          return urlObj.toString();
        }
        if (isKuwoCoverUrl(urlObj)) {
          const originalSize = Number(KUWO_COVER_PATH_PATTERN.exec(urlObj.pathname)?.[2]);
          return withKuwoCoverSize(urlObj, Math.max(COVER_MAX_SIZE, originalSize));
        }
        if (isAppleCoverUrl(urlObj)) return withAppleCoverSize(urlObj, APPLE_COVER_ORIGINAL_BOX);
        if (isGoogleCoverUrl(urlObj)) {
          urlObj.pathname = urlObj.pathname.replace(GOOGLE_COVER_SIZE_PATTERN, "=s0");
          return urlObj.toString();
        }
        return isQqCoverUrl(urlObj) ? withQqCoverSize(urlObj, null) : trimmedUrl;
      } catch {
        return trimmedUrl;
      }
    };
    var COVER_MAX_SIZE = 1200;
  
    // src/render/folia/components/visualizer/backgrounds/monet/entry.tsx
    var SOURCE_LABEL_KEYS = {
      "cover-derived": "options.monetBackgroundSourceCover",
      "uploaded-global": "options.monetBackgroundSourceUploaded"
    };
    var fullCover = (coverUrl) => coverUrl ? getOriginalCoverUrl(coverUrl) : coverUrl;
    var entry_default3 = defineVisualizerBackground({
      mode: "monet",
      order: 20,
      labelKey: "options.visualizerBackgroundModeMonet",
      labelFallback: "Monet",
      // 莫奈：整幅画面被一条斜线分成两种处理
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("rect", { x: "3.5", y: "4.5", width: "17", height: "15", rx: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M20.5 8.5L8 19.5", opacity: "0.55" })
      ] }),
      // The picture is made from the cover, or from the uploaded image where that comes first. The theme
      // colours change in place, with the picture's own crossfade.
      song: ({ config, coverUrl }) => [
        resolveMonetSourceUrl(fullCover(coverUrl), config?.customImage, config?.monet?.tuning ?? DEFAULT_MONET_BACKGROUND_TUNING)
      ],
      render: ({ config, coverUrl, theme, isDaylight, staticMode }) => /* @__PURE__ */ jsx(
        MonetBackgroundLayer_default,
        {
          coverUrl: fullCover(coverUrl),
          monetBackgroundImage: config?.customImage,
          theme,
          isDaylight,
          tuning: config?.monet?.tuning,
          transparentBackground: config?.transparent,
          staticMode
        }
      ),
      renderSettingsPanel: ({
        config,
        actions,
        t,
        onSliderPointerDown,
        onSliderCommit
      }) => /* @__PURE__ */ jsx(
        MonetBackgroundSettingsCard,
        {
          t,
          tuning: config?.monet?.tuning ?? DEFAULT_MONET_BACKGROUND_TUNING,
          onTuningChange: actions?.monet?.onTuningChange,
          monetBackgroundImage: config?.customImage,
          onUploadMonetBackgroundImage: actions?.customImage?.onUpload,
          onClearMonetBackgroundImage: actions?.customImage?.onClear,
          isLoadingMonetBackgroundImage: actions?.customImage?.isLoading,
          onSliderPointerDown,
          onSliderCommit
        }
      ),
      renderQuickControls: ({ config, actions, t }) => {
        const tuning = config?.monet?.tuning ?? DEFAULT_MONET_BACKGROUND_TUNING;
        const isFullOverlay = tuning.backgroundLayout === "full-overlay";
        const layoutLabel = t(isFullOverlay ? "options.monetLayoutFullOverlay" : "options.monetLayoutHalfPane");
        const change = (patch) => actions?.monet?.onTuningChange?.(patch);
        const source = tuning.backgroundSource;
        const sourceLabel = t(SOURCE_LABEL_KEYS[source]);
        const hasImage = Boolean(config?.customImage);
        return /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: layoutLabel,
              title: `${t("options.monetBackgroundLayout")}: ${layoutLabel}`,
              onClick: () => change({
                backgroundLayout: isFullOverlay ? "half-pane-gradient" : "full-overlay"
              })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: sourceLabel,
              title: `${t("options.monetBackgroundSource")}: ${sourceLabel}`,
              disabled: !hasImage && source === "cover-derived",
              onClick: () => change({ backgroundSource: hasImage && source === "cover-derived" ? "uploaded-global" : "cover-derived" })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: tuning.backgroundStreaksEnabled,
              label: t("options.monetBackgroundStreaksEnabled"),
              onToggle: () => change({ backgroundStreaksEnabled: !tuning.backgroundStreaksEnabled }),
              children: /* @__PURE__ */ jsx(Columns3, { size: 14 })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: tuning.backgroundDriftEnabled,
              label: t("options.monetBackgroundDriftEnabled"),
              onToggle: () => change({ backgroundDriftEnabled: !tuning.backgroundDriftEnabled }),
              children: /* @__PURE__ */ jsx(Wind, { size: 14 })
            }
          )
        ] });
      },
      resetSettings: (actions) => actions?.monet?.onResetTuning?.()
    });
  
    // src/render/folia/components/visualizer/backgrounds/nomand/nomandShaderAdjustments.ts
    var MAX_OVERSCAN = 1.8;
    var OVERSCAN_MARGIN = 0.01;
    var REFERENCE_ASPECT = 16 / 9;
    var NOMAND_PAPER_TEXTURE_SHAPE = {
      fiberSize: 0.2,
      crumples: 0.35,
      crumpleSize: 0.35,
      folds: 0.65,
      foldCount: 5,
      drops: 0.2,
      seed: 5.8
    };
    var NOMAND_LENS_SHAPE = {
      perspective: 0.4,
      count: 20,
      focusCenter: 0.55,
      focusEdges: 0.8,
      swirl: 0.08,
      lensCircle: 0.1
    };
    var clamp012 = (value) => Math.min(1, Math.max(0, value));
    var clampOverscan = (scale) => Math.min(MAX_OVERSCAN, Math.max(1, scale));
    var applyOverscanMargin = (scale) => scale <= 1 ? 1 : clampOverscan(scale + OVERSCAN_MARGIN);
    var overscanForMargin = (margin) => applyOverscanMargin(1 / (1 - 2 * Math.min(Math.max(margin, 0), 0.45)));
    var resolveDaylightInversion = (inverted, originalColors, isDaylight) => isDaylight && !originalColors ? !inverted : inverted;
    var resolveHalftoneInversion = (inverted, originalColors, isDaylight) => resolveDaylightInversion(!inverted, originalColors, isDaylight);
    var getPaperTextureOverscan = (roughness, fiber) => {
      const { folds, crumples, drops } = NOMAND_PAPER_TEXTURE_SHAPE;
      const maxNormal = 2 * folds + 1.5 * crumples + 0.2 * drops + 0.75 * clamp012(roughness) + 0.1 * clamp012(fiber);
      return overscanForMargin(0.02 * maxNormal);
    };
    var getLensDistortionOverscan = (bulge, spread) => {
      const outRadius = 0.5 * Math.hypot(REFERENCE_ASPECT, 1);
      const clampedSpread = clamp012(spread);
      const reach = 0.7 * Math.pow(clampedSpread, 1.3 + 2.7 * clampedSpread);
      const edgeReach = reach * (1 - NOMAND_LENS_SHAPE.focusEdges);
      const headroom = Math.max(0.35, 1 - edgeReach / outRadius);
      if (bulge <= 0) return applyOverscanMargin(1 / headroom);
      const bulgeAmount = Math.min(bulge, 1) * 1.4;
      const cornerPush = (scale) => {
        const cornerRn = 2 * outRadius / scale;
        return Math.tan(cornerRn * bulgeAmount) / Math.tan(bulgeAmount) / cornerRn;
      };
      let low = Math.max(1, 2 * outRadius * bulgeAmount / 1.45);
      if (low >= MAX_OVERSCAN || cornerPush(MAX_OVERSCAN) > MAX_OVERSCAN * headroom) return MAX_OVERSCAN;
      if (low === 1 && cornerPush(1) <= headroom) return applyOverscanMargin(1 / headroom);
      let high = MAX_OVERSCAN;
      for (let step = 0; step < 32; step += 1) {
        const mid = (low + high) / 2;
        if (cornerPush(mid) > mid * headroom) low = mid;
        else high = mid;
      }
      return applyOverscanMargin(high);
    };
  
    // src/render/folia/components/visualizer/backgrounds/nomand/NomandBackgroundLayer.tsx
    var useShaderDrawn = (shaderRef, shader) => {
      const drawn = useFirstFrameDrawn();
      useEffect(() => {
        if (shader === null) {
          drawn();
          return void 0;
        }
        let frame = 0;
        const look = () => {
          frame = requestAnimationFrame(shaderRef.current?.paperShaderMount ? drawn : look);
        };
        look();
        return () => cancelAnimationFrame(frame);
      }, [shaderRef, shader, drawn]);
    };
    var resolveNomandSourceUrl = (coverUrl, monetBackgroundImage, tuning) => tuning.imageSource === "uploaded-global" ? monetBackgroundImage?.url ?? coverUrl : coverUrl ?? monetBackgroundImage?.url;
    var NomandBackgroundLayer = ({
      coverUrl,
      monetBackgroundImage,
      tuning: tuningOverride,
      theme,
      isDaylight
    }) => {
      const tuning = { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...tuningOverride };
      const sourceUrl = resolveNomandSourceUrl(coverUrl, monetBackgroundImage, tuning);
      const shaderRef = useRef(null);
      useShaderDrawn(shaderRef, sourceUrl ? `${sourceUrl}:${tuning.effect}` : null);
      if (!sourceUrl) {
        return /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0 z-0",
            style: { backgroundColor: theme.backgroundColor }
          }
        );
      }
      const renderShader = () => {
        const commonProps = {
          width: "100%",
          height: "100%",
          ref: shaderRef,
          image: sourceUrl,
          fit: "cover",
          minPixelRatio: 1,
          maxPixelCount: 1920 * 1080,
          webGlContextAttributes: PAPER_SHADER_CONTEXT_ATTRIBUTES,
          style: { width: "100%", height: "100%" }
        };
        switch (tuning.effect) {
          case "fluted-glass":
            return /* @__PURE__ */ jsx(
              FlutedGlass,
              {
                ...commonProps,
                colorBack: theme.backgroundColor,
                colorShadow: theme.secondaryColor,
                colorHighlight: theme.primaryColor,
                shadows: 0.25,
                size: tuning.flutedGlassSize,
                distortion: tuning.flutedGlassDistortion,
                blur: tuning.flutedGlassBlur,
                shape: "lines",
                distortionShape: "prism",
                highlights: 0.1,
                edges: 0.25
              },
              `${sourceUrl}:fluted-glass`
            );
          case "paper-texture":
            return /* @__PURE__ */ jsx(
              PaperTexture,
              {
                ...commonProps,
                ...NOMAND_PAPER_TEXTURE_SHAPE,
                colorFront: theme.accentColor,
                colorBack: theme.backgroundColor,
                contrast: tuning.paperTextureContrast,
                roughness: tuning.paperTextureRoughness,
                fiber: tuning.paperTextureFiber,
                scale: getPaperTextureOverscan(tuning.paperTextureRoughness, tuning.paperTextureFiber)
              },
              `${sourceUrl}:paper-texture`
            );
          case "halftone-dots":
            return /* @__PURE__ */ jsx(
              HalftoneDots,
              {
                ...commonProps,
                colorBack: theme.backgroundColor,
                colorFront: theme.accentColor,
                size: tuning.halftoneDotsSize,
                radius: tuning.halftoneDotsRadius,
                contrast: tuning.halftoneDotsContrast,
                originalColors: tuning.halftoneDotsOriginalColors,
                inverted: resolveHalftoneInversion(
                  tuning.halftoneDotsInverted,
                  tuning.halftoneDotsOriginalColors,
                  isDaylight
                ),
                grid: "hex",
                type: "gooey",
                grainMixer: 0.12,
                grainOverlay: 0.06,
                grainSize: 0.5
              },
              `${sourceUrl}:halftone-dots`
            );
          case "lens-distortion":
            return /* @__PURE__ */ jsx(
              LensDistortion,
              {
                ...commonProps,
                ...NOMAND_LENS_SHAPE,
                spread: tuning.lensDistortionSpread,
                dispersion: tuning.lensDistortionDispersion,
                lensBulge: tuning.lensDistortionBulge,
                scale: getLensDistortionOverscan(tuning.lensDistortionBulge, tuning.lensDistortionSpread)
              },
              `${sourceUrl}:lens-distortion`
            );
          default:
            return /* @__PURE__ */ jsx(
              ImageDithering,
              {
                ...commonProps,
                colorBack: theme.backgroundColor,
                colorFront: theme.accentColor,
                colorHighlight: theme.primaryColor,
                originalColors: tuning.originalColors,
                inverted: resolveDaylightInversion(tuning.inverted, tuning.originalColors, isDaylight),
                type: tuning.ditheringType,
                size: tuning.size,
                colorSteps: tuning.colorSteps
              },
              `${sourceUrl}:dithering`
            );
        }
      };
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "absolute inset-0 z-0 overflow-hidden",
          style: { backgroundColor: theme.backgroundColor, pointerEvents: "none" },
          children: [
            renderShader(),
            tuning.overlayEnabled && tuning.overlayOpacity > 0 && /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute inset-0",
                style: {
                  backgroundColor: theme.backgroundColor,
                  opacity: tuning.overlayOpacity
                }
              }
            )
          ]
        }
      );
    };
    var NomandBackgroundLayer_default = react_shim_default.memo(NomandBackgroundLayer);
  
    // src/render/folia/components/visualizer/backgrounds/nomand/NomandBackgroundEffectSettings.tsx
    var EFFECTS = [
      "dithering",
      "fluted-glass",
      "paper-texture",
      "halftone-dots",
      "lens-distortion"
    ];
    var EFFECT_LABEL_KEYS = {
      dithering: "options.nomandBackgroundEffectDithering",
      "fluted-glass": "options.nomandBackgroundEffectFlutedGlass",
      "paper-texture": "options.nomandBackgroundEffectPaperTexture",
      "halftone-dots": "options.nomandBackgroundEffectHalftoneDots",
      "lens-distortion": "options.nomandBackgroundEffectLensDistortion"
    };
  
    // src/render/folia/components/visualizer/backgrounds/nomand/entry.tsx
    var SOURCE_LABEL_KEYS2 = {
      "cover-derived": "options.monetBackgroundSourceCover",
      "uploaded-global": "options.monetBackgroundSourceUploaded"
    };
    var fullCover2 = (coverUrl) => coverUrl ? getOriginalCoverUrl(coverUrl) : coverUrl;
    var entry_default4 = defineVisualizerBackground({
      mode: "nomand",
      order: 30,
      labelKey: "options.visualizerBackgroundModeNomand",
      labelFallback: "Nomand",
      // 漫游：像素块
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "6.5", height: "6.5", rx: "0.8" }),
        /* @__PURE__ */ jsx("rect", { x: "13.5", y: "4", width: "6.5", height: "6.5", rx: "0.8", opacity: "0.45" }),
        /* @__PURE__ */ jsx("rect", { x: "4", y: "13.5", width: "6.5", height: "6.5", rx: "0.8", opacity: "0.45" }),
        /* @__PURE__ */ jsx("rect", { x: "13.5", y: "13.5", width: "6.5", height: "6.5", rx: "0.8" })
      ] }),
      command: {
        title: "Background: Nomand",
        description: "Switch background to theme-colored image dithering",
        keywords: ["nomand", "dithering", "dither", "shader background", "\u6F2B\u6E38", "\u50CF\u7D20\u753B", "\u50CF\u7D20\u753B\u80CC\u666F", "\u6296\u52A8\u80CC\u666F", "\u7F51\u70B9\u80CC\u666F", "\u4E3B\u9898\u8272\u80CC\u666F"]
      },
      // The shader draws one image and cannot blend to another, so a new song's image comes as a new copy;
      // the copy on screen was already rebuilt for every new image (its elements are keyed by it).
      song: ({ config, coverUrl }) => [
        resolveNomandSourceUrl(fullCover2(coverUrl), config?.customImage, { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...config?.nomand?.tuning }) ?? null
      ],
      render: ({ config, coverUrl, theme, isDaylight }) => /* @__PURE__ */ jsx(
        NomandBackgroundLayer_default,
        {
          coverUrl: fullCover2(coverUrl),
          monetBackgroundImage: config?.customImage,
          tuning: config?.nomand?.tuning,
          theme,
          isDaylight
        }
      ),
      renderSettingsPanel: ({ config, actions, ...props }) => /* @__PURE__ */ jsx(
        settings_card_default,
        {
          ...props,
          tuning: config?.nomand?.tuning ?? DEFAULT_NOMAND_BACKGROUND_TUNING,
          onTuningChange: actions?.nomand?.onTuningChange,
          monetBackgroundImage: config?.customImage,
          onUploadMonetBackgroundImage: actions?.customImage?.onUpload,
          onClearMonetBackgroundImage: actions?.customImage?.onClear,
          isLoadingMonetBackgroundImage: actions?.customImage?.isLoading
        }
      ),
      renderQuickControls: ({ config, actions, t }) => {
        const tuning = config?.nomand?.tuning ?? DEFAULT_NOMAND_BACKGROUND_TUNING;
        const change = (patch) => actions?.nomand?.onTuningChange?.(patch);
        const source = tuning.imageSource;
        const sourceLabel = t(SOURCE_LABEL_KEYS2[source]);
        const hasImage = Boolean(config?.customImage);
        const effectLabel = t(EFFECT_LABEL_KEYS[tuning.effect]);
        return /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: sourceLabel,
              title: `${t("options.nomandBackgroundSource")}: ${sourceLabel}`,
              disabled: !hasImage && source === "cover-derived",
              onClick: () => change({ imageSource: hasImage && source === "cover-derived" ? "uploaded-global" : "cover-derived" })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlChip,
            {
              label: effectLabel,
              title: `${t("options.nomandBackgroundEffect")}: ${effectLabel}`,
              onClick: () => change({ effect: cycleValue(EFFECTS, tuning.effect) })
            }
          ),
          /* @__PURE__ */ jsx(
            QuickControlToggle,
            {
              active: tuning.overlayEnabled,
              label: t("options.nomandBackgroundOverlay"),
              onToggle: () => change({ overlayEnabled: !tuning.overlayEnabled }),
              children: /* @__PURE__ */ jsx(Layers, { size: 14 })
            }
          )
        ] });
      },
      resetSettings: (actions) => actions?.nomand?.onResetTuning?.()
    });
  
    // src/render/folia/vendor/twgl/dist/7.x/twgl-full.module.js
    var VecType = Float32Array;
    function create$1(x, y, z) {
      const dst = new VecType(3);
      if (x) {
        dst[0] = x;
      }
      if (y) {
        dst[1] = y;
      }
      if (z) {
        dst[2] = z;
      }
      return dst;
    }
    function add(a, b, dst) {
      dst = dst || new VecType(3);
      dst[0] = a[0] + b[0];
      dst[1] = a[1] + b[1];
      dst[2] = a[2] + b[2];
      return dst;
    }
    function multiply$1(a, b, dst) {
      dst = dst || new VecType(3);
      dst[0] = a[0] * b[0];
      dst[1] = a[1] * b[1];
      dst[2] = a[2] * b[2];
      return dst;
    }
    var MatType = Float32Array;
    function identity(dst) {
      dst = dst || new MatType(16);
      dst[0] = 1;
      dst[1] = 0;
      dst[2] = 0;
      dst[3] = 0;
      dst[4] = 0;
      dst[5] = 1;
      dst[6] = 0;
      dst[7] = 0;
      dst[8] = 0;
      dst[9] = 0;
      dst[10] = 1;
      dst[11] = 0;
      dst[12] = 0;
      dst[13] = 0;
      dst[14] = 0;
      dst[15] = 1;
      return dst;
    }
    function inverse(m, dst) {
      dst = dst || new MatType(16);
      const m00 = m[0 * 4 + 0];
      const m01 = m[0 * 4 + 1];
      const m02 = m[0 * 4 + 2];
      const m03 = m[0 * 4 + 3];
      const m10 = m[1 * 4 + 0];
      const m11 = m[1 * 4 + 1];
      const m12 = m[1 * 4 + 2];
      const m13 = m[1 * 4 + 3];
      const m20 = m[2 * 4 + 0];
      const m21 = m[2 * 4 + 1];
      const m22 = m[2 * 4 + 2];
      const m23 = m[2 * 4 + 3];
      const m30 = m[3 * 4 + 0];
      const m31 = m[3 * 4 + 1];
      const m32 = m[3 * 4 + 2];
      const m33 = m[3 * 4 + 3];
      const tmp_0 = m22 * m33;
      const tmp_1 = m32 * m23;
      const tmp_2 = m12 * m33;
      const tmp_3 = m32 * m13;
      const tmp_4 = m12 * m23;
      const tmp_5 = m22 * m13;
      const tmp_6 = m02 * m33;
      const tmp_7 = m32 * m03;
      const tmp_8 = m02 * m23;
      const tmp_9 = m22 * m03;
      const tmp_10 = m02 * m13;
      const tmp_11 = m12 * m03;
      const tmp_12 = m20 * m31;
      const tmp_13 = m30 * m21;
      const tmp_14 = m10 * m31;
      const tmp_15 = m30 * m11;
      const tmp_16 = m10 * m21;
      const tmp_17 = m20 * m11;
      const tmp_18 = m00 * m31;
      const tmp_19 = m30 * m01;
      const tmp_20 = m00 * m21;
      const tmp_21 = m20 * m01;
      const tmp_22 = m00 * m11;
      const tmp_23 = m10 * m01;
      const t0 = tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31 - (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
      const t1 = tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31 - (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
      const t2 = tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31 - (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
      const t3 = tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21 - (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);
      const d = 1 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
      dst[0] = d * t0;
      dst[1] = d * t1;
      dst[2] = d * t2;
      dst[3] = d * t3;
      dst[4] = d * (tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30 - (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
      dst[5] = d * (tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30 - (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
      dst[6] = d * (tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30 - (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
      dst[7] = d * (tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20 - (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
      dst[8] = d * (tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33 - (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
      dst[9] = d * (tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33 - (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
      dst[10] = d * (tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33 - (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
      dst[11] = d * (tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23 - (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
      dst[12] = d * (tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12 - (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
      dst[13] = d * (tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22 - (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
      dst[14] = d * (tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02 - (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
      dst[15] = d * (tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12 - (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));
      return dst;
    }
    function transformPoint(m, v, dst) {
      dst = dst || create$1();
      const v0 = v[0];
      const v1 = v[1];
      const v2 = v[2];
      const d = v0 * m[0 * 4 + 3] + v1 * m[1 * 4 + 3] + v2 * m[2 * 4 + 3] + m[3 * 4 + 3];
      dst[0] = (v0 * m[0 * 4 + 0] + v1 * m[1 * 4 + 0] + v2 * m[2 * 4 + 0] + m[3 * 4 + 0]) / d;
      dst[1] = (v0 * m[0 * 4 + 1] + v1 * m[1 * 4 + 1] + v2 * m[2 * 4 + 1] + m[3 * 4 + 1]) / d;
      dst[2] = (v0 * m[0 * 4 + 2] + v1 * m[1 * 4 + 2] + v2 * m[2 * 4 + 2] + m[3 * 4 + 2]) / d;
      return dst;
    }
    function transformDirection(m, v, dst) {
      dst = dst || create$1();
      const v0 = v[0];
      const v1 = v[1];
      const v2 = v[2];
      dst[0] = v0 * m[0 * 4 + 0] + v1 * m[1 * 4 + 0] + v2 * m[2 * 4 + 0];
      dst[1] = v0 * m[0 * 4 + 1] + v1 * m[1 * 4 + 1] + v2 * m[2 * 4 + 1];
      dst[2] = v0 * m[0 * 4 + 2] + v1 * m[1 * 4 + 2] + v2 * m[2 * 4 + 2];
      return dst;
    }
    var BYTE$2 = 5120;
    var UNSIGNED_BYTE$3 = 5121;
    var SHORT$2 = 5122;
    var UNSIGNED_SHORT$3 = 5123;
    var INT$3 = 5124;
    var UNSIGNED_INT$3 = 5125;
    var FLOAT$3 = 5126;
    var UNSIGNED_SHORT_4_4_4_4$1 = 32819;
    var UNSIGNED_SHORT_5_5_5_1$1 = 32820;
    var UNSIGNED_SHORT_5_6_5$1 = 33635;
    var HALF_FLOAT$1 = 5131;
    var UNSIGNED_INT_2_10_10_10_REV$1 = 33640;
    var UNSIGNED_INT_10F_11F_11F_REV$1 = 35899;
    var UNSIGNED_INT_5_9_9_9_REV$1 = 35902;
    var FLOAT_32_UNSIGNED_INT_24_8_REV$1 = 36269;
    var UNSIGNED_INT_24_8$1 = 34042;
    var glTypeToTypedArray = {};
    {
      const tt = glTypeToTypedArray;
      tt[BYTE$2] = Int8Array;
      tt[UNSIGNED_BYTE$3] = Uint8Array;
      tt[SHORT$2] = Int16Array;
      tt[UNSIGNED_SHORT$3] = Uint16Array;
      tt[INT$3] = Int32Array;
      tt[UNSIGNED_INT$3] = Uint32Array;
      tt[FLOAT$3] = Float32Array;
      tt[UNSIGNED_SHORT_4_4_4_4$1] = Uint16Array;
      tt[UNSIGNED_SHORT_5_5_5_1$1] = Uint16Array;
      tt[UNSIGNED_SHORT_5_6_5$1] = Uint16Array;
      tt[HALF_FLOAT$1] = Uint16Array;
      tt[UNSIGNED_INT_2_10_10_10_REV$1] = Uint32Array;
      tt[UNSIGNED_INT_10F_11F_11F_REV$1] = Uint32Array;
      tt[UNSIGNED_INT_5_9_9_9_REV$1] = Uint32Array;
      tt[FLOAT_32_UNSIGNED_INT_24_8_REV$1] = Uint32Array;
      tt[UNSIGNED_INT_24_8$1] = Uint32Array;
    }
    function getGLTypeForTypedArray(typedArray) {
      if (typedArray instanceof Int8Array) {
        return BYTE$2;
      }
      if (typedArray instanceof Uint8Array) {
        return UNSIGNED_BYTE$3;
      }
      if (typedArray instanceof Uint8ClampedArray) {
        return UNSIGNED_BYTE$3;
      }
      if (typedArray instanceof Int16Array) {
        return SHORT$2;
      }
      if (typedArray instanceof Uint16Array) {
        return UNSIGNED_SHORT$3;
      }
      if (typedArray instanceof Int32Array) {
        return INT$3;
      }
      if (typedArray instanceof Uint32Array) {
        return UNSIGNED_INT$3;
      }
      if (typedArray instanceof Float32Array) {
        return FLOAT$3;
      }
      throw new Error("unsupported typed array type");
    }
    function getGLTypeForTypedArrayType(typedArrayType) {
      if (typedArrayType === Int8Array) {
        return BYTE$2;
      }
      if (typedArrayType === Uint8Array) {
        return UNSIGNED_BYTE$3;
      }
      if (typedArrayType === Uint8ClampedArray) {
        return UNSIGNED_BYTE$3;
      }
      if (typedArrayType === Int16Array) {
        return SHORT$2;
      }
      if (typedArrayType === Uint16Array) {
        return UNSIGNED_SHORT$3;
      }
      if (typedArrayType === Int32Array) {
        return INT$3;
      }
      if (typedArrayType === Uint32Array) {
        return UNSIGNED_INT$3;
      }
      if (typedArrayType === Float32Array) {
        return FLOAT$3;
      }
      throw new Error("unsupported typed array type");
    }
    function getTypedArrayTypeForGLType(type) {
      const CTOR = glTypeToTypedArray[type];
      if (!CTOR) {
        throw new Error("unknown gl type");
      }
      return CTOR;
    }
    var isArrayBuffer$1 = typeof SharedArrayBuffer !== "undefined" ? function isArrayBufferOrSharedArrayBuffer(a) {
      return a && a.buffer && (a.buffer instanceof ArrayBuffer || a.buffer instanceof SharedArrayBuffer);
    } : function isArrayBuffer(a) {
      return a && a.buffer && a.buffer instanceof ArrayBuffer;
    };
    function error$1(...args) {
      console.error(...args);
    }
    function warn$1(...args) {
      console.warn(...args);
    }
    var isTypeWeakMaps = /* @__PURE__ */ new Map();
    function isType(object, type) {
      if (!object || typeof object !== "object") {
        return false;
      }
      let weakMap = isTypeWeakMaps.get(type);
      if (!weakMap) {
        weakMap = /* @__PURE__ */ new WeakMap();
        isTypeWeakMaps.set(type, weakMap);
      }
      let isOfType = weakMap.get(object);
      if (isOfType === void 0) {
        const s = Object.prototype.toString.call(object);
        isOfType = s.substring(8, s.length - 1) === type;
        weakMap.set(object, isOfType);
      }
      return isOfType;
    }
    function isBuffer(gl, t) {
      return typeof WebGLBuffer !== "undefined" && isType(t, "WebGLBuffer");
    }
    function isTexture(gl, t) {
      return typeof WebGLTexture !== "undefined" && isType(t, "WebGLTexture");
    }
    var STATIC_DRAW = 35044;
    var ARRAY_BUFFER$1 = 34962;
    var ELEMENT_ARRAY_BUFFER$2 = 34963;
    var BUFFER_SIZE = 34660;
    var BYTE$1 = 5120;
    var UNSIGNED_BYTE$2 = 5121;
    var SHORT$1 = 5122;
    var UNSIGNED_SHORT$2 = 5123;
    var INT$2 = 5124;
    var UNSIGNED_INT$2 = 5125;
    var FLOAT$2 = 5126;
    var defaults$2 = {
      attribPrefix: ""
    };
    function setBufferFromTypedArray(gl, type, buffer, array, drawType) {
      gl.bindBuffer(type, buffer);
      gl.bufferData(type, array, drawType || STATIC_DRAW);
    }
    function createBufferFromTypedArray(gl, typedArray, type, drawType) {
      if (isBuffer(gl, typedArray)) {
        return typedArray;
      }
      type = type || ARRAY_BUFFER$1;
      const buffer = gl.createBuffer();
      setBufferFromTypedArray(gl, type, buffer, typedArray, drawType);
      return buffer;
    }
    function isIndices(name) {
      return name === "indices";
    }
    function getNormalizationForTypedArrayType(typedArrayType) {
      if (typedArrayType === Int8Array) {
        return true;
      }
      if (typedArrayType === Uint8Array) {
        return true;
      }
      return false;
    }
    function getArray$1(array) {
      return array.length ? array : array.data;
    }
    var texcoordRE = /coord|texture/i;
    var colorRE = /color|colour/i;
    function guessNumComponentsFromName(name, length2) {
      let numComponents;
      if (texcoordRE.test(name)) {
        numComponents = 2;
      } else if (colorRE.test(name)) {
        numComponents = 4;
      } else {
        numComponents = 3;
      }
      if (length2 % numComponents > 0) {
        throw new Error(`Can not guess numComponents for attribute '${name}'. Tried ${numComponents} but ${length2} values is not evenly divisible by ${numComponents}. You should specify it.`);
      }
      return numComponents;
    }
    function getNumComponents$1(array, arrayName, numValues) {
      return array.numComponents || array.size || guessNumComponentsFromName(arrayName, numValues || getArray$1(array).length);
    }
    function makeTypedArray(array, name) {
      if (isArrayBuffer$1(array)) {
        return array;
      }
      if (isArrayBuffer$1(array.data)) {
        return array.data;
      }
      if (Array.isArray(array)) {
        array = {
          data: array
        };
      }
      let Type = array.type ? typedArrayTypeFromGLTypeOrTypedArrayCtor(array.type) : void 0;
      if (!Type) {
        if (isIndices(name)) {
          Type = Uint16Array;
        } else {
          Type = Float32Array;
        }
      }
      return new Type(array.data);
    }
    function glTypeFromGLTypeOrTypedArrayType(glTypeOrTypedArrayCtor) {
      return typeof glTypeOrTypedArrayCtor === "number" ? glTypeOrTypedArrayCtor : glTypeOrTypedArrayCtor ? getGLTypeForTypedArrayType(glTypeOrTypedArrayCtor) : FLOAT$2;
    }
    function typedArrayTypeFromGLTypeOrTypedArrayCtor(glTypeOrTypedArrayCtor) {
      return typeof glTypeOrTypedArrayCtor === "number" ? getTypedArrayTypeForGLType(glTypeOrTypedArrayCtor) : glTypeOrTypedArrayCtor || Float32Array;
    }
    function attribBufferFromBuffer(gl, array) {
      return {
        buffer: array.buffer,
        numValues: 2 * 3 * 4,
        // safely divided by 2, 3, 4
        type: glTypeFromGLTypeOrTypedArrayType(array.type),
        arrayType: typedArrayTypeFromGLTypeOrTypedArrayCtor(array.type)
      };
    }
    function attribBufferFromSize(gl, array) {
      const numValues = array.data || array;
      const arrayType = typedArrayTypeFromGLTypeOrTypedArrayCtor(array.type);
      const numBytes = numValues * arrayType.BYTES_PER_ELEMENT;
      const buffer = gl.createBuffer();
      gl.bindBuffer(ARRAY_BUFFER$1, buffer);
      gl.bufferData(ARRAY_BUFFER$1, numBytes, array.drawType || STATIC_DRAW);
      return {
        buffer,
        numValues,
        type: getGLTypeForTypedArrayType(arrayType),
        arrayType
      };
    }
    function attribBufferFromArrayLike(gl, array, arrayName) {
      const typedArray = makeTypedArray(array, arrayName);
      return {
        arrayType: typedArray.constructor,
        buffer: createBufferFromTypedArray(gl, typedArray, void 0, array.drawType),
        type: getGLTypeForTypedArray(typedArray),
        numValues: 0
      };
    }
    function createAttribsFromArrays(gl, arrays) {
      const attribs = {};
      Object.keys(arrays).forEach(function(arrayName) {
        if (!isIndices(arrayName)) {
          const array = arrays[arrayName];
          const attribName = array.attrib || array.name || array.attribName || defaults$2.attribPrefix + arrayName;
          if (array.value) {
            if (!Array.isArray(array.value) && !isArrayBuffer$1(array.value)) {
              throw new Error("array.value is not array or typedarray");
            }
            attribs[attribName] = {
              value: array.value
            };
          } else {
            let fn;
            if (array.buffer && array.buffer instanceof WebGLBuffer) {
              fn = attribBufferFromBuffer;
            } else if (typeof array === "number" || typeof array.data === "number") {
              fn = attribBufferFromSize;
            } else {
              fn = attribBufferFromArrayLike;
            }
            const { buffer, type, numValues, arrayType } = fn(gl, array, arrayName);
            const normalization = array.normalize !== void 0 ? array.normalize : getNormalizationForTypedArrayType(arrayType);
            const numComponents = getNumComponents$1(array, arrayName, numValues);
            attribs[attribName] = {
              buffer,
              numComponents,
              type,
              normalize: normalization,
              stride: array.stride || 0,
              offset: array.offset || 0,
              divisor: array.divisor === void 0 ? void 0 : array.divisor,
              drawType: array.drawType
            };
          }
        }
      });
      gl.bindBuffer(ARRAY_BUFFER$1, null);
      return attribs;
    }
    function getBytesPerValueForGLType(gl, type) {
      if (type === BYTE$1) return 1;
      if (type === UNSIGNED_BYTE$2) return 1;
      if (type === SHORT$1) return 2;
      if (type === UNSIGNED_SHORT$2) return 2;
      if (type === INT$2) return 4;
      if (type === UNSIGNED_INT$2) return 4;
      if (type === FLOAT$2) return 4;
      return 0;
    }
    var positionKeys = ["position", "positions", "a_position"];
    function getNumElementsFromNonIndexedArrays(arrays) {
      let key;
      let ii;
      for (ii = 0; ii < positionKeys.length; ++ii) {
        key = positionKeys[ii];
        if (key in arrays) {
          break;
        }
      }
      if (ii === positionKeys.length) {
        key = Object.keys(arrays)[0];
      }
      const array = arrays[key];
      const length2 = getArray$1(array).length;
      if (length2 === void 0) {
        return 1;
      }
      const numComponents = getNumComponents$1(array, key);
      const numElements = length2 / numComponents;
      if (length2 % numComponents > 0) {
        throw new Error(`numComponents ${numComponents} not correct for length ${length2}`);
      }
      return numElements;
    }
    function getNumElementsFromAttributes(gl, attribs) {
      let key;
      let ii;
      for (ii = 0; ii < positionKeys.length; ++ii) {
        key = positionKeys[ii];
        if (key in attribs) {
          break;
        }
        key = defaults$2.attribPrefix + key;
        if (key in attribs) {
          break;
        }
      }
      if (ii === positionKeys.length) {
        key = Object.keys(attribs)[0];
      }
      const attrib = attribs[key];
      if (!attrib.buffer) {
        return 1;
      }
      gl.bindBuffer(ARRAY_BUFFER$1, attrib.buffer);
      const numBytes = gl.getBufferParameter(ARRAY_BUFFER$1, BUFFER_SIZE);
      gl.bindBuffer(ARRAY_BUFFER$1, null);
      const bytesPerValue = getBytesPerValueForGLType(gl, attrib.type);
      const totalElements = numBytes / bytesPerValue;
      const numComponents = attrib.numComponents || attrib.size;
      const numElements = totalElements / numComponents;
      if (numElements % 1 !== 0) {
        throw new Error(`numComponents ${numComponents} not correct for length ${length}`);
      }
      return numElements;
    }
    function createBufferInfoFromArrays(gl, arrays, srcBufferInfo) {
      const newAttribs = createAttribsFromArrays(gl, arrays);
      const bufferInfo = Object.assign({}, srcBufferInfo ? srcBufferInfo : {});
      bufferInfo.attribs = Object.assign({}, srcBufferInfo ? srcBufferInfo.attribs : {}, newAttribs);
      const indices = arrays.indices;
      if (indices) {
        const newIndices = makeTypedArray(indices, "indices");
        bufferInfo.indices = createBufferFromTypedArray(gl, newIndices, ELEMENT_ARRAY_BUFFER$2);
        bufferInfo.numElements = newIndices.length;
        bufferInfo.elementType = getGLTypeForTypedArray(newIndices);
      } else if (!bufferInfo.numElements) {
        bufferInfo.numElements = getNumElementsFromAttributes(gl, bufferInfo.attribs);
      }
      return bufferInfo;
    }
    function createBufferFromArray(gl, array, arrayName) {
      const type = arrayName === "indices" ? ELEMENT_ARRAY_BUFFER$2 : ARRAY_BUFFER$1;
      const typedArray = makeTypedArray(array, arrayName);
      return createBufferFromTypedArray(gl, typedArray, type);
    }
    function createBuffersFromArrays(gl, arrays) {
      const buffers = {};
      Object.keys(arrays).forEach(function(key) {
        buffers[key] = createBufferFromArray(gl, arrays[key], key);
      });
      if (arrays.indices) {
        buffers.numElements = arrays.indices.length;
        buffers.elementType = getGLTypeForTypedArray(makeTypedArray(arrays.indices));
      } else {
        buffers.numElements = getNumElementsFromNonIndexedArrays(arrays);
      }
      return buffers;
    }
    function augmentTypedArray(typedArray, numComponents) {
      let cursor = 0;
      typedArray.push = function() {
        for (let ii = 0; ii < arguments.length; ++ii) {
          const value = arguments[ii];
          if (value instanceof Array || isArrayBuffer$1(value)) {
            for (let jj = 0; jj < value.length; ++jj) {
              typedArray[cursor++] = value[jj];
            }
          } else {
            typedArray[cursor++] = value;
          }
        }
      };
      typedArray.reset = function(opt_index) {
        cursor = opt_index || 0;
      };
      typedArray.numComponents = numComponents;
      Object.defineProperty(typedArray, "numElements", {
        get: function() {
          return this.length / this.numComponents | 0;
        }
      });
      return typedArray;
    }
    function createAugmentedTypedArray(numComponents, numElements, opt_type) {
      const Type = opt_type || Float32Array;
      return augmentTypedArray(new Type(numComponents * numElements), numComponents);
    }
    function applyFuncToV3Array(array, matrix, fn) {
      const len = array.length;
      const tmp = new Float32Array(3);
      for (let ii = 0; ii < len; ii += 3) {
        fn(matrix, [array[ii], array[ii + 1], array[ii + 2]], tmp);
        array[ii] = tmp[0];
        array[ii + 1] = tmp[1];
        array[ii + 2] = tmp[2];
      }
    }
    function transformNormal(mi, v, dst) {
      dst = dst || create$1();
      const v0 = v[0];
      const v1 = v[1];
      const v2 = v[2];
      dst[0] = v0 * mi[0 * 4 + 0] + v1 * mi[0 * 4 + 1] + v2 * mi[0 * 4 + 2];
      dst[1] = v0 * mi[1 * 4 + 0] + v1 * mi[1 * 4 + 1] + v2 * mi[1 * 4 + 2];
      dst[2] = v0 * mi[2 * 4 + 0] + v1 * mi[2 * 4 + 1] + v2 * mi[2 * 4 + 2];
      return dst;
    }
    function reorientDirections(array, matrix) {
      applyFuncToV3Array(array, matrix, transformDirection);
      return array;
    }
    function reorientNormals(array, matrix) {
      applyFuncToV3Array(array, inverse(matrix), transformNormal);
      return array;
    }
    function reorientPositions(array, matrix) {
      applyFuncToV3Array(array, matrix, transformPoint);
      return array;
    }
    function reorientVertices(arrays, matrix) {
      Object.keys(arrays).forEach(function(name) {
        const array = arrays[name];
        if (name.indexOf("pos") >= 0) {
          reorientPositions(array, matrix);
        } else if (name.indexOf("tan") >= 0 || name.indexOf("binorm") >= 0) {
          reorientDirections(array, matrix);
        } else if (name.indexOf("norm") >= 0) {
          reorientNormals(array, matrix);
        }
      });
      return arrays;
    }
    function createXYQuadVertices(size, xOffset, yOffset) {
      size = size || 2;
      xOffset = xOffset || 0;
      yOffset = yOffset || 0;
      size *= 0.5;
      return {
        position: {
          numComponents: 2,
          data: [
            xOffset + -1 * size,
            yOffset + -1 * size,
            xOffset + 1 * size,
            yOffset + -1 * size,
            xOffset + -1 * size,
            yOffset + 1 * size,
            xOffset + 1 * size,
            yOffset + 1 * size
          ]
        },
        normal: [
          0,
          0,
          1,
          0,
          0,
          1,
          0,
          0,
          1,
          0,
          0,
          1
        ],
        texcoord: [
          0,
          0,
          1,
          0,
          0,
          1,
          1,
          1
        ],
        indices: [0, 1, 2, 2, 1, 3]
      };
    }
    function createPlaneVertices(width, depth, subdivisionsWidth, subdivisionsDepth, matrix) {
      width = width || 1;
      depth = depth || 1;
      subdivisionsWidth = subdivisionsWidth || 1;
      subdivisionsDepth = subdivisionsDepth || 1;
      matrix = matrix || identity();
      const numVertices = (subdivisionsWidth + 1) * (subdivisionsDepth + 1);
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      for (let z = 0; z <= subdivisionsDepth; z++) {
        for (let x = 0; x <= subdivisionsWidth; x++) {
          const u = x / subdivisionsWidth;
          const v = z / subdivisionsDepth;
          positions.push(
            width * u - width * 0.5,
            0,
            depth * v - depth * 0.5
          );
          normals.push(0, 1, 0);
          texcoords.push(u, v);
        }
      }
      const numVertsAcross = subdivisionsWidth + 1;
      const indices = createAugmentedTypedArray(
        3,
        subdivisionsWidth * subdivisionsDepth * 2,
        Uint16Array
      );
      for (let z = 0; z < subdivisionsDepth; z++) {
        for (let x = 0; x < subdivisionsWidth; x++) {
          indices.push(
            (z + 0) * numVertsAcross + x,
            (z + 1) * numVertsAcross + x,
            (z + 0) * numVertsAcross + x + 1
          );
          indices.push(
            (z + 1) * numVertsAcross + x,
            (z + 1) * numVertsAcross + x + 1,
            (z + 0) * numVertsAcross + x + 1
          );
        }
      }
      const arrays = reorientVertices({
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      }, matrix);
      return arrays;
    }
    function createSphereVertices(radius, subdivisionsAxis, subdivisionsHeight, opt_startLatitudeInRadians, opt_endLatitudeInRadians, opt_startLongitudeInRadians, opt_endLongitudeInRadians) {
      if (subdivisionsAxis <= 0 || subdivisionsHeight <= 0) {
        throw new Error("subdivisionAxis and subdivisionHeight must be > 0");
      }
      opt_startLatitudeInRadians = opt_startLatitudeInRadians || 0;
      opt_endLatitudeInRadians = opt_endLatitudeInRadians || Math.PI;
      opt_startLongitudeInRadians = opt_startLongitudeInRadians || 0;
      opt_endLongitudeInRadians = opt_endLongitudeInRadians || Math.PI * 2;
      const latRange = opt_endLatitudeInRadians - opt_startLatitudeInRadians;
      const longRange = opt_endLongitudeInRadians - opt_startLongitudeInRadians;
      const numVertices = (subdivisionsAxis + 1) * (subdivisionsHeight + 1);
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      for (let y = 0; y <= subdivisionsHeight; y++) {
        for (let x = 0; x <= subdivisionsAxis; x++) {
          const u = x / subdivisionsAxis;
          const v = y / subdivisionsHeight;
          const theta = longRange * u + opt_startLongitudeInRadians;
          const phi = latRange * v + opt_startLatitudeInRadians;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);
          const ux = cosTheta * sinPhi;
          const uy = cosPhi;
          const uz = sinTheta * sinPhi;
          positions.push(radius * ux, radius * uy, radius * uz);
          normals.push(ux, uy, uz);
          texcoords.push(1 - u, v);
        }
      }
      const numVertsAround = subdivisionsAxis + 1;
      const indices = createAugmentedTypedArray(3, subdivisionsAxis * subdivisionsHeight * 2, Uint16Array);
      for (let x = 0; x < subdivisionsAxis; x++) {
        for (let y = 0; y < subdivisionsHeight; y++) {
          indices.push(
            (y + 0) * numVertsAround + x,
            (y + 0) * numVertsAround + x + 1,
            (y + 1) * numVertsAround + x
          );
          indices.push(
            (y + 1) * numVertsAround + x,
            (y + 0) * numVertsAround + x + 1,
            (y + 1) * numVertsAround + x + 1
          );
        }
      }
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    var CUBE_FACE_INDICES = [
      [3, 7, 5, 1],
      // right
      [6, 2, 0, 4],
      // left
      [6, 7, 3, 2],
      // ??
      [0, 1, 5, 4],
      // ??
      [7, 6, 4, 5],
      // front
      [2, 3, 1, 0]
      // back
    ];
    function createCubeVertices(size) {
      size = size || 1;
      const k = size / 2;
      const cornerVertices = [
        [-k, -k, -k],
        [+k, -k, -k],
        [-k, +k, -k],
        [+k, +k, -k],
        [-k, -k, +k],
        [+k, -k, +k],
        [-k, +k, +k],
        [+k, +k, +k]
      ];
      const faceNormals = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1]
      ];
      const uvCoords = [
        [1, 0],
        [0, 0],
        [0, 1],
        [1, 1]
      ];
      const numVertices = 6 * 4;
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      const indices = createAugmentedTypedArray(3, 6 * 2, Uint16Array);
      for (let f = 0; f < 6; ++f) {
        const faceIndices = CUBE_FACE_INDICES[f];
        for (let v = 0; v < 4; ++v) {
          const position = cornerVertices[faceIndices[v]];
          const normal = faceNormals[f];
          const uv = uvCoords[v];
          positions.push(position);
          normals.push(normal);
          texcoords.push(uv);
        }
        const offset = 4 * f;
        indices.push(offset + 0, offset + 1, offset + 2);
        indices.push(offset + 0, offset + 2, offset + 3);
      }
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    function createTruncatedConeVertices(bottomRadius, topRadius, height, radialSubdivisions, verticalSubdivisions, opt_topCap, opt_bottomCap) {
      if (radialSubdivisions < 3) {
        throw new Error("radialSubdivisions must be 3 or greater");
      }
      if (verticalSubdivisions < 1) {
        throw new Error("verticalSubdivisions must be 1 or greater");
      }
      const topCap = opt_topCap === void 0 ? true : opt_topCap;
      const bottomCap = opt_bottomCap === void 0 ? true : opt_bottomCap;
      const extra = (topCap ? 2 : 0) + (bottomCap ? 2 : 0);
      const numVertices = (radialSubdivisions + 1) * (verticalSubdivisions + 1 + extra);
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      const indices = createAugmentedTypedArray(3, radialSubdivisions * (verticalSubdivisions + extra / 2) * 2, Uint16Array);
      const vertsAroundEdge = radialSubdivisions + 1;
      const slant = Math.atan2(bottomRadius - topRadius, height);
      const cosSlant = Math.cos(slant);
      const sinSlant = Math.sin(slant);
      const start = topCap ? -2 : 0;
      const end = verticalSubdivisions + (bottomCap ? 2 : 0);
      for (let yy = start; yy <= end; ++yy) {
        let v = yy / verticalSubdivisions;
        let y = height * v;
        let ringRadius;
        if (yy < 0) {
          y = 0;
          v = 1;
          ringRadius = bottomRadius;
        } else if (yy > verticalSubdivisions) {
          y = height;
          v = 1;
          ringRadius = topRadius;
        } else {
          ringRadius = bottomRadius + (topRadius - bottomRadius) * (yy / verticalSubdivisions);
        }
        if (yy === -2 || yy === verticalSubdivisions + 2) {
          ringRadius = 0;
          v = 0;
        }
        y -= height / 2;
        for (let ii = 0; ii < vertsAroundEdge; ++ii) {
          const sin = Math.sin(ii * Math.PI * 2 / radialSubdivisions);
          const cos = Math.cos(ii * Math.PI * 2 / radialSubdivisions);
          positions.push(sin * ringRadius, y, cos * ringRadius);
          if (yy < 0) {
            normals.push(0, -1, 0);
          } else if (yy > verticalSubdivisions) {
            normals.push(0, 1, 0);
          } else if (ringRadius === 0) {
            normals.push(0, 0, 0);
          } else {
            normals.push(sin * cosSlant, sinSlant, cos * cosSlant);
          }
          texcoords.push(ii / radialSubdivisions, 1 - v);
        }
      }
      for (let yy = 0; yy < verticalSubdivisions + extra; ++yy) {
        if (yy === 1 && topCap || yy === verticalSubdivisions + extra - 2 && bottomCap) {
          continue;
        }
        for (let ii = 0; ii < radialSubdivisions; ++ii) {
          indices.push(
            vertsAroundEdge * (yy + 0) + 0 + ii,
            vertsAroundEdge * (yy + 0) + 1 + ii,
            vertsAroundEdge * (yy + 1) + 1 + ii
          );
          indices.push(
            vertsAroundEdge * (yy + 0) + 0 + ii,
            vertsAroundEdge * (yy + 1) + 1 + ii,
            vertsAroundEdge * (yy + 1) + 0 + ii
          );
        }
      }
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    function expandRLEData(rleData, padding) {
      padding = padding || [];
      const data = [];
      for (let ii = 0; ii < rleData.length; ii += 4) {
        const runLength = rleData[ii];
        const element = rleData.slice(ii + 1, ii + 4);
        element.push.apply(element, padding);
        for (let jj = 0; jj < runLength; ++jj) {
          data.push.apply(data, element);
        }
      }
      return data;
    }
    function create3DFVertices() {
      const positions = [
        // left column front
        0,
        0,
        0,
        0,
        150,
        0,
        30,
        0,
        0,
        0,
        150,
        0,
        30,
        150,
        0,
        30,
        0,
        0,
        // top rung front
        30,
        0,
        0,
        30,
        30,
        0,
        100,
        0,
        0,
        30,
        30,
        0,
        100,
        30,
        0,
        100,
        0,
        0,
        // middle rung front
        30,
        60,
        0,
        30,
        90,
        0,
        67,
        60,
        0,
        30,
        90,
        0,
        67,
        90,
        0,
        67,
        60,
        0,
        // left column back
        0,
        0,
        30,
        30,
        0,
        30,
        0,
        150,
        30,
        0,
        150,
        30,
        30,
        0,
        30,
        30,
        150,
        30,
        // top rung back
        30,
        0,
        30,
        100,
        0,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        100,
        0,
        30,
        100,
        30,
        30,
        // middle rung back
        30,
        60,
        30,
        67,
        60,
        30,
        30,
        90,
        30,
        30,
        90,
        30,
        67,
        60,
        30,
        67,
        90,
        30,
        // top
        0,
        0,
        0,
        100,
        0,
        0,
        100,
        0,
        30,
        0,
        0,
        0,
        100,
        0,
        30,
        0,
        0,
        30,
        // top rung front
        100,
        0,
        0,
        100,
        30,
        0,
        100,
        30,
        30,
        100,
        0,
        0,
        100,
        30,
        30,
        100,
        0,
        30,
        // under top rung
        30,
        30,
        0,
        30,
        30,
        30,
        100,
        30,
        30,
        30,
        30,
        0,
        100,
        30,
        30,
        100,
        30,
        0,
        // between top rung and middle
        30,
        30,
        0,
        30,
        60,
        30,
        30,
        30,
        30,
        30,
        30,
        0,
        30,
        60,
        0,
        30,
        60,
        30,
        // top of middle rung
        30,
        60,
        0,
        67,
        60,
        30,
        30,
        60,
        30,
        30,
        60,
        0,
        67,
        60,
        0,
        67,
        60,
        30,
        // front of middle rung
        67,
        60,
        0,
        67,
        90,
        30,
        67,
        60,
        30,
        67,
        60,
        0,
        67,
        90,
        0,
        67,
        90,
        30,
        // bottom of middle rung.
        30,
        90,
        0,
        30,
        90,
        30,
        67,
        90,
        30,
        30,
        90,
        0,
        67,
        90,
        30,
        67,
        90,
        0,
        // front of bottom
        30,
        90,
        0,
        30,
        150,
        30,
        30,
        90,
        30,
        30,
        90,
        0,
        30,
        150,
        0,
        30,
        150,
        30,
        // bottom
        0,
        150,
        0,
        0,
        150,
        30,
        30,
        150,
        30,
        0,
        150,
        0,
        30,
        150,
        30,
        30,
        150,
        0,
        // left side
        0,
        0,
        0,
        0,
        0,
        30,
        0,
        150,
        30,
        0,
        0,
        0,
        0,
        150,
        30,
        0,
        150,
        0
      ];
      const texcoords = [
        // left column front
        0.22,
        0.19,
        0.22,
        0.79,
        0.34,
        0.19,
        0.22,
        0.79,
        0.34,
        0.79,
        0.34,
        0.19,
        // top rung front
        0.34,
        0.19,
        0.34,
        0.31,
        0.62,
        0.19,
        0.34,
        0.31,
        0.62,
        0.31,
        0.62,
        0.19,
        // middle rung front
        0.34,
        0.43,
        0.34,
        0.55,
        0.49,
        0.43,
        0.34,
        0.55,
        0.49,
        0.55,
        0.49,
        0.43,
        // left column back
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        // top rung back
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        // middle rung back
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        // top
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        // top rung front
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        // under top rung
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        // between top rung and middle
        0,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        // top of middle rung
        0,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        // front of middle rung
        0,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        // bottom of middle rung.
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        // front of bottom
        0,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        // bottom
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        // left side
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0
      ];
      const normals = expandRLEData([
        // left column front
        // top rung front
        // middle rung front
        18,
        0,
        0,
        1,
        // left column back
        // top rung back
        // middle rung back
        18,
        0,
        0,
        -1,
        // top
        6,
        0,
        1,
        0,
        // top rung front
        6,
        1,
        0,
        0,
        // under top rung
        6,
        0,
        -1,
        0,
        // between top rung and middle
        6,
        1,
        0,
        0,
        // top of middle rung
        6,
        0,
        1,
        0,
        // front of middle rung
        6,
        1,
        0,
        0,
        // bottom of middle rung.
        6,
        0,
        -1,
        0,
        // front of bottom
        6,
        1,
        0,
        0,
        // bottom
        6,
        0,
        -1,
        0,
        // left side
        6,
        -1,
        0,
        0
      ]);
      const colors = expandRLEData([
        // left column front
        // top rung front
        // middle rung front
        18,
        200,
        70,
        120,
        // left column back
        // top rung back
        // middle rung back
        18,
        80,
        70,
        200,
        // top
        6,
        70,
        200,
        210,
        // top rung front
        6,
        200,
        200,
        70,
        // under top rung
        6,
        210,
        100,
        70,
        // between top rung and middle
        6,
        210,
        160,
        70,
        // top of middle rung
        6,
        70,
        180,
        210,
        // front of middle rung
        6,
        100,
        70,
        210,
        // bottom of middle rung.
        6,
        76,
        210,
        100,
        // front of bottom
        6,
        140,
        210,
        80,
        // bottom
        6,
        90,
        130,
        110,
        // left side
        6,
        160,
        160,
        220
      ], [255]);
      const numVerts = positions.length / 3;
      const arrays = {
        position: createAugmentedTypedArray(3, numVerts),
        texcoord: createAugmentedTypedArray(2, numVerts),
        normal: createAugmentedTypedArray(3, numVerts),
        color: createAugmentedTypedArray(4, numVerts, Uint8Array),
        indices: createAugmentedTypedArray(3, numVerts / 3, Uint16Array)
      };
      arrays.position.push(positions);
      arrays.texcoord.push(texcoords);
      arrays.normal.push(normals);
      arrays.color.push(colors);
      for (let ii = 0; ii < numVerts; ++ii) {
        arrays.indices.push(ii);
      }
      return arrays;
    }
    function createCrescentVertices(verticalRadius, outerRadius, innerRadius, thickness, subdivisionsDown, startOffset, endOffset) {
      if (subdivisionsDown <= 0) {
        throw new Error("subdivisionDown must be > 0");
      }
      startOffset = startOffset || 0;
      endOffset = endOffset || 1;
      const subdivisionsThick = 2;
      const offsetRange = endOffset - startOffset;
      const numVertices = (subdivisionsDown + 1) * 2 * (2 + subdivisionsThick);
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      function lerp(a, b, s) {
        return a + (b - a) * s;
      }
      function createArc(arcRadius, x, normalMult, normalAdd, uMult, uAdd) {
        for (let z = 0; z <= subdivisionsDown; z++) {
          const uBack = x / (subdivisionsThick - 1);
          const v = z / subdivisionsDown;
          const xBack = (uBack - 0.5) * 2;
          const angle = (startOffset + v * offsetRange) * Math.PI;
          const s = Math.sin(angle);
          const c = Math.cos(angle);
          const radius = lerp(verticalRadius, arcRadius, s);
          const px = xBack * thickness;
          const py = c * verticalRadius;
          const pz = s * radius;
          positions.push(px, py, pz);
          const n = add(multiply$1([0, s, c], normalMult), normalAdd);
          normals.push(n);
          texcoords.push(uBack * uMult + uAdd, v);
        }
      }
      for (let x = 0; x < subdivisionsThick; x++) {
        const uBack = (x / (subdivisionsThick - 1) - 0.5) * 2;
        createArc(outerRadius, x, [1, 1, 1], [0, 0, 0], 1, 0);
        createArc(outerRadius, x, [0, 0, 0], [uBack, 0, 0], 0, 0);
        createArc(innerRadius, x, [1, 1, 1], [0, 0, 0], 1, 0);
        createArc(innerRadius, x, [0, 0, 0], [uBack, 0, 0], 0, 1);
      }
      const indices = createAugmentedTypedArray(3, subdivisionsDown * 2 * (2 + subdivisionsThick), Uint16Array);
      function createSurface(leftArcOffset, rightArcOffset) {
        for (let z = 0; z < subdivisionsDown; ++z) {
          indices.push(
            leftArcOffset + z + 0,
            leftArcOffset + z + 1,
            rightArcOffset + z + 0
          );
          indices.push(
            leftArcOffset + z + 1,
            rightArcOffset + z + 1,
            rightArcOffset + z + 0
          );
        }
      }
      const numVerticesDown = subdivisionsDown + 1;
      createSurface(numVerticesDown * 0, numVerticesDown * 4);
      createSurface(numVerticesDown * 5, numVerticesDown * 7);
      createSurface(numVerticesDown * 6, numVerticesDown * 2);
      createSurface(numVerticesDown * 3, numVerticesDown * 1);
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    function createCylinderVertices(radius, height, radialSubdivisions, verticalSubdivisions, topCap, bottomCap) {
      return createTruncatedConeVertices(
        radius,
        radius,
        height,
        radialSubdivisions,
        verticalSubdivisions,
        topCap,
        bottomCap
      );
    }
    function createTorusVertices(radius, thickness, radialSubdivisions, bodySubdivisions, startAngle, endAngle) {
      if (radialSubdivisions < 3) {
        throw new Error("radialSubdivisions must be 3 or greater");
      }
      if (bodySubdivisions < 3) {
        throw new Error("verticalSubdivisions must be 3 or greater");
      }
      startAngle = startAngle || 0;
      endAngle = endAngle || Math.PI * 2;
      const range = endAngle - startAngle;
      const radialParts = radialSubdivisions + 1;
      const bodyParts = bodySubdivisions + 1;
      const numVertices = radialParts * bodyParts;
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      const indices = createAugmentedTypedArray(3, radialSubdivisions * bodySubdivisions * 2, Uint16Array);
      for (let slice = 0; slice < bodyParts; ++slice) {
        const v = slice / bodySubdivisions;
        const sliceAngle = v * Math.PI * 2;
        const sliceSin = Math.sin(sliceAngle);
        const ringRadius = radius + sliceSin * thickness;
        const ny = Math.cos(sliceAngle);
        const y = ny * thickness;
        for (let ring = 0; ring < radialParts; ++ring) {
          const u = ring / radialSubdivisions;
          const ringAngle = startAngle + u * range;
          const xSin = Math.sin(ringAngle);
          const zCos = Math.cos(ringAngle);
          const x = xSin * ringRadius;
          const z = zCos * ringRadius;
          const nx = xSin * sliceSin;
          const nz = zCos * sliceSin;
          positions.push(x, y, z);
          normals.push(nx, ny, nz);
          texcoords.push(u, 1 - v);
        }
      }
      for (let slice = 0; slice < bodySubdivisions; ++slice) {
        for (let ring = 0; ring < radialSubdivisions; ++ring) {
          const nextRingIndex = 1 + ring;
          const nextSliceIndex = 1 + slice;
          indices.push(
            radialParts * slice + ring,
            radialParts * nextSliceIndex + ring,
            radialParts * slice + nextRingIndex
          );
          indices.push(
            radialParts * nextSliceIndex + ring,
            radialParts * nextSliceIndex + nextRingIndex,
            radialParts * slice + nextRingIndex
          );
        }
      }
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    function createDiscVertices(radius, divisions, stacks, innerRadius, stackPower) {
      if (divisions < 3) {
        throw new Error("divisions must be at least 3");
      }
      stacks = stacks ? stacks : 1;
      stackPower = stackPower ? stackPower : 1;
      innerRadius = innerRadius ? innerRadius : 0;
      const numVertices = (divisions + 1) * (stacks + 1);
      const positions = createAugmentedTypedArray(3, numVertices);
      const normals = createAugmentedTypedArray(3, numVertices);
      const texcoords = createAugmentedTypedArray(2, numVertices);
      const indices = createAugmentedTypedArray(3, stacks * divisions * 2, Uint16Array);
      let firstIndex = 0;
      const radiusSpan = radius - innerRadius;
      const pointsPerStack = divisions + 1;
      for (let stack = 0; stack <= stacks; ++stack) {
        const stackRadius = innerRadius + radiusSpan * Math.pow(stack / stacks, stackPower);
        for (let i = 0; i <= divisions; ++i) {
          const theta = 2 * Math.PI * i / divisions;
          const x = stackRadius * Math.cos(theta);
          const z = stackRadius * Math.sin(theta);
          positions.push(x, 0, z);
          normals.push(0, 1, 0);
          texcoords.push(1 - i / divisions, stack / stacks);
          if (stack > 0 && i !== divisions) {
            const a = firstIndex + (i + 1);
            const b = firstIndex + i;
            const c = firstIndex + i - pointsPerStack;
            const d = firstIndex + (i + 1) - pointsPerStack;
            indices.push(a, b, c);
            indices.push(a, c, d);
          }
        }
        firstIndex += divisions + 1;
      }
      return {
        position: positions,
        normal: normals,
        texcoord: texcoords,
        indices
      };
    }
    function createBufferFunc(fn) {
      return function(gl) {
        const arrays = fn.apply(this, Array.prototype.slice.call(arguments, 1));
        return createBuffersFromArrays(gl, arrays);
      };
    }
    function createBufferInfoFunc(fn) {
      return function(gl) {
        const arrays = fn.apply(null, Array.prototype.slice.call(arguments, 1));
        return createBufferInfoFromArrays(gl, arrays);
      };
    }
    var create3DFBufferInfo = createBufferInfoFunc(create3DFVertices);
    var create3DFBuffers = createBufferFunc(create3DFVertices);
    var createCubeBufferInfo = createBufferInfoFunc(createCubeVertices);
    var createCubeBuffers = createBufferFunc(createCubeVertices);
    var createPlaneBufferInfo = createBufferInfoFunc(createPlaneVertices);
    var createPlaneBuffers = createBufferFunc(createPlaneVertices);
    var createSphereBufferInfo = createBufferInfoFunc(createSphereVertices);
    var createSphereBuffers = createBufferFunc(createSphereVertices);
    var createTruncatedConeBufferInfo = createBufferInfoFunc(createTruncatedConeVertices);
    var createTruncatedConeBuffers = createBufferFunc(createTruncatedConeVertices);
    var createXYQuadBufferInfo = createBufferInfoFunc(createXYQuadVertices);
    var createXYQuadBuffers = createBufferFunc(createXYQuadVertices);
    var createCrescentBufferInfo = createBufferInfoFunc(createCrescentVertices);
    var createCrescentBuffers = createBufferFunc(createCrescentVertices);
    var createCylinderBufferInfo = createBufferInfoFunc(createCylinderVertices);
    var createCylinderBuffers = createBufferFunc(createCylinderVertices);
    var createTorusBufferInfo = createBufferInfoFunc(createTorusVertices);
    var createTorusBuffers = createBufferFunc(createTorusVertices);
    var createDiscBufferInfo = createBufferInfoFunc(createDiscVertices);
    var createDiscBuffers = createBufferFunc(createDiscVertices);
    function isWebGL2(gl) {
      return !!gl.texStorage2D;
    }
    var glEnumToString = /* @__PURE__ */ (function() {
      const haveEnumsForType = {};
      const enums = {};
      function addEnums(gl) {
        const type = gl.constructor.name;
        if (!haveEnumsForType[type]) {
          for (const key in gl) {
            if (typeof gl[key] === "number") {
              const existing = enums[gl[key]];
              enums[gl[key]] = existing ? `${existing} | ${key}` : key;
            }
          }
          haveEnumsForType[type] = true;
        }
      }
      return function glEnumToString2(gl, value) {
        addEnums(gl);
        return enums[value] || (typeof value === "number" ? `0x${value.toString(16)}` : value);
      };
    })();
    var defaults$1 = {
      textureColor: new Uint8Array([128, 192, 255, 255]),
      textureOptions: {},
      crossOrigin: void 0
    };
    var ALPHA = 6406;
    var RGB = 6407;
    var RGBA$1 = 6408;
    var LUMINANCE = 6409;
    var LUMINANCE_ALPHA = 6410;
    var DEPTH_COMPONENT$1 = 6402;
    var DEPTH_STENCIL$1 = 34041;
    var RG = 33319;
    var RG_INTEGER = 33320;
    var RED = 6403;
    var RED_INTEGER = 36244;
    var RGB_INTEGER = 36248;
    var RGBA_INTEGER = 36249;
    var formatInfo = {};
    {
      const f = formatInfo;
      f[ALPHA] = { numColorComponents: 1 };
      f[LUMINANCE] = { numColorComponents: 1 };
      f[LUMINANCE_ALPHA] = { numColorComponents: 2 };
      f[RGB] = { numColorComponents: 3 };
      f[RGBA$1] = { numColorComponents: 4 };
      f[RED] = { numColorComponents: 1 };
      f[RED_INTEGER] = { numColorComponents: 1 };
      f[RG] = { numColorComponents: 2 };
      f[RG_INTEGER] = { numColorComponents: 2 };
      f[RGB] = { numColorComponents: 3 };
      f[RGB_INTEGER] = { numColorComponents: 3 };
      f[RGBA$1] = { numColorComponents: 4 };
      f[RGBA_INTEGER] = { numColorComponents: 4 };
      f[DEPTH_COMPONENT$1] = { numColorComponents: 1 };
      f[DEPTH_STENCIL$1] = { numColorComponents: 2 };
    }
    var error = error$1;
    function getElementById(id) {
      return typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null;
    }
    var TEXTURE0 = 33984;
    var ARRAY_BUFFER = 34962;
    var ELEMENT_ARRAY_BUFFER$1 = 34963;
    var COMPILE_STATUS = 35713;
    var LINK_STATUS = 35714;
    var FRAGMENT_SHADER = 35632;
    var VERTEX_SHADER = 35633;
    var SEPARATE_ATTRIBS = 35981;
    var ACTIVE_UNIFORMS = 35718;
    var ACTIVE_ATTRIBUTES = 35721;
    var TRANSFORM_FEEDBACK_VARYINGS = 35971;
    var ACTIVE_UNIFORM_BLOCKS = 35382;
    var UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER = 35396;
    var UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER = 35398;
    var UNIFORM_BLOCK_DATA_SIZE = 35392;
    var UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES = 35395;
    var FLOAT = 5126;
    var FLOAT_VEC2 = 35664;
    var FLOAT_VEC3 = 35665;
    var FLOAT_VEC4 = 35666;
    var INT = 5124;
    var INT_VEC2 = 35667;
    var INT_VEC3 = 35668;
    var INT_VEC4 = 35669;
    var BOOL = 35670;
    var BOOL_VEC2 = 35671;
    var BOOL_VEC3 = 35672;
    var BOOL_VEC4 = 35673;
    var FLOAT_MAT2 = 35674;
    var FLOAT_MAT3 = 35675;
    var FLOAT_MAT4 = 35676;
    var SAMPLER_2D = 35678;
    var SAMPLER_CUBE = 35680;
    var SAMPLER_3D = 35679;
    var SAMPLER_2D_SHADOW = 35682;
    var FLOAT_MAT2x3 = 35685;
    var FLOAT_MAT2x4 = 35686;
    var FLOAT_MAT3x2 = 35687;
    var FLOAT_MAT3x4 = 35688;
    var FLOAT_MAT4x2 = 35689;
    var FLOAT_MAT4x3 = 35690;
    var SAMPLER_2D_ARRAY = 36289;
    var SAMPLER_2D_ARRAY_SHADOW = 36292;
    var SAMPLER_CUBE_SHADOW = 36293;
    var UNSIGNED_INT = 5125;
    var UNSIGNED_INT_VEC2 = 36294;
    var UNSIGNED_INT_VEC3 = 36295;
    var UNSIGNED_INT_VEC4 = 36296;
    var INT_SAMPLER_2D = 36298;
    var INT_SAMPLER_3D = 36299;
    var INT_SAMPLER_CUBE = 36300;
    var INT_SAMPLER_2D_ARRAY = 36303;
    var UNSIGNED_INT_SAMPLER_2D = 36306;
    var UNSIGNED_INT_SAMPLER_3D = 36307;
    var UNSIGNED_INT_SAMPLER_CUBE = 36308;
    var UNSIGNED_INT_SAMPLER_2D_ARRAY = 36311;
    var TEXTURE_2D$1 = 3553;
    var TEXTURE_CUBE_MAP = 34067;
    var TEXTURE_3D = 32879;
    var TEXTURE_2D_ARRAY = 35866;
    var typeMap = {};
    function getBindPointForSamplerType(gl, type) {
      return typeMap[type].bindPoint;
    }
    function floatSetter(gl, location2) {
      return function(v) {
        gl.uniform1f(location2, v);
      };
    }
    function floatArraySetter(gl, location2) {
      return function(v) {
        gl.uniform1fv(location2, v);
      };
    }
    function floatVec2Setter(gl, location2) {
      return function(v) {
        gl.uniform2fv(location2, v);
      };
    }
    function floatVec3Setter(gl, location2) {
      return function(v) {
        gl.uniform3fv(location2, v);
      };
    }
    function floatVec4Setter(gl, location2) {
      return function(v) {
        gl.uniform4fv(location2, v);
      };
    }
    function intSetter(gl, location2) {
      return function(v) {
        gl.uniform1i(location2, v);
      };
    }
    function intArraySetter(gl, location2) {
      return function(v) {
        gl.uniform1iv(location2, v);
      };
    }
    function intVec2Setter(gl, location2) {
      return function(v) {
        gl.uniform2iv(location2, v);
      };
    }
    function intVec3Setter(gl, location2) {
      return function(v) {
        gl.uniform3iv(location2, v);
      };
    }
    function intVec4Setter(gl, location2) {
      return function(v) {
        gl.uniform4iv(location2, v);
      };
    }
    function uintSetter(gl, location2) {
      return function(v) {
        gl.uniform1ui(location2, v);
      };
    }
    function uintArraySetter(gl, location2) {
      return function(v) {
        gl.uniform1uiv(location2, v);
      };
    }
    function uintVec2Setter(gl, location2) {
      return function(v) {
        gl.uniform2uiv(location2, v);
      };
    }
    function uintVec3Setter(gl, location2) {
      return function(v) {
        gl.uniform3uiv(location2, v);
      };
    }
    function uintVec4Setter(gl, location2) {
      return function(v) {
        gl.uniform4uiv(location2, v);
      };
    }
    function floatMat2Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix2fv(location2, false, v);
      };
    }
    function floatMat3Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix3fv(location2, false, v);
      };
    }
    function floatMat4Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix4fv(location2, false, v);
      };
    }
    function floatMat23Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix2x3fv(location2, false, v);
      };
    }
    function floatMat32Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix3x2fv(location2, false, v);
      };
    }
    function floatMat24Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix2x4fv(location2, false, v);
      };
    }
    function floatMat42Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix4x2fv(location2, false, v);
      };
    }
    function floatMat34Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix3x4fv(location2, false, v);
      };
    }
    function floatMat43Setter(gl, location2) {
      return function(v) {
        gl.uniformMatrix4x3fv(location2, false, v);
      };
    }
    function samplerSetter(gl, type, unit, location2) {
      const bindPoint = getBindPointForSamplerType(gl, type);
      return isWebGL2(gl) ? function(textureOrPair) {
        let texture;
        let sampler;
        if (!textureOrPair || isTexture(gl, textureOrPair)) {
          texture = textureOrPair;
          sampler = null;
        } else {
          texture = textureOrPair.texture;
          sampler = textureOrPair.sampler;
        }
        gl.uniform1i(location2, unit);
        gl.activeTexture(TEXTURE0 + unit);
        gl.bindTexture(bindPoint, texture);
        gl.bindSampler(unit, sampler);
      } : function(texture) {
        gl.uniform1i(location2, unit);
        gl.activeTexture(TEXTURE0 + unit);
        gl.bindTexture(bindPoint, texture);
      };
    }
    function samplerArraySetter(gl, type, unit, location2, size) {
      const bindPoint = getBindPointForSamplerType(gl, type);
      const units = new Int32Array(size);
      for (let ii = 0; ii < size; ++ii) {
        units[ii] = unit + ii;
      }
      return isWebGL2(gl) ? function(textures) {
        gl.uniform1iv(location2, units);
        textures.forEach(function(textureOrPair, index) {
          gl.activeTexture(TEXTURE0 + units[index]);
          let texture;
          let sampler;
          if (!textureOrPair || isTexture(gl, textureOrPair)) {
            texture = textureOrPair;
            sampler = null;
          } else {
            texture = textureOrPair.texture;
            sampler = textureOrPair.sampler;
          }
          gl.bindSampler(unit, sampler);
          gl.bindTexture(bindPoint, texture);
        });
      } : function(textures) {
        gl.uniform1iv(location2, units);
        textures.forEach(function(texture, index) {
          gl.activeTexture(TEXTURE0 + units[index]);
          gl.bindTexture(bindPoint, texture);
        });
      };
    }
    typeMap[FLOAT] = { Type: Float32Array, size: 4, setter: floatSetter, arraySetter: floatArraySetter };
    typeMap[FLOAT_VEC2] = { Type: Float32Array, size: 8, setter: floatVec2Setter, cols: 2 };
    typeMap[FLOAT_VEC3] = { Type: Float32Array, size: 12, setter: floatVec3Setter, cols: 3 };
    typeMap[FLOAT_VEC4] = { Type: Float32Array, size: 16, setter: floatVec4Setter, cols: 4 };
    typeMap[INT] = { Type: Int32Array, size: 4, setter: intSetter, arraySetter: intArraySetter };
    typeMap[INT_VEC2] = { Type: Int32Array, size: 8, setter: intVec2Setter, cols: 2 };
    typeMap[INT_VEC3] = { Type: Int32Array, size: 12, setter: intVec3Setter, cols: 3 };
    typeMap[INT_VEC4] = { Type: Int32Array, size: 16, setter: intVec4Setter, cols: 4 };
    typeMap[UNSIGNED_INT] = { Type: Uint32Array, size: 4, setter: uintSetter, arraySetter: uintArraySetter };
    typeMap[UNSIGNED_INT_VEC2] = { Type: Uint32Array, size: 8, setter: uintVec2Setter, cols: 2 };
    typeMap[UNSIGNED_INT_VEC3] = { Type: Uint32Array, size: 12, setter: uintVec3Setter, cols: 3 };
    typeMap[UNSIGNED_INT_VEC4] = { Type: Uint32Array, size: 16, setter: uintVec4Setter, cols: 4 };
    typeMap[BOOL] = { Type: Uint32Array, size: 4, setter: intSetter, arraySetter: intArraySetter };
    typeMap[BOOL_VEC2] = { Type: Uint32Array, size: 8, setter: intVec2Setter, cols: 2 };
    typeMap[BOOL_VEC3] = { Type: Uint32Array, size: 12, setter: intVec3Setter, cols: 3 };
    typeMap[BOOL_VEC4] = { Type: Uint32Array, size: 16, setter: intVec4Setter, cols: 4 };
    typeMap[FLOAT_MAT2] = { Type: Float32Array, size: 32, setter: floatMat2Setter, rows: 2, cols: 2 };
    typeMap[FLOAT_MAT3] = { Type: Float32Array, size: 48, setter: floatMat3Setter, rows: 3, cols: 3 };
    typeMap[FLOAT_MAT4] = { Type: Float32Array, size: 64, setter: floatMat4Setter, rows: 4, cols: 4 };
    typeMap[FLOAT_MAT2x3] = { Type: Float32Array, size: 32, setter: floatMat23Setter, rows: 2, cols: 3 };
    typeMap[FLOAT_MAT2x4] = { Type: Float32Array, size: 32, setter: floatMat24Setter, rows: 2, cols: 4 };
    typeMap[FLOAT_MAT3x2] = { Type: Float32Array, size: 48, setter: floatMat32Setter, rows: 3, cols: 2 };
    typeMap[FLOAT_MAT3x4] = { Type: Float32Array, size: 48, setter: floatMat34Setter, rows: 3, cols: 4 };
    typeMap[FLOAT_MAT4x2] = { Type: Float32Array, size: 64, setter: floatMat42Setter, rows: 4, cols: 2 };
    typeMap[FLOAT_MAT4x3] = { Type: Float32Array, size: 64, setter: floatMat43Setter, rows: 4, cols: 3 };
    typeMap[SAMPLER_2D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D$1 };
    typeMap[SAMPLER_CUBE] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_CUBE_MAP };
    typeMap[SAMPLER_3D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_3D };
    typeMap[SAMPLER_2D_SHADOW] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D$1 };
    typeMap[SAMPLER_2D_ARRAY] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D_ARRAY };
    typeMap[SAMPLER_2D_ARRAY_SHADOW] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D_ARRAY };
    typeMap[SAMPLER_CUBE_SHADOW] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_CUBE_MAP };
    typeMap[INT_SAMPLER_2D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D$1 };
    typeMap[INT_SAMPLER_3D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_3D };
    typeMap[INT_SAMPLER_CUBE] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_CUBE_MAP };
    typeMap[INT_SAMPLER_2D_ARRAY] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D_ARRAY };
    typeMap[UNSIGNED_INT_SAMPLER_2D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D$1 };
    typeMap[UNSIGNED_INT_SAMPLER_3D] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_3D };
    typeMap[UNSIGNED_INT_SAMPLER_CUBE] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_CUBE_MAP };
    typeMap[UNSIGNED_INT_SAMPLER_2D_ARRAY] = { Type: null, size: 0, setter: samplerSetter, arraySetter: samplerArraySetter, bindPoint: TEXTURE_2D_ARRAY };
    function floatAttribSetter(gl, index) {
      return function(b) {
        if (b.value) {
          gl.disableVertexAttribArray(index);
          switch (b.value.length) {
            case 4:
              gl.vertexAttrib4fv(index, b.value);
              break;
            case 3:
              gl.vertexAttrib3fv(index, b.value);
              break;
            case 2:
              gl.vertexAttrib2fv(index, b.value);
              break;
            case 1:
              gl.vertexAttrib1fv(index, b.value);
              break;
            default:
              throw new Error("the length of a float constant value must be between 1 and 4!");
          }
        } else {
          gl.bindBuffer(ARRAY_BUFFER, b.buffer);
          gl.enableVertexAttribArray(index);
          gl.vertexAttribPointer(
            index,
            b.numComponents || b.size,
            b.type || FLOAT,
            b.normalize || false,
            b.stride || 0,
            b.offset || 0
          );
          if (gl.vertexAttribDivisor) {
            gl.vertexAttribDivisor(index, b.divisor || 0);
          }
        }
      };
    }
    function intAttribSetter(gl, index) {
      return function(b) {
        if (b.value) {
          gl.disableVertexAttribArray(index);
          if (b.value.length === 4) {
            gl.vertexAttrib4iv(index, b.value);
          } else {
            throw new Error("The length of an integer constant value must be 4!");
          }
        } else {
          gl.bindBuffer(ARRAY_BUFFER, b.buffer);
          gl.enableVertexAttribArray(index);
          gl.vertexAttribIPointer(
            index,
            b.numComponents || b.size,
            b.type || INT,
            b.stride || 0,
            b.offset || 0
          );
          if (gl.vertexAttribDivisor) {
            gl.vertexAttribDivisor(index, b.divisor || 0);
          }
        }
      };
    }
    function uintAttribSetter(gl, index) {
      return function(b) {
        if (b.value) {
          gl.disableVertexAttribArray(index);
          if (b.value.length === 4) {
            gl.vertexAttrib4uiv(index, b.value);
          } else {
            throw new Error("The length of an unsigned integer constant value must be 4!");
          }
        } else {
          gl.bindBuffer(ARRAY_BUFFER, b.buffer);
          gl.enableVertexAttribArray(index);
          gl.vertexAttribIPointer(
            index,
            b.numComponents || b.size,
            b.type || UNSIGNED_INT,
            b.stride || 0,
            b.offset || 0
          );
          if (gl.vertexAttribDivisor) {
            gl.vertexAttribDivisor(index, b.divisor || 0);
          }
        }
      };
    }
    function matAttribSetter(gl, index, typeInfo) {
      const defaultSize = typeInfo.size;
      const count = typeInfo.count;
      return function(b) {
        gl.bindBuffer(ARRAY_BUFFER, b.buffer);
        const numComponents = b.size || b.numComponents || defaultSize;
        const size = numComponents / count;
        const type = b.type || FLOAT;
        const typeInfo2 = typeMap[type];
        const stride = typeInfo2.size * numComponents;
        const normalize2 = b.normalize || false;
        const offset = b.offset || 0;
        const rowOffset = stride / count;
        for (let i = 0; i < count; ++i) {
          gl.enableVertexAttribArray(index + i);
          gl.vertexAttribPointer(
            index + i,
            size,
            type,
            normalize2,
            stride,
            offset + rowOffset * i
          );
          if (gl.vertexAttribDivisor) {
            gl.vertexAttribDivisor(index + i, b.divisor || 0);
          }
        }
      };
    }
    var attrTypeMap = {};
    attrTypeMap[FLOAT] = { size: 4, setter: floatAttribSetter };
    attrTypeMap[FLOAT_VEC2] = { size: 8, setter: floatAttribSetter };
    attrTypeMap[FLOAT_VEC3] = { size: 12, setter: floatAttribSetter };
    attrTypeMap[FLOAT_VEC4] = { size: 16, setter: floatAttribSetter };
    attrTypeMap[INT] = { size: 4, setter: intAttribSetter };
    attrTypeMap[INT_VEC2] = { size: 8, setter: intAttribSetter };
    attrTypeMap[INT_VEC3] = { size: 12, setter: intAttribSetter };
    attrTypeMap[INT_VEC4] = { size: 16, setter: intAttribSetter };
    attrTypeMap[UNSIGNED_INT] = { size: 4, setter: uintAttribSetter };
    attrTypeMap[UNSIGNED_INT_VEC2] = { size: 8, setter: uintAttribSetter };
    attrTypeMap[UNSIGNED_INT_VEC3] = { size: 12, setter: uintAttribSetter };
    attrTypeMap[UNSIGNED_INT_VEC4] = { size: 16, setter: uintAttribSetter };
    attrTypeMap[BOOL] = { size: 4, setter: intAttribSetter };
    attrTypeMap[BOOL_VEC2] = { size: 8, setter: intAttribSetter };
    attrTypeMap[BOOL_VEC3] = { size: 12, setter: intAttribSetter };
    attrTypeMap[BOOL_VEC4] = { size: 16, setter: intAttribSetter };
    attrTypeMap[FLOAT_MAT2] = { size: 4, setter: matAttribSetter, count: 2 };
    attrTypeMap[FLOAT_MAT3] = { size: 9, setter: matAttribSetter, count: 3 };
    attrTypeMap[FLOAT_MAT4] = { size: 16, setter: matAttribSetter, count: 4 };
    var errorRE = /ERROR:\s*\d+:(\d+)/gi;
    function addLineNumbersWithError(src, log = "", lineOffset = 0) {
      const matches = [...log.matchAll(errorRE)];
      const lineNoToErrorMap = new Map(matches.map((m, ndx) => {
        const lineNo = parseInt(m[1]);
        const next = matches[ndx + 1];
        const end = next ? next.index : log.length;
        const msg = log.substring(m.index, end);
        return [lineNo - 1, msg];
      }));
      return src.split("\n").map((line, lineNo) => {
        const err = lineNoToErrorMap.get(lineNo);
        return `${lineNo + 1 + lineOffset}: ${line}${err ? `
  
  ^^^ ${err}` : ""}`;
      }).join("\n");
    }
    var spaceRE = /^[ \t]*\n/;
    function prepShaderSource(shaderSource) {
      let lineOffset = 0;
      if (spaceRE.test(shaderSource)) {
        lineOffset = 1;
        shaderSource = shaderSource.replace(spaceRE, "");
      }
      return { lineOffset, shaderSource };
    }
    function reportError(progOptions, msg) {
      progOptions.errorCallback(msg);
      if (progOptions.callback) {
        setTimeout(() => {
          progOptions.callback(`${msg}
  ${progOptions.errors.join("\n")}`);
        });
      }
      return null;
    }
    function checkShaderStatus(gl, shaderType, shader, errFn) {
      errFn = errFn || error;
      const compiled = gl.getShaderParameter(shader, COMPILE_STATUS);
      if (!compiled) {
        const lastError = gl.getShaderInfoLog(shader);
        const { lineOffset, shaderSource } = prepShaderSource(gl.getShaderSource(shader));
        const error2 = `${addLineNumbersWithError(shaderSource, lastError, lineOffset)}
  Error compiling ${glEnumToString(gl, shaderType)}: ${lastError}`;
        errFn(error2);
        return error2;
      }
      return "";
    }
    function getProgramOptions(opt_attribs, opt_locations, opt_errorCallback) {
      let transformFeedbackVaryings;
      let transformFeedbackMode;
      let callback;
      if (typeof opt_locations === "function") {
        opt_errorCallback = opt_locations;
        opt_locations = void 0;
      }
      if (typeof opt_attribs === "function") {
        opt_errorCallback = opt_attribs;
        opt_attribs = void 0;
      } else if (opt_attribs && !Array.isArray(opt_attribs)) {
        const opt = opt_attribs;
        opt_errorCallback = opt.errorCallback;
        opt_attribs = opt.attribLocations;
        transformFeedbackVaryings = opt.transformFeedbackVaryings;
        transformFeedbackMode = opt.transformFeedbackMode;
        callback = opt.callback;
      }
      const errorCallback = opt_errorCallback || error;
      const errors = [];
      const options = {
        errorCallback(msg, ...args) {
          errors.push(msg);
          errorCallback(msg, ...args);
        },
        transformFeedbackVaryings,
        transformFeedbackMode,
        callback,
        errors
      };
      {
        let attribLocations = {};
        if (Array.isArray(opt_attribs)) {
          opt_attribs.forEach(function(attrib, ndx) {
            attribLocations[attrib] = opt_locations ? opt_locations[ndx] : ndx;
          });
        } else {
          attribLocations = opt_attribs || {};
        }
        options.attribLocations = attribLocations;
      }
      return options;
    }
    var defaultShaderType = [
      "VERTEX_SHADER",
      "FRAGMENT_SHADER"
    ];
    function getShaderTypeFromScriptType(gl, scriptType) {
      if (scriptType.indexOf("frag") >= 0) {
        return FRAGMENT_SHADER;
      } else if (scriptType.indexOf("vert") >= 0) {
        return VERTEX_SHADER;
      }
      return void 0;
    }
    function deleteProgramAndShaders(gl, program, notThese) {
      const shaders = gl.getAttachedShaders(program);
      for (const shader of shaders) {
        if (!notThese.has(shader)) {
          gl.deleteShader(shader);
        }
      }
      gl.deleteProgram(program);
    }
    var wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
    function createProgramNoCheck(gl, shaders, programOptions) {
      const program = gl.createProgram();
      const {
        attribLocations,
        transformFeedbackVaryings,
        transformFeedbackMode
      } = getProgramOptions(programOptions);
      for (let ndx = 0; ndx < shaders.length; ++ndx) {
        let shader = shaders[ndx];
        if (typeof shader === "string") {
          const elem = getElementById(shader);
          const src = elem ? elem.text : shader;
          let type = gl[defaultShaderType[ndx]];
          if (elem && elem.type) {
            type = getShaderTypeFromScriptType(gl, elem.type) || type;
          }
          shader = gl.createShader(type);
          gl.shaderSource(shader, prepShaderSource(src).shaderSource);
          gl.compileShader(shader);
        }
        gl.attachShader(program, shader);
      }
      Object.entries(attribLocations).forEach(([attrib, loc]) => gl.bindAttribLocation(program, loc, attrib));
      {
        let varyings = transformFeedbackVaryings;
        if (varyings) {
          if (varyings.attribs) {
            varyings = varyings.attribs;
          }
          if (!Array.isArray(varyings)) {
            varyings = Object.keys(varyings);
          }
          gl.transformFeedbackVaryings(program, varyings, transformFeedbackMode || SEPARATE_ATTRIBS);
        }
      }
      gl.linkProgram(program);
      return program;
    }
    function createProgram2(gl, shaders, opt_attribs, opt_locations, opt_errorCallback) {
      const progOptions = getProgramOptions(opt_attribs, opt_locations, opt_errorCallback);
      const shaderSet = new Set(shaders);
      const program = createProgramNoCheck(gl, shaders, progOptions);
      function hasErrors(gl2, program2) {
        const errors = getProgramErrors(gl2, program2, progOptions.errorCallback);
        if (errors) {
          deleteProgramAndShaders(gl2, program2, shaderSet);
        }
        return errors;
      }
      if (progOptions.callback) {
        waitForProgramLinkCompletionAsync(gl, program).then(() => {
          const errors = hasErrors(gl, program);
          progOptions.callback(errors, errors ? void 0 : program);
        });
        return void 0;
      }
      return hasErrors(gl, program) ? void 0 : program;
    }
    function wrapCallbackFnToAsyncFn(fn) {
      return function(gl, arg1, ...args) {
        return new Promise((resolve, reject) => {
          const programOptions = getProgramOptions(...args);
          programOptions.callback = (err, program) => {
            if (err) {
              reject(err);
            } else {
              resolve(program);
            }
          };
          fn(gl, arg1, programOptions);
        });
      };
    }
    var createProgramAsync = wrapCallbackFnToAsyncFn(createProgram2);
    var createProgramInfoAsync = wrapCallbackFnToAsyncFn(createProgramInfo);
    async function waitForProgramLinkCompletionAsync(gl, program) {
      const ext = gl.getExtension("KHR_parallel_shader_compile");
      const checkFn = ext ? (gl2, program2) => gl2.getProgramParameter(program2, ext.COMPLETION_STATUS_KHR) : () => true;
      let waitTime = 0;
      do {
        await wait(waitTime);
        waitTime = 1e3 / 60;
      } while (!checkFn(gl, program));
    }
    async function waitForAllProgramsLinkCompletionAsync(gl, programs) {
      for (const program of Object.values(programs)) {
        await waitForProgramLinkCompletionAsync(gl, program);
      }
    }
    function getProgramErrors(gl, program, errFn) {
      errFn = errFn || error;
      const linked = gl.getProgramParameter(program, LINK_STATUS);
      if (!linked) {
        const lastError = gl.getProgramInfoLog(program);
        errFn(`Error in program linking: ${lastError}`);
        const shaders = gl.getAttachedShaders(program);
        const errors = shaders.map((shader) => checkShaderStatus(gl, gl.getShaderParameter(shader, gl.SHADER_TYPE), shader, errFn));
        return `${lastError}
  ${errors.filter((_) => _).join("\n")}`;
      }
      return void 0;
    }
    function createProgramFromSources(gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback) {
      return createProgram2(gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback);
    }
    function isBuiltIn(info) {
      const name = info.name;
      return name.startsWith("gl_") || name.startsWith("webgl_");
    }
    var tokenRE = /(\.|\[|]|\w+)/g;
    var isDigit = (s) => s >= "0" && s <= "9";
    function addSetterToUniformTree(fullPath, setter, node, uniformSetters) {
      const tokens = fullPath.split(tokenRE).filter((s) => s !== "");
      let tokenNdx = 0;
      let path = "";
      for (; ; ) {
        const token = tokens[tokenNdx++];
        path += token;
        const isArrayIndex = isDigit(token[0]);
        const accessor = isArrayIndex ? parseInt(token) : token;
        if (isArrayIndex) {
          path += tokens[tokenNdx++];
        }
        const isLastToken = tokenNdx === tokens.length;
        if (isLastToken) {
          node[accessor] = setter;
          break;
        } else {
          const token2 = tokens[tokenNdx++];
          const isArray = token2 === "[";
          const child = node[accessor] || (isArray ? [] : {});
          node[accessor] = child;
          node = child;
          uniformSetters[path] = uniformSetters[path] || /* @__PURE__ */ (function(node2) {
            return function(value) {
              setUniformTree(node2, value);
            };
          })(child);
          path += token2;
        }
      }
    }
    function createUniformSetters(gl, program) {
      let textureUnit = 0;
      function createUniformSetter(program2, uniformInfo, location2) {
        const isArray = uniformInfo.name.endsWith("[0]");
        const type = uniformInfo.type;
        const typeInfo = typeMap[type];
        if (!typeInfo) {
          throw new Error(`unknown type: 0x${type.toString(16)}`);
        }
        let setter;
        if (typeInfo.bindPoint) {
          const unit = textureUnit;
          textureUnit += uniformInfo.size;
          if (isArray) {
            setter = typeInfo.arraySetter(gl, type, unit, location2, uniformInfo.size);
          } else {
            setter = typeInfo.setter(gl, type, unit, location2, uniformInfo.size);
          }
        } else {
          if (typeInfo.arraySetter && isArray) {
            setter = typeInfo.arraySetter(gl, location2);
          } else {
            setter = typeInfo.setter(gl, location2);
          }
        }
        setter.location = location2;
        return setter;
      }
      const uniformSetters = {};
      const uniformTree = {};
      const numUniforms = gl.getProgramParameter(program, ACTIVE_UNIFORMS);
      for (let ii = 0; ii < numUniforms; ++ii) {
        const uniformInfo = gl.getActiveUniform(program, ii);
        if (isBuiltIn(uniformInfo)) {
          continue;
        }
        let name = uniformInfo.name;
        if (name.endsWith("[0]")) {
          name = name.substr(0, name.length - 3);
        }
        const location2 = gl.getUniformLocation(program, uniformInfo.name);
        if (location2) {
          const setter = createUniformSetter(program, uniformInfo, location2);
          uniformSetters[name] = setter;
          addSetterToUniformTree(name, setter, uniformTree, uniformSetters);
        }
      }
      return uniformSetters;
    }
    function createTransformFeedbackInfo(gl, program) {
      const info = {};
      const numVaryings = gl.getProgramParameter(program, TRANSFORM_FEEDBACK_VARYINGS);
      for (let ii = 0; ii < numVaryings; ++ii) {
        const varying = gl.getTransformFeedbackVarying(program, ii);
        info[varying.name] = {
          index: ii,
          type: varying.type,
          size: varying.size
        };
      }
      return info;
    }
    function createUniformBlockSpecFromProgram(gl, program) {
      const numUniforms = gl.getProgramParameter(program, ACTIVE_UNIFORMS);
      const uniformData = [];
      const uniformIndices = [];
      for (let ii = 0; ii < numUniforms; ++ii) {
        uniformIndices.push(ii);
        uniformData.push({});
        const uniformInfo = gl.getActiveUniform(program, ii);
        uniformData[ii].name = uniformInfo.name;
      }
      [
        ["UNIFORM_TYPE", "type"],
        ["UNIFORM_SIZE", "size"],
        // num elements
        ["UNIFORM_BLOCK_INDEX", "blockNdx"],
        ["UNIFORM_OFFSET", "offset"]
      ].forEach(function(pair) {
        const pname = pair[0];
        const key = pair[1];
        gl.getActiveUniforms(program, uniformIndices, gl[pname]).forEach(function(value, ndx) {
          uniformData[ndx][key] = value;
        });
      });
      const blockSpecs = {};
      const numUniformBlocks = gl.getProgramParameter(program, ACTIVE_UNIFORM_BLOCKS);
      for (let ii = 0; ii < numUniformBlocks; ++ii) {
        const name = gl.getActiveUniformBlockName(program, ii);
        const blockSpec = {
          index: gl.getUniformBlockIndex(program, name),
          usedByVertexShader: gl.getActiveUniformBlockParameter(program, ii, UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER),
          usedByFragmentShader: gl.getActiveUniformBlockParameter(program, ii, UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER),
          size: gl.getActiveUniformBlockParameter(program, ii, UNIFORM_BLOCK_DATA_SIZE),
          uniformIndices: gl.getActiveUniformBlockParameter(program, ii, UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES)
        };
        blockSpec.used = blockSpec.usedByVertexShader || blockSpec.usedByFragmentShader;
        blockSpecs[name] = blockSpec;
      }
      return {
        blockSpecs,
        uniformData
      };
    }
    function setUniformTree(tree, values) {
      for (const name in values) {
        const prop = tree[name];
        if (typeof prop === "function") {
          prop(values[name]);
        } else {
          setUniformTree(tree[name], values[name]);
        }
      }
    }
    function setUniforms(setters, ...args) {
      const actualSetters = setters.uniformSetters || setters;
      const numArgs = args.length;
      for (let aNdx = 0; aNdx < numArgs; ++aNdx) {
        const values = args[aNdx];
        if (Array.isArray(values)) {
          const numValues = values.length;
          for (let ii = 0; ii < numValues; ++ii) {
            setUniforms(actualSetters, values[ii]);
          }
        } else {
          for (const name in values) {
            const setter = actualSetters[name];
            if (setter) {
              setter(values[name]);
            }
          }
        }
      }
    }
    function createAttributeSetters(gl, program) {
      const attribSetters = {};
      const numAttribs = gl.getProgramParameter(program, ACTIVE_ATTRIBUTES);
      for (let ii = 0; ii < numAttribs; ++ii) {
        const attribInfo = gl.getActiveAttrib(program, ii);
        if (isBuiltIn(attribInfo)) {
          continue;
        }
        const index = gl.getAttribLocation(program, attribInfo.name);
        const typeInfo = attrTypeMap[attribInfo.type];
        const setter = typeInfo.setter(gl, index, typeInfo);
        setter.location = index;
        attribSetters[attribInfo.name] = setter;
      }
      return attribSetters;
    }
    function setAttributes(setters, buffers) {
      for (const name in buffers) {
        const setter = setters[name];
        if (setter) {
          setter(buffers[name]);
        }
      }
    }
    function setBuffersAndAttributes(gl, programInfo, buffers) {
      if (buffers.vertexArrayObject) {
        gl.bindVertexArray(buffers.vertexArrayObject);
      } else {
        setAttributes(programInfo.attribSetters || programInfo, buffers.attribs);
        if (buffers.indices) {
          gl.bindBuffer(ELEMENT_ARRAY_BUFFER$1, buffers.indices);
        }
      }
    }
    function createProgramInfoFromProgram(gl, program) {
      const uniformSetters = createUniformSetters(gl, program);
      const attribSetters = createAttributeSetters(gl, program);
      const programInfo = {
        program,
        uniformSetters,
        attribSetters,
        uniformLocations: Object.fromEntries(Object.entries(uniformSetters).map(([k, v]) => [k, v.location])),
        attribLocations: Object.fromEntries(Object.entries(attribSetters).map(([k, v]) => [k, v.location]))
      };
      if (isWebGL2(gl)) {
        programInfo.uniformBlockSpec = createUniformBlockSpecFromProgram(gl, program);
        programInfo.transformFeedbackInfo = createTransformFeedbackInfo(gl, program);
      }
      return programInfo;
    }
    var notIdRE = /\s|{|}|;/;
    function createProgramInfo(gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback) {
      const progOptions = getProgramOptions(opt_attribs, opt_locations, opt_errorCallback);
      const errors = [];
      shaderSources = shaderSources.map(function(source) {
        if (!notIdRE.test(source)) {
          const script = getElementById(source);
          if (!script) {
            const err = `no element with id: ${source}`;
            progOptions.errorCallback(err);
            errors.push(err);
          } else {
            source = script.text;
          }
        }
        return source;
      });
      if (errors.length) {
        return reportError(progOptions, "");
      }
      const origCallback = progOptions.callback;
      if (origCallback) {
        progOptions.callback = (err, program2) => {
          origCallback(err, err ? void 0 : createProgramInfoFromProgram(gl, program2));
        };
      }
      const program = createProgramFromSources(gl, shaderSources, progOptions);
      if (!program) {
        return null;
      }
      return createProgramInfoFromProgram(gl, program);
    }
    function checkAllPrograms(gl, programs, programSpecs, noDeleteShadersSet, programOptions) {
      for (const [name, program] of Object.entries(programs)) {
        const options = { ...programOptions };
        const spec = programSpecs[name];
        if (!Array.isArray(spec)) {
          Object.assign(options, spec);
        }
        const errors = getProgramErrors(gl, program, options.errorCallback);
        if (errors) {
          for (const program2 of Object.values(programs)) {
            const shaders = gl.getAttachedShaders(program2);
            gl.deleteProgram(program2);
            for (const shader of shaders) {
              if (!noDeleteShadersSet.has(shader)) {
                gl.deleteShader(shader);
              }
            }
          }
          return errors;
        }
      }
      return void 0;
    }
    function createPrograms(gl, programSpecs, programOptions = {}) {
      const noDeleteShadersSet = /* @__PURE__ */ new Set();
      const programs = Object.fromEntries(Object.entries(programSpecs).map(([name, spec]) => {
        const options = { ...programOptions };
        const shaders = Array.isArray(spec) ? spec : spec.shaders;
        if (!Array.isArray(spec)) {
          Object.assign(options, spec);
        }
        shaders.forEach(noDeleteShadersSet.add, noDeleteShadersSet);
        return [name, createProgramNoCheck(gl, shaders, options)];
      }));
      if (programOptions.callback) {
        waitForAllProgramsLinkCompletionAsync(gl, programs).then(() => {
          const errors2 = checkAllPrograms(gl, programs, programSpecs, noDeleteShadersSet, programOptions);
          programOptions.callback(errors2, errors2 ? void 0 : programs);
        });
        return void 0;
      }
      const errors = checkAllPrograms(gl, programs, programSpecs, noDeleteShadersSet, programOptions);
      return errors ? void 0 : programs;
    }
    function createProgramInfos(gl, programSpecs, programOptions) {
      programOptions = getProgramOptions(programOptions);
      function createProgramInfosForPrograms(gl2, programs2) {
        return Object.fromEntries(Object.entries(programs2).map(
          ([name, program]) => [name, createProgramInfoFromProgram(gl2, program)]
        ));
      }
      const origCallback = programOptions.callback;
      if (origCallback) {
        programOptions.callback = (err, programs2) => {
          origCallback(err, err ? void 0 : createProgramInfosForPrograms(gl, programs2));
        };
      }
      const programs = createPrograms(gl, programSpecs, programOptions);
      if (origCallback || !programs) {
        return void 0;
      }
      return createProgramInfosForPrograms(gl, programs);
    }
    var createProgramsAsync = wrapCallbackFnToAsyncFn(createPrograms);
    var createProgramInfosAsync = wrapCallbackFnToAsyncFn(createProgramInfos);
    var TRIANGLES = 4;
    var UNSIGNED_SHORT = 5123;
    function drawBufferInfo(gl, bufferInfo, type, count, offset, instanceCount) {
      type = type === void 0 ? TRIANGLES : type;
      const indices = bufferInfo.indices;
      const elementType = bufferInfo.elementType;
      const numElements = count === void 0 ? bufferInfo.numElements : count;
      offset = offset === void 0 ? 0 : offset;
      if (elementType || indices) {
        if (instanceCount !== void 0) {
          gl.drawElementsInstanced(type, numElements, elementType === void 0 ? UNSIGNED_SHORT : bufferInfo.elementType, offset, instanceCount);
        } else {
          gl.drawElements(type, numElements, elementType === void 0 ? UNSIGNED_SHORT : bufferInfo.elementType, offset);
        }
      } else {
        if (instanceCount !== void 0) {
          gl.drawArraysInstanced(type, offset, numElements, instanceCount);
        } else {
          gl.drawArrays(type, offset, numElements);
        }
      }
    }
    var DEPTH_COMPONENT = 6402;
    var DEPTH_COMPONENT24 = 33190;
    var DEPTH_COMPONENT32F = 36012;
    var DEPTH24_STENCIL8 = 35056;
    var DEPTH32F_STENCIL8 = 36013;
    var RGBA4 = 32854;
    var RGB5_A1 = 32855;
    var RGB565 = 36194;
    var DEPTH_COMPONENT16 = 33189;
    var STENCIL_INDEX = 6401;
    var STENCIL_INDEX8 = 36168;
    var DEPTH_STENCIL = 34041;
    var DEPTH_ATTACHMENT = 36096;
    var STENCIL_ATTACHMENT = 36128;
    var DEPTH_STENCIL_ATTACHMENT = 33306;
    var attachmentsByFormat = {};
    attachmentsByFormat[DEPTH_STENCIL] = DEPTH_STENCIL_ATTACHMENT;
    attachmentsByFormat[STENCIL_INDEX] = STENCIL_ATTACHMENT;
    attachmentsByFormat[STENCIL_INDEX8] = STENCIL_ATTACHMENT;
    attachmentsByFormat[DEPTH_COMPONENT] = DEPTH_ATTACHMENT;
    attachmentsByFormat[DEPTH_COMPONENT16] = DEPTH_ATTACHMENT;
    attachmentsByFormat[DEPTH_COMPONENT24] = DEPTH_ATTACHMENT;
    attachmentsByFormat[DEPTH_COMPONENT32F] = DEPTH_ATTACHMENT;
    attachmentsByFormat[DEPTH24_STENCIL8] = DEPTH_STENCIL_ATTACHMENT;
    attachmentsByFormat[DEPTH32F_STENCIL8] = DEPTH_STENCIL_ATTACHMENT;
    var renderbufferFormats = {};
    renderbufferFormats[RGBA4] = true;
    renderbufferFormats[RGB5_A1] = true;
    renderbufferFormats[RGB565] = true;
    renderbufferFormats[DEPTH_STENCIL] = true;
    renderbufferFormats[DEPTH_COMPONENT16] = true;
    renderbufferFormats[STENCIL_INDEX] = true;
    renderbufferFormats[STENCIL_INDEX8] = true;
    var defaults = {
      addExtensionsToContext: true
    };
    var prefixRE = /^(.*?)_/;
    function addExtensionToContext(gl, extensionName) {
      glEnumToString(gl, 0);
      const ext = gl.getExtension(extensionName);
      if (ext) {
        const enums = {};
        const fnSuffix = prefixRE.exec(extensionName)[1];
        const enumSuffix = "_" + fnSuffix;
        for (const key in ext) {
          const value = ext[key];
          const isFunc = typeof value === "function";
          const suffix = isFunc ? fnSuffix : enumSuffix;
          let name = key;
          if (key.endsWith(suffix)) {
            name = key.substring(0, key.length - suffix.length);
          }
          if (gl[name] !== void 0) {
            if (!isFunc && gl[name] !== value) {
              warn$1(name, gl[name], value, key);
            }
          } else {
            if (isFunc) {
              gl[name] = /* @__PURE__ */ (function(origFn) {
                return function() {
                  return origFn.apply(ext, arguments);
                };
              })(value);
            } else {
              gl[name] = value;
              enums[name] = value;
            }
          }
        }
        enums.constructor = {
          name: ext.constructor.name
        };
        glEnumToString(enums, 0);
      }
      return ext;
    }
    var supportedExtensions = [
      "ANGLE_instanced_arrays",
      "EXT_blend_minmax",
      "EXT_color_buffer_float",
      "EXT_color_buffer_half_float",
      "EXT_disjoint_timer_query",
      "EXT_disjoint_timer_query_webgl2",
      "EXT_frag_depth",
      "EXT_sRGB",
      "EXT_shader_texture_lod",
      "EXT_texture_compression_bptc",
      "EXT_texture_compression_rgtc",
      "EXT_texture_filter_anisotropic",
      "OES_element_index_uint",
      "OES_standard_derivatives",
      "OES_texture_float",
      "OES_texture_float_linear",
      "OES_texture_half_float",
      "OES_texture_half_float_linear",
      "OES_vertex_array_object",
      "WEBGL_color_buffer_float",
      "WEBGL_compressed_texture_atc",
      "WEBGL_compressed_texture_etc1",
      "WEBGL_compressed_texture_etc",
      "WEBGL_compressed_texture_pvrtc",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_compressed_texture_s3tc_srgb",
      "WEBGL_depth_texture",
      "WEBGL_draw_buffers"
    ];
    function addExtensionsToContext(gl) {
      for (let ii = 0; ii < supportedExtensions.length; ++ii) {
        addExtensionToContext(gl, supportedExtensions[ii]);
      }
    }
    function createContext2(canvas, opt_attribs) {
      const names = ["webgl2", "webgl", "experimental-webgl"];
      let context = null;
      for (let ii = 0; ii < names.length; ++ii) {
        context = canvas.getContext(names[ii], opt_attribs);
        if (context) {
          if (defaults.addExtensionsToContext) {
            addExtensionsToContext(context);
          }
          break;
        }
      }
      return context;
    }
    function getContext(canvas, opt_attribs) {
      const gl = createContext2(canvas, opt_attribs);
      return gl;
    }
    function resizeCanvasToDisplaySize(canvas, multiplier) {
      multiplier = multiplier || 1;
      multiplier = Math.max(0, multiplier);
      const width = canvas.clientWidth * multiplier | 0;
      const height = canvas.clientHeight * multiplier | 0;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        return true;
      }
      return false;
    }
  
    // src/render/folia/components/visualizer/backgrounds/sora/SoraBackground.tsx
    var PARTICLE_COUNT = 150;
    var VERTEX_SHADER2 = `
  attribute float a_index;
  uniform vec2 u_resolution;
  uniform float u_time;
  varying float v_color_type;
  varying float v_intensity_base;
  
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  
  void main() {
    float seed = a_index * 123.456;
    
    float speed_rand = hash2(vec2(seed, 1.1));
    float size_rand = hash2(vec2(seed, 2.2));
    float y_rand = hash2(vec2(seed, 3.3));
    float x_rand = hash2(vec2(seed, 4.4));
    float blink_rand = hash2(vec2(seed, 5.5));
    float color_type_rand = hash2(vec2(seed, 6.6));
  
    float aspect = u_resolution.x / u_resolution.y;
    float speed = 0.008 + speed_rand * 0.024;
    float size = 0.0006 + 0.0032 * pow(size_rand, 3.8);
    
    float y = -0.45 + y_rand * 0.9;
    
    float margin = 0.05;
    float width = aspect + margin * 2.0;
    float x = fract(x_rand + u_time * speed);
    x = x * width - (aspect * 0.5 + margin);
    
    float wave = sin(u_time * 0.3 + y_rand * 6.283) * 0.005;
    
    float ndc_x = x / (aspect * 0.5);
    float ndc_y = (y + wave) / 0.5;
    
    gl_Position = vec4(ndc_x, ndc_y, 0.0, 1.0);
    
    // Point size in pixels. 
    float pointSize = size * u_resolution.y * 3.5;
    gl_PointSize = max(2.0, pointSize);
    
    float blink = 0.3 + 0.7 * sin(u_time * (1.0 + blink_rand * 2.5) + x_rand * 6.283);
    v_intensity_base = blink;
    v_color_type = color_type_rand;
  }
  `;
    var FRAGMENT_SHADER2 = `
  precision mediump float;
  uniform vec3 u_particle_color;
  uniform vec3 u_particle_accent_color;
  
  varying float v_color_type;
  varying float v_intensity_base;
  
  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    float dist = length(pc);
    
    float alpha = smoothstep(0.5, 0.1, dist) * v_intensity_base;
    if (alpha < 0.01) discard;
    
    vec3 baseColor = v_color_type > 0.90 ? u_particle_accent_color : u_particle_color;
    
    // Pre-multiplied alpha blending
    gl_FragColor = vec4(baseColor * alpha, alpha);
  }
  `;
    var SoraBackground = ({ theme, isDaylight, paused = false, blendMs = 0, blendProgress }) => {
      const canvasRef = useRef(null);
      const animationRef = useRef(null);
      const timeRef = useRef(0);
      const invalidateRef = useRef(null);
      const [primaryColor, accentColor] = useBlendedColors([theme.primaryColor, theme.accentColor], blendMs, blendProgress);
      const primaryColorChannels = parseColorChannels(primaryColor) || (isDaylight ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 });
      const particleColor = [
        primaryColorChannels.r / 255,
        primaryColorChannels.g / 255,
        primaryColorChannels.b / 255
      ];
      const accentColorChannels = parseColorChannels(accentColor) || primaryColorChannels;
      const particleAccentColor = [
        accentColorChannels.r / 255,
        accentColorChannels.g / 255,
        accentColorChannels.b / 255
      ];
      const bgColor = isDaylight ? [1, 1, 1] : [0, 0, 0];
      const pausedRef = useRef(paused);
      const particleColorRef = useRef(particleColor);
      const particleAccentColorRef = useRef(particleAccentColor);
      const bgColorRef = useRef(bgColor);
      pausedRef.current = paused;
      particleColorRef.current = particleColor;
      particleAccentColorRef.current = particleAccentColor;
      bgColorRef.current = bgColor;
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = getContext(canvas, { alpha: false, depth: false, antialias: false });
        if (!gl) return;
        const programInfo = createProgramInfo(gl, [VERTEX_SHADER2, FRAGMENT_SHADER2], (err) => {
          console.error("SoraBackground twgl program error:", err);
        });
        if (!programInfo) return;
        const indices = new Float32Array(PARTICLE_COUNT);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          indices[i] = i;
        }
        const arrays = {
          a_index: { numComponents: 1, data: indices }
        };
        const bufferInfo = createBufferInfoFromArrays(gl, arrays);
        let lastTimestamp = null;
        const invalidate = () => {
          if (animationRef.current === null) {
            animationRef.current = requestAnimationFrame(render);
          }
        };
        const render = (now) => {
          animationRef.current = null;
          if (!pausedRef.current && lastTimestamp !== null) {
            const delta = (now - lastTimestamp) / 1e3;
            timeRef.current += delta;
          }
          lastTimestamp = pausedRef.current ? null : now;
          resizeCanvasToDisplaySize(canvas);
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
          const currentBgColor = bgColorRef.current;
          gl.clearColor(currentBgColor[0], currentBgColor[1], currentBgColor[2], 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          const uniforms = {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_time: timeRef.current,
            u_particle_color: particleColorRef.current,
            u_particle_accent_color: particleAccentColorRef.current
          };
          gl.useProgram(programInfo.program);
          setBuffersAndAttributes(gl, programInfo, bufferInfo);
          setUniforms(programInfo, uniforms);
          drawBufferInfo(gl, bufferInfo, gl.POINTS);
          if (!pausedRef.current) invalidate();
        };
        const resizeObserver = new ResizeObserver(invalidate);
        resizeObserver.observe(canvas);
        invalidateRef.current = invalidate;
        invalidate();
        return () => {
          invalidateRef.current = null;
          resizeObserver.disconnect();
          if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          gl.deleteProgram(programInfo.program);
          if (bufferInfo.attribs && bufferInfo.attribs.a_index && bufferInfo.attribs.a_index.buffer) {
            gl.deleteBuffer(bufferInfo.attribs.a_index.buffer);
          }
        };
      }, []);
      useEffect(() => {
        invalidateRef.current?.();
      }, [paused, isDaylight, primaryColor, accentColor]);
      return /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: canvasRef,
          className: "absolute inset-0 w-full h-full block pointer-events-none",
          style: {
            width: "100%",
            height: "100%",
            willChange: "transform",
            transform: "translateZ(0)"
          }
        }
      );
    };
    var SoraBackground_default = SoraBackground;
  
    // src/render/folia/components/visualizer/backgrounds/sora/entry.tsx
    var entry_default5 = defineVisualizerBackground({
      mode: "sora",
      order: 50,
      labelKey: "options.visualizerBackgroundModeSora",
      labelFallback: "Sora",
      // 空：稀疏星点
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("path", { d: "M12 5.5l1.2 2.9 2.9 1.2-2.9 1.2L12 13.7l-1.2-2.9-2.9-1.2 2.9-1.2z" }),
        /* @__PURE__ */ jsx("path", { d: "M5.5 16.5h.01M18 15.5h.01M7 7h.01", strokeWidth: "2.2", opacity: "0.5" })
      ] }),
      command: {
        title: "Background: Sora",
        description: "Switch background to Sora (starry sky) layout",
        keywords: ["sora", "starry sky", "star", "\u661F\u7A7A", "\u7A7A", "\u80CC\u666F\u5207\u6362\u5230 \u7A7A", "\u80CC\u666F\u5207\u6362\u5230\u7A7A", "\u80CC\u666F\u5207\u6362\u5230Sora", "\u80CC\u666F\u5207\u6362\u5230\u661F\u7A7A"]
      },
      // No `song`: the stars draw the theme colours only, and blend to new ones in place (blendMs).
      // Blank mode never mounts the WebGL canvas: just a static black (night) / white (daylight) frame.
      // Static mode intentionally freezes the starfield, matching the shared background contract.
      render: ({ config, theme, isDaylight, paused, staticMode, blendMs, blendProgress }) => /* @__PURE__ */ jsx("div", { className: "absolute inset-0 z-0", style: { backgroundColor: isDaylight ? "#ffffff" : "#000000" }, children: !config?.sora?.tuning?.blank && /* @__PURE__ */ jsx(SoraBackground_default, { theme, isDaylight, paused: paused || staticMode, blendMs, blendProgress }) }),
      renderSettingsPanel: ({ config, actions, t }) => /* @__PURE__ */ jsx(
        settings_card_default,
        {
          t,
          tuning: config?.sora?.tuning ?? DEFAULT_SORA_BACKGROUND_TUNING,
          onTuningChange: actions?.sora?.onTuningChange
        }
      ),
      renderQuickControls: ({ config, actions, t }) => {
        const tuning = config?.sora?.tuning ?? DEFAULT_SORA_BACKGROUND_TUNING;
        return /* @__PURE__ */ jsx(
          QuickControlToggle,
          {
            active: tuning.blank,
            label: t("options.soraBlank"),
            onToggle: () => actions?.sora?.onTuningChange?.({ blank: !tuning.blank }),
            children: /* @__PURE__ */ jsx(Square, { size: 14 })
          }
        );
      },
      resetSettings: (actions) => actions?.sora?.onResetTuning?.()
    });
  
    // src/render/folia/utils/urlBackground.ts
    var normalizeUrlBackgroundUrl = (value) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
      try {
        const parsed = new URL(candidate);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
      } catch {
        return null;
      }
    };
    var sanitizeUrlBackgroundItem = (value) => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const item = value;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const url = normalizeUrlBackgroundUrl(item.url);
      if (!id || !url) {
        return null;
      }
      const note = typeof item.note === "string" && item.note.trim() ? item.note.trim() : url;
      return { id, url, note };
    };
  
    // src/render/folia/components/visualizer/backgrounds/url/UrlBackgroundLayer.tsx
    var UrlBackgroundLayer = ({
      urlBackgroundList = [],
      urlBackgroundSelectedId = null
    }) => {
      const selectedItem = useMemo(
        () => sanitizeUrlBackgroundItem(urlBackgroundList.find((item) => item.id === urlBackgroundSelectedId)),
        [urlBackgroundList, urlBackgroundSelectedId]
      );
      const containerRef = useRef(null);
      const [ready, setReady] = useState(false);
      useEffect(() => {
        setReady(false);
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setReady(true);
          return;
        }
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              setReady(true);
              observer.disconnect();
            }
          }
        });
        observer.observe(el);
        return () => {
          observer.disconnect();
        };
      }, [selectedItem]);
      if (!selectedItem?.url) return null;
      return /* @__PURE__ */ jsxs("div", { ref: containerRef, className: "absolute inset-0 z-0 overflow-hidden", children: [
        ready && /* @__PURE__ */ jsx(
          "iframe",
          {
            src: selectedItem.url,
            title: selectedItem.note || selectedItem.url,
            className: "w-full h-full border-0",
            style: {
              pointerEvents: "none"
            },
            sandbox: "allow-scripts",
            allowFullScreen: true
          },
          selectedItem.url
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute inset-0",
            style: {
              background: "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))",
              pointerEvents: "none"
            }
          }
        )
      ] });
    };
    var UrlBackgroundLayer_default = UrlBackgroundLayer;
  
    // src/render/folia/components/visualizer/backgrounds/url/entry.tsx
    var entry_default6 = defineVisualizerBackground({
      mode: "url",
      order: 40,
      labelKey: "options.visualizerBackgroundModeUrl",
      labelFallback: "Embed",
      // 嵌入：网页框
      glyph: /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx("rect", { x: "3.5", y: "5", width: "17", height: "14", rx: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M3.5 9.5h17", opacity: "0.55" })
      ] }),
      command: {
        title: "Background: Embedded Background",
        description: "Switch background to embedded webpage mode",
        keywords: ["embedded background", "embed background", "background embed", "background url", "url background", "url", "webpage", "\u5D4C\u5165\u80CC\u666F", "\u7F51\u9875\u80CC\u666F", "\u80CC\u666F\u5207\u6362\u5230 \u5D4C\u5165\u80CC\u666F", "\u80CC\u666F\u5207\u6362\u5230\u5D4C\u5165\u80CC\u666F"]
      },
      render: ({ config }) => /* @__PURE__ */ jsx(
        UrlBackgroundLayer_default,
        {
          urlBackgroundList: config?.url?.items,
          urlBackgroundSelectedId: config?.url?.selectedId
        }
      ),
      renderSettingsPanel: ({ config, actions, ...props }) => /* @__PURE__ */ jsx(
        UrlBackgroundSettingsCard,
        {
          ...props,
          urlBackgroundList: config?.url?.items,
          urlBackgroundSelectedId: config?.url?.selectedId,
          onAddUrlBackgroundItem: actions?.url?.onAdd,
          onUpdateUrlBackgroundItem: actions?.url?.onUpdate,
          onDeleteUrlBackgroundItem: actions?.url?.onDelete,
          onSetUrlBackgroundSelectedId: actions?.url?.onSelect
        }
      )
    });
  
    // src/render/folia/components/visualizer/backgrounds/registry.tsx
    var ENTRIES = [
      entry_default,
      entry_default3,
      entry_default4,
      entry_default2,
      entry_default5,
      entry_default6
    ].sort((left, right) => left.order - right.order);
    var BY_MODE = {};
    for (const entry of ENTRIES) {
      BY_MODE[entry.mode] = entry;
    }
    var VISUALIZER_BACKGROUND_REGISTRY = ENTRIES;
    var hasVisualizerBackgroundMode = (mode) => typeof mode === "string" && Boolean(BY_MODE[mode]);
    var getVisualizerBackgroundRegistryEntry = (mode) => BY_MODE[mode] ?? BY_MODE[DEFAULT_VISUALIZER_BACKGROUND_MODE] ?? ENTRIES[0];
    var VISUALIZER_BACKGROUND_MODE_IDS = ENTRIES.map((entry) => entry.mode);
  
    // src/render/folia/components/visualizer/backgrounds/VisualizerBackgroundRenderer.tsx
    var VisualizerBackgroundRenderer = (props) => {
      if (props.config?.transparent) {
        return null;
      }
      const mode = props.config?.mode ?? DEFAULT_VISUALIZER_BACKGROUND_MODE;
      return getVisualizerBackgroundRegistryEntry(mode).render(props);
    };
    var VisualizerBackgroundRenderer_default = VisualizerBackgroundRenderer;
    return __toCommonJS(backgrounds_entry_exports);
  })();
  /* @license twgl.js 7.0.0 Copyright (c) 2015, Gregg Tavares All Rights Reserved.
  Available via the MIT license.
  see: http://github.com/greggman/twgl.js for details */
  
  return typeof MPFoliaBackgrounds === "undefined" ? null : MPFoliaBackgrounds
}
