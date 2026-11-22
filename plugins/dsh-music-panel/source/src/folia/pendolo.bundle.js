function __mpPendoloBundle() {
  var MPFoliaPendolo = (() => {
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
  
    // src/render/folia/entry.tsx
    var entry_exports = {};
    __export(entry_exports, {
      DEFAULT_PENDOLO_TUNING: () => DEFAULT_PENDOLO_TUNING,
      VisualizerPendolo: () => VisualizerPendolo_default,
      buildTimedWords: () => buildTimedWords,
      estimateLrcLineEndTime: () => estimateLrcLineEndTime,
      hasMotion: () => hasMotion
    });
  
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
      destroy: () => {
      }
    }));
    var useMotionValueEvent = framer.useMotionValueEvent || (() => {
    });
    var useDragControls = framer.useDragControls || (() => ({ start: () => {
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
        destroy: () => {
        }
      };
    });
    var useReducedMotion = framer.useReducedMotion || (() => false);
    var animate = framer.animate || (() => ({ stop: () => {
    } }));
  
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
  
    // src/render/folia/types.ts
    var DEFAULT_PENDOLO_TUNING = {
      render: { scale: "global", antialias: "global" },
      arcRadius: 0.42,
      arcAngleDeg: 100,
      wheelCenterX: 0,
      wheelCenterY: 0.5,
      tickSnappiness: 2,
      activeScale: 1.25,
      showGearDecor: "subtle",
      showCenterGradient: true,
      showCoverOnWatchFace: false,
      enableLineGlow: false,
      mirrorLayout: false,
      tiltDeg: 0,
      tiltAxisDeg: 0,
      parallaxDepth: 1,
      hubView: false,
      hubViewHeight: 1.4,
      hubViewBack: 1.2
    };
  
    // src/render/folia/utils/lyricRenderQuality.ts
    var MAX_LYRIC_PIXEL_RATIO = 3;
    var resolveLyricRenderQuality = (global, override) => ({
      scale: override && override.scale !== "global" ? override.scale : global.scale,
      antialias: override && override.antialias !== "global" ? override.antialias : global.antialias
    });
    var resolveLyricPixelRatio = (base, scale, max = MAX_LYRIC_PIXEL_RATIO) => {
      const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
      const ratio = safeBase * scale;
      return scale > 1 ? Math.max(safeBase, Math.min(ratio, max)) : ratio;
    };
    var resolveLyricAntialias = (antialias, styleDefault) => antialias === "auto" ? styleDefault : antialias === "on";
  
    // src/render/folia/components/visualizer/renderQuality/useLyricRenderQuality.ts
    var GLOBAL_QUALITY = { scale: 1, antialias: "auto" };
    var useLyricRenderQuality = (override) => useMemo(() => resolveLyricRenderQuality(GLOBAL_QUALITY, override), [override]);
  
    // src/render/folia/components/visualizer/textMeasureCache.ts
    var rememberBounded = (cache, key, value, limit) => {
      if (!cache.has(key) && cache.size >= limit) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(key, value);
      return value;
    };
    var measurePrefixOffsets = (graphemes, measurePrefix) => {
      const offsets = new Array(graphemes.length + 1).fill(0);
      for (let count = 1; count <= graphemes.length; count += 1) {
        offsets[count] = measurePrefix(graphemes.slice(0, count).join(""), count, offsets[count - 1]);
      }
      return offsets;
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
  
    // src/render/folia/hooks/useLucideIcons.ts
    var useLucideIcons = (_names) => 0;
  
    // src/render/folia/services/lucideIconResolver.ts
    var resolveLucideIcon = (_name) => null;
  
    // src/render/folia/utils/fontStacks.ts
    var MIN_FONT_WEIGHT = 100;
    var MAX_FONT_WEIGHT = 900;
    var FONT_WEIGHT_STEP = 10;
    var normalizeFontWeight = (fontWeight) => {
      if (typeof fontWeight !== "number" || !Number.isFinite(fontWeight)) return null;
      const clamped = Math.min(MAX_FONT_WEIGHT, Math.max(MIN_FONT_WEIGHT, fontWeight));
      return Math.round(clamped / FONT_WEIGHT_STEP) * FONT_WEIGHT_STEP;
    };
    var resolveThemeFontWeight = (theme, fallback) => normalizeFontWeight(theme?.fontWeight) ?? fallback;
    var SUGAR_SERIF_FAMILY = '"\u7345\u5C3E\u56DB\u5B63\u6625\u52A0\u7CD6SC"';
    var BUILTIN_FONT_STACKS = {
      sans: '"Inter", "Noto Sans CJK SC", "Noto Sans JP", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
      serif: `${SUGAR_SERIF_FAMILY}, "Iowan Old Style", "Noto Serif CJK SC", "Noto Serif JP", "Source Han Serif SC", "Songti SC", "STSong", "Georgia", serif`,
      mono: '"IBM Plex Mono", "Sarasa Mono SC", "Noto Sans Mono CJK SC", "Noto Sans Mono", "SFMono-Regular", Consolas, monospace'
    };
    var TRANSLATION_FONT_STACKS = {
      sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans JP", "Source Han Sans JP", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif',
      serif: `${SUGAR_SERIF_FAMILY}, "Folia Noto Serif SC", "Iowan Old Style", Georgia, "Times New Roman", "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", "Noto Serif JP", "Source Han Serif JP", "Yu Mincho", "MS PMincho", serif`,
      mono: 'Consolas, "IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, "Sarasa Mono SC", "Noto Sans Mono CJK SC", "SimHei", "DengXian", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans Mono CJK JP", "MS Gothic", monospace'
    };
    var CSS_GENERIC_FONT_FAMILIES = /* @__PURE__ */ new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
      "ui-serif",
      "ui-sans-serif",
      "ui-monospace",
      "ui-rounded",
      "emoji",
      "math",
      "fangsong"
    ]);
    var quoteFontFamily = (fontFamily) => `"${fontFamily.replace(/["\\]/g, "\\$&")}"`;
    var normalizeFontFamilyName = (fontFamily) => fontFamily.trim().replace(/^['"]|['"]$/g, "").trim();
    var formatFontFamily = (fontFamily) => {
      const normalized = normalizeFontFamilyName(fontFamily);
      if (!normalized) return null;
      return CSS_GENERIC_FONT_FAMILIES.has(normalized.toLowerCase()) ? normalized : quoteFontFamily(normalized);
    };
    var normalizeFontFamilyStack = (fontFamilies) => {
      const seen = /* @__PURE__ */ new Set();
      const stack = [];
      fontFamilies?.forEach((fontFamily) => {
        const normalized = normalizeFontFamilyName(fontFamily ?? "");
        if (!normalized) return;
        const key = normalized.toLocaleLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        stack.push(normalized);
      });
      return stack;
    };
    var buildCustomFontFamilyStack = (theme) => {
      const familiesToNormalize = [
        ...theme.fontFamily ? [theme.fontFamily] : [],
        ...theme.fontFamilyStack ?? []
      ];
      if (familiesToNormalize.length === 0) {
        return [];
      }
      return normalizeFontFamilyStack(familiesToNormalize).map(formatFontFamily).filter((fontFamily) => Boolean(fontFamily));
    };
    var getBuiltinThemeFontStack = (fontStyle) => {
      return BUILTIN_FONT_STACKS[fontStyle] ?? BUILTIN_FONT_STACKS.sans;
    };
    var resolveThemeFontStack = (theme) => {
      const fallbackStack = getBuiltinThemeFontStack(theme.fontStyle);
      const customFontStack = buildCustomFontFamilyStack(theme);
      if (customFontStack.length === 0) {
        return fallbackStack;
      }
      return `${customFontStack.join(", ")}, ${fallbackStack}`;
    };
    var resolveThemeTranslationFontStack = (theme) => {
      const fallbackStack = TRANSLATION_FONT_STACKS[theme.fontStyle] ?? TRANSLATION_FONT_STACKS.sans;
      const customFontStack = buildCustomFontFamilyStack(theme);
      if (customFontStack.length === 0) {
        return fallbackStack;
      }
      return `${customFontStack.join(", ")}, ${fallbackStack}`;
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
  
    // src/render/folia/components/visualizer/VisualizerShell.tsx
    var VisualizerShell = ({ theme, children }) => /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          fontFamily: resolveThemeFontStack(theme),
          fontWeight: resolveThemeFontWeight(theme, 400),
          // The page's own controls sit above the style; the style keeps the box.
          pointerEvents: "none"
        },
        children
      }
    );
    VisualizerShell.displayName = "VisualizerShell";
    var VisualizerShell_default = VisualizerShell;
  
    // src/render/folia/components/visualizer/pendolo/pendoloClockworkScene.ts
    var buildPendoloClockworkPalette = (primaryTextColor, accentTextColor, showGearDecor) => {
      const isFull = showGearDecor === "full";
      const m = isFull ? 1 : 0.6;
      return {
        decorOpacityMultiplier: m,
        primaryAlpha10: colorWithAlpha(primaryTextColor, 0.1 * m),
        primaryAlpha15: colorWithAlpha(primaryTextColor, 0.15 * m),
        accentAlpha35: colorWithAlpha(accentTextColor, 0.35 * m),
        // Keep lyric guide rings/ticks subtle; lift only the mechanical assembly above them.
        gearPrimaryAlpha: colorWithAlpha(primaryTextColor, 0.42 * m),
        gearPrimarySubtleAlpha: colorWithAlpha(primaryTextColor, 0.32 * m),
        gearAccentAlpha: colorWithAlpha(accentTextColor, 0.58 * m),
        gearAccentStrongAlpha: colorWithAlpha(accentTextColor, 0.72 * m),
        planetGearAlpha: colorWithAlpha(primaryTextColor, 0.24 * m),
        jewelFillColor: colorWithAlpha(accentTextColor, 0.28 * m),
        jewelStrokeColor: colorWithAlpha(accentTextColor, 0.65 * m),
        mainGearFill: colorWithAlpha(accentTextColor, 0.08 * m),
        balanceGearFill: colorWithAlpha(accentTextColor, 0.1 * m),
        secondGearFill: colorWithAlpha(accentTextColor, 0.06 * m),
        bevelRing: colorWithAlpha(primaryTextColor, 0.18 * m),
        rivetStroke: colorWithAlpha(primaryTextColor, 0.25 * m),
        guillocheAlt: colorWithAlpha(primaryTextColor, 0.07 * m),
        genevaAlt: colorWithAlpha(primaryTextColor, 0.06 * m),
        idlerStroke: colorWithAlpha(primaryTextColor, 0.28 * m),
        idlerInner: colorWithAlpha(primaryTextColor, 0.18 * m)
      };
    };
    var resolvePendoloClockworkAnchors = (layout) => {
      const { centerX, centerY, baseRadius, lyricRingRadius } = layout;
      const balanceCx = centerX + baseRadius * 0.2;
      const balanceCy = centerY - baseRadius * 0.75;
      const balanceR = baseRadius * 0.28;
      const transCx = centerX + baseRadius * 0.32;
      const transCy = centerY + baseRadius * 0.78;
      const transR = baseRadius * 0.34;
      const secondGearCx = centerX + baseRadius * 0.68;
      const secondGearCy = centerY + baseRadius * 0.76;
      const secondGearR = baseRadius * 0.16;
      const idlerCx = (transCx + secondGearCx) * 0.5 + baseRadius * 0.04;
      const idlerCy = (transCy + secondGearCy) * 0.5 - baseRadius * 0.02;
      const idlerR = baseRadius * 0.08;
      const focalAxisEndRadius = Math.min(
        lyricRingRadius - Math.max(14, baseRadius * 0.025)
      );
      return {
        balanceCx,
        balanceCy,
        balanceR,
        transCx,
        transCy,
        transR,
        secondGearCx,
        secondGearCy,
        secondGearR,
        idlerCx,
        idlerCy,
        idlerR,
        focalAxisEndRadius,
        orbitR: baseRadius * 0.52,
        planetR: baseRadius * 0.16,
        coverRadius: baseRadius * 0.88,
        gradientR: baseRadius * 1.65
      };
    };
    var resolveClockworkReach = (baseRadius, hasCenterGradient) => baseRadius * (hasCenterGradient ? 1.65 : 1.4) + 16;
    var resolvePendoloClockworkBox = (centerX, centerY, baseRadius, lyricRingRadius, viewportWidth, viewportHeight, hasCenterGradient, mirrored = false, tilted = false) => {
      if (tilted) return { left: 0, top: 0, width: Math.max(0, viewportWidth), height: Math.max(0, viewportHeight) };
      const reach = resolveClockworkReach(baseRadius, hasCenterGradient);
      const sideReach = Math.max(reach, lyricRingRadius + 16);
      const left = Math.max(0, Math.floor(centerX - (mirrored ? sideReach : reach)));
      const top = Math.max(0, Math.floor(centerY - reach));
      const right = Math.min(viewportWidth, Math.ceil(centerX + (mirrored ? reach : sideReach)));
      const bottom = Math.min(viewportHeight, Math.ceil(centerY + reach));
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
      };
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloClockworkDraw2d.ts
    function drawGearTeeth(ctx, cx, cy, radius, teethCount, toothDepth, rotationRad, strokeColor, lineWidth, fillColor) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationRad);
      const innerR = radius - toothDepth;
      const outerR = radius;
      const anglePerTooth = Math.PI * 2 / teethCount;
      ctx.beginPath();
      for (let i = 0; i < teethCount; i++) {
        const baseAngle = i * anglePerTooth;
        const a0 = baseAngle - anglePerTooth * 0.22;
        const a1 = baseAngle - anglePerTooth * 0.12;
        const a2 = baseAngle + anglePerTooth * 0.12;
        const a3 = baseAngle + anglePerTooth * 0.22;
        const x0 = innerR * Math.cos(a0);
        const y0 = innerR * Math.sin(a0);
        const x1 = outerR * Math.cos(a1);
        const y1 = outerR * Math.sin(a1);
        const x2 = outerR * Math.cos(a2);
        const y2 = outerR * Math.sin(a2);
        const x3 = innerR * Math.cos(a3);
        const y3 = innerR * Math.sin(a3);
        if (i === 0) ctx.moveTo(x0, y0);
        else ctx.lineTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
      }
      ctx.closePath();
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.restore();
    }
    function drawSpokedWheel(ctx, cx, cy, hubR, rimR, spokeCount, rotationRad, strokeColor, lineWidth) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationRad);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(0, 0, hubR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rimR, 0, Math.PI * 2);
      ctx.stroke();
      const angleStep = Math.PI * 2 / spokeCount;
      for (let i = 0; i < spokeCount; i++) {
        const a = i * angleStep;
        ctx.beginPath();
        ctx.moveTo(hubR * Math.cos(a), hubR * Math.sin(a));
        ctx.lineTo(rimR * Math.cos(a), rimR * Math.sin(a));
        ctx.stroke();
      }
      const midR = (hubR + rimR) * 0.5;
      const holeR = (rimR - hubR) * 0.22;
      for (let i = 0; i < spokeCount; i++) {
        const a = i * angleStep + angleStep * 0.5;
        ctx.beginPath();
        ctx.arc(midR * Math.cos(a), midR * Math.sin(a), holeR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawHairspring(ctx, cx, cy, startR, endR, coils, oscillationRad, strokeColor, lineWidth) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(oscillationRad);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      const totalAngle = coils * Math.PI * 2;
      const steps = coils * 60;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * totalAngle;
        const r = startR + (endR - startR) * Math.pow(t, 0.9);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    function drawJewel(ctx, cx, cy, outerR, innerR, strokeOuter, strokeInner, outerWidth, innerWidth) {
      ctx.strokeStyle = strokeOuter;
      ctx.lineWidth = outerWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = strokeInner;
      ctx.lineWidth = innerWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.stroke();
    }
    var drawPendoloClockwork2d = (ctx, input) => {
      const {
        centerX,
        centerY,
        baseRadius,
        escapementAngle,
        phase,
        bassOscillation,
        secondGearAngle,
        transBeatAngle = 0,
        primaryTextColor,
        accentTextColor,
        backgroundColor,
        showGearDecor,
        showCenterGradient,
        showCover,
        coverImage
      } = input;
      const anchors = resolvePendoloClockworkAnchors(input);
      if (showCenterGradient) {
        const bgCol = backgroundColor || "#000000";
        const grad = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          anchors.gradientR
        );
        grad.addColorStop(0, colorWithAlpha(bgCol, 0.72));
        grad.addColorStop(0.35, colorWithAlpha(bgCol, 0.52));
        grad.addColorStop(0.7, colorWithAlpha(bgCol, 0.2));
        grad.addColorStop(1, colorWithAlpha(bgCol, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, anchors.gradientR, 0, Math.PI * 2);
        ctx.fill();
      }
      if (showCover && coverImage) {
        const coverRadius = anchors.coverRadius;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, coverRadius, 0, Math.PI * 2);
        ctx.clip();
        const isFullDecor = showGearDecor === "full";
        ctx.globalAlpha = 0.42 * (isFullDecor ? 1 : 0.6);
        const size = coverRadius * 2;
        if (input.mirrored) {
          ctx.translate(centerX, 0);
          ctx.scale(-1, 1);
          ctx.translate(-centerX, 0);
        }
        ctx.drawImage(coverImage, centerX - coverRadius, centerY - coverRadius, size, size);
        ctx.restore();
      }
      if (showGearDecor === "none") return;
      const palette = buildPendoloClockworkPalette(primaryTextColor, accentTextColor, showGearDecor);
      const m = palette.decorOpacityMultiplier;
      ctx.strokeStyle = palette.primaryAlpha15;
      ctx.lineWidth = 1;
      const ringRadii = [
        baseRadius * 0.3,
        baseRadius * 0.6,
        baseRadius * 0.85,
        baseRadius * 1.15,
        baseRadius * 1.4
      ];
      ringRadii.forEach((r) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      const tickCount = 60;
      const outerTickR = baseRadius * 1.15;
      for (let i = 0; i < tickCount; i++) {
        const angle = i * Math.PI * 2 / tickCount + escapementAngle * 0.2;
        const isMajor = i % 5 === 0;
        const tickLen = isMajor ? 12 : 6;
        ctx.strokeStyle = isMajor ? palette.accentAlpha35 : palette.primaryAlpha15;
        ctx.lineWidth = isMajor ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(centerX + outerTickR * Math.cos(angle), centerY + outerTickR * Math.sin(angle));
        ctx.lineTo(
          centerX + (outerTickR + tickLen) * Math.cos(angle),
          centerY + (outerTickR + tickLen) * Math.sin(angle)
        );
        ctx.stroke();
      }
      drawGearTeeth(
        ctx,
        centerX,
        centerY,
        baseRadius + 8,
        36,
        10,
        escapementAngle,
        palette.gearAccentAlpha,
        2.2,
        palette.mainGearFill
      );
      drawSpokedWheel(
        ctx,
        centerX,
        centerY,
        baseRadius * 0.2,
        baseRadius * 0.85,
        6,
        escapementAngle,
        palette.gearPrimaryAlpha,
        1.8
      );
      ctx.strokeStyle = palette.bevelRing;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(escapementAngle);
      const guillocheInnerR = baseRadius * 0.62;
      const guillocheOuterR = baseRadius * 0.83;
      for (let i = 0; i < 48; i++) {
        const a = i * Math.PI * 2 / 48;
        const innerOffset = i % 2 === 0 ? guillocheInnerR : guillocheInnerR + (guillocheOuterR - guillocheInnerR) * 0.3;
        ctx.strokeStyle = i % 2 === 0 ? palette.primaryAlpha10 : palette.guillocheAlt;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(innerOffset * Math.cos(a), innerOffset * Math.sin(a));
        ctx.lineTo(guillocheOuterR * Math.cos(a), guillocheOuterR * Math.sin(a));
        ctx.stroke();
      }
      ctx.restore();
      const rivetR = baseRadius * 0.96;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI * 2 / 12 + escapementAngle;
        ctx.strokeStyle = palette.rivetStroke;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(centerX + rivetR * Math.cos(a), centerY + rivetR * Math.sin(a), 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawGearTeeth(
        ctx,
        centerX,
        centerY,
        baseRadius * 0.22,
        12,
        6,
        -escapementAngle * 2.5,
        palette.gearAccentStrongAlpha,
        2.1
      );
      drawJewel(ctx, centerX, centerY, 4.5, 2.5, palette.jewelStrokeColor, palette.jewelFillColor, 1.2, 0.8);
      const orbitAngleBase = escapementAngle * 0.4;
      for (let planetIdx = 0; planetIdx < 3; planetIdx++) {
        const planetAngle = orbitAngleBase + planetIdx * Math.PI * 2 / 3;
        const px = centerX + anchors.orbitR * Math.cos(planetAngle);
        const py = centerY + anchors.orbitR * Math.sin(planetAngle);
        drawGearTeeth(
          ctx,
          px,
          py,
          anchors.planetR,
          14,
          5,
          -escapementAngle * 3 + planetIdx * 0.5,
          palette.planetGearAlpha,
          1.7
        );
        drawJewel(ctx, px, py, 3.5, 1.8, palette.jewelStrokeColor, palette.jewelFillColor, 1, 0.7);
      }
      const balanceGearAngle = phase * 0.1;
      drawGearTeeth(
        ctx,
        anchors.balanceCx,
        anchors.balanceCy,
        anchors.balanceR,
        20,
        7,
        balanceGearAngle,
        palette.gearAccentStrongAlpha,
        2.1,
        palette.balanceGearFill
      );
      ctx.strokeStyle = palette.gearPrimarySubtleAlpha;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(anchors.balanceCx, anchors.balanceCy, anchors.balanceR * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      drawHairspring(
        ctx,
        anchors.balanceCx,
        anchors.balanceCy,
        anchors.balanceR * 0.56,
        anchors.balanceR * 0.88,
        3.5,
        bassOscillation * 0.6 + balanceGearAngle * 0.3,
        colorWithAlpha(accentTextColor, 0.3 * m),
        0.8
      );
      drawJewel(
        ctx,
        anchors.balanceCx,
        anchors.balanceCy,
        3.5,
        1.8,
        palette.jewelStrokeColor,
        palette.jewelFillColor,
        1,
        0.7
      );
      const transAngle = -escapementAngle * 1.4 + transBeatAngle;
      drawGearTeeth(
        ctx,
        anchors.transCx,
        anchors.transCy,
        anchors.transR,
        24,
        7,
        transAngle,
        palette.gearPrimaryAlpha,
        1.8
      );
      drawSpokedWheel(
        ctx,
        anchors.transCx,
        anchors.transCy,
        anchors.transR * 0.25,
        anchors.transR * 0.85,
        5,
        transAngle,
        palette.gearPrimarySubtleAlpha,
        1.5
      );
      ctx.save();
      ctx.translate(anchors.transCx, anchors.transCy);
      ctx.rotate(transAngle);
      ctx.beginPath();
      ctx.arc(0, 0, anchors.transR * 0.8, 0, Math.PI * 2);
      ctx.clip();
      const genevaSpan = anchors.transR * 1.6;
      const genevaStep = genevaSpan / 10;
      for (let i = 1; i <= 9; i++) {
        const yOff = -genevaSpan * 0.5 + i * genevaStep;
        ctx.strokeStyle = i % 2 === 0 ? palette.primaryAlpha10 : palette.genevaAlt;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-anchors.transR, yOff);
        ctx.lineTo(anchors.transR, yOff);
        ctx.stroke();
      }
      ctx.restore();
      drawJewel(
        ctx,
        anchors.transCx,
        anchors.transCy,
        3.5,
        1.8,
        palette.jewelStrokeColor,
        palette.jewelFillColor,
        1,
        0.7
      );
      drawGearTeeth(
        ctx,
        anchors.secondGearCx,
        anchors.secondGearCy,
        anchors.secondGearR,
        15,
        5,
        secondGearAngle,
        palette.gearAccentAlpha,
        1.8,
        palette.secondGearFill
      );
      drawSpokedWheel(
        ctx,
        anchors.secondGearCx,
        anchors.secondGearCy,
        anchors.secondGearR * 0.28,
        anchors.secondGearR * 0.76,
        4,
        -secondGearAngle,
        palette.gearPrimarySubtleAlpha,
        1.3
      );
      drawJewel(
        ctx,
        anchors.secondGearCx,
        anchors.secondGearCy,
        2.8,
        1.5,
        palette.jewelStrokeColor,
        palette.jewelFillColor,
        0.8,
        0.6
      );
      drawGearTeeth(
        ctx,
        anchors.idlerCx,
        anchors.idlerCy,
        anchors.idlerR,
        10,
        3.5,
        escapementAngle * 2.2,
        palette.idlerStroke,
        1.3
      );
      ctx.strokeStyle = palette.idlerInner;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(anchors.idlerCx, anchors.idlerCy, anchors.idlerR * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      drawJewel(
        ctx,
        anchors.idlerCx,
        anchors.idlerCy,
        2.2,
        1.2,
        palette.jewelStrokeColor,
        palette.jewelFillColor,
        0.7,
        0.5
      );
      ctx.strokeStyle = palette.gearAccentStrongAlpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX + baseRadius * 0.8, centerY);
      ctx.lineTo(centerX + anchors.focalAxisEndRadius, centerY);
      ctx.stroke();
      const arrowX = centerX + anchors.focalAxisEndRadius;
      ctx.fillStyle = palette.gearAccentStrongAlpha;
      ctx.beginPath();
      ctx.moveTo(arrowX, centerY - 4);
      ctx.lineTo(arrowX + 8, centerY);
      ctx.lineTo(arrowX, centerY + 4);
      ctx.closePath();
      ctx.fill();
    };
  
    // src/render/folia/services/beatFx/beatFxLive.ts
    var isBeatFxReady = () => false;
    var getBeatEffectStrength = (_effectId) => 0;
    var getBeatFxBeatPeriod = () => 0.5;
    var getBeatFxHeard = () => ({ key: "", time: null });
    var getBeatFxLastBeat = () => null;
    var getBeatFxLastDownbeat = () => null;
    var getBeatFxTrackScale = () => 1;
    var getBeatFxFiredCounts = () => ({});
    var getBeatFxIntensities = () => ({});
  
    // src/render/folia/services/beatFx/clock.ts
    var BEAT_FX_WEAK_BEAT_FLOOR = 0.35;
    var resolveBeatFxAccentGain = (event, trackScale) => {
      if (event?.rhythmic === false) return 0;
      if (!event || event.impact === void 0) return trackScale;
      return (BEAT_FX_WEAK_BEAT_FLOOR + (1 - BEAT_FX_WEAK_BEAT_FLOOR) * event.impact) * trackScale;
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloBeatFx.ts
    var FLARE_DECAY_SECONDS = 0.25;
    var PENDOLO_MAX_SPARKS = 192;
    var PENDOLO_SPARK_STRIDE = 6;
    var SPARK_GRAVITY = 120;
    var SPARK_DRAG = 3;
    var PENDOLO_WAVE_SECONDS = 0.5;
    var WAVE_SHARE_OF_BEAT = 0.85;
    var WAVE_MIN_SECONDS = 0.3;
    var PENDOLO_TICK_DIAL = 1.15;
    var PENDOLO_OUTER_DIAL = 1.4;
    var DIAL_LIGHT_DECAY_SECONDS = 0.45;
    var SHAKE_DECAY = 9;
    var SHAKE_PX = 8;
    var createPendoloBeatCounter = () => ({ beats: 0, downbeats: 0, synced: false });
    var NO_TRIGGERS = {
      beats: 0,
      downbeats: 0,
      beatGain: 0,
      downbeatGain: 0,
      beatAccentGain: 0,
      downbeatAccentGain: 0
    };
    var latestOf = (beat, downbeat) => {
      if (!beat) return downbeat;
      if (!downbeat) return beat;
      return downbeat.t >= beat.t ? downbeat : beat;
    };
    var resolvePendoloBeatTriggers = (counter, fired, lastBeat, lastDownbeat, trackScale, intensities, out = { ...NO_TRIGGERS }) => {
      const beats = counter.synced ? Math.max(0, fired.beats - counter.beats) : 0;
      const downbeats = counter.synced ? Math.max(0, fired.downbeats - counter.downbeats) : 0;
      counter.beats = fired.beats;
      counter.downbeats = fired.downbeats;
      counter.synced = true;
      const latest = latestOf(lastBeat, lastDownbeat);
      out.beats = latest?.rhythmic === false ? 0 : beats;
      out.downbeats = lastDownbeat?.rhythmic === false ? 0 : downbeats;
      out.beatGain = intensities.beat;
      out.downbeatGain = intensities.downbeat;
      out.beatAccentGain = resolveBeatFxAccentGain(latest, trackScale) * intensities.beat;
      out.downbeatAccentGain = resolveBeatFxAccentGain(lastDownbeat, trackScale) * intensities.downbeat;
      return out;
    };
    var readPendoloBeatTriggers = (counter, out) => resolvePendoloBeatTriggers(
      counter,
      getBeatFxFiredCounts(),
      getBeatFxLastBeat(),
      getBeatFxLastDownbeat(),
      getBeatFxTrackScale(),
      getBeatFxIntensities(),
      out
    );
    var createPendoloBeatFxState = () => ({
      jewelFlare: 0,
      smallJewelFlare: 0,
      sparks: new Float32Array(PENDOLO_MAX_SPARKS * PENDOLO_SPARK_STRIDE),
      sparkCursor: 0,
      waveStart: -1,
      waveDuration: PENDOLO_WAVE_SECONDS,
      waveGain: 0,
      waveX: 0,
      waveY: 0,
      wavePunch: 0,
      waveDials: 0,
      tickDialLight: 0,
      outerDialLight: 0,
      shake: 0
    });
    var spawnSparks = (state, points, gain, random) => {
      const perPoint = Math.round(10 + 10 * Math.min(1.5, gain));
      for (const point of points) {
        const length = Math.hypot(point.tx, point.ty) || 1;
        const tx = point.tx / length;
        const ty = point.ty / length;
        for (let index = 0; index < perPoint; index += 1) {
          const direction = random() < 0.5 ? 1 : -1;
          const speed = 180 + random() * 320;
          const spread = (random() - 0.5) * 0.9;
          const life = 0.18 + random() * 0.22;
          const at = state.sparkCursor * PENDOLO_SPARK_STRIDE;
          state.sparks[at] = point.x;
          state.sparks[at + 1] = point.y;
          state.sparks[at + 2] = (tx * direction + ty * spread) * speed;
          state.sparks[at + 3] = (ty * direction - tx * spread) * speed;
          state.sparks[at + 4] = life;
          state.sparks[at + 5] = life;
          state.sparkCursor = (state.sparkCursor + 1) % PENDOLO_MAX_SPARKS;
        }
      }
    };
    var stepPendoloBeatFx = (state, triggers, context) => {
      const { now, dt } = context;
      const waveGain = triggers.downbeats > 0 ? triggers.downbeatAccentGain : triggers.beats > 0 ? triggers.beatAccentGain : 0;
      if (waveGain > 0) {
        state.waveStart = now;
        state.waveDuration = context.waveSeconds ?? Math.min(PENDOLO_WAVE_SECONDS, Math.max(WAVE_MIN_SECONDS, WAVE_SHARE_OF_BEAT * context.beatPeriod));
        state.waveGain = Math.min(1.5, waveGain);
        state.waveX = 0;
        state.waveY = 0;
        state.waveDials = 0;
        const strength = triggers.downbeats > 0 ? triggers.downbeatGain : triggers.beatGain;
        const punch = strength > 0 ? resolvePendoloWavePunch(waveGain / strength, strength) : resolvePendoloWavePunch(waveGain, 1);
        state.wavePunch = punch;
        state.jewelFlare = Math.max(state.jewelFlare, punch);
        state.smallJewelFlare = Math.max(state.smallJewelFlare, punch);
      }
      const gain = triggers.downbeatGain;
      if (triggers.downbeats > 0 && gain > 0) {
        spawnSparks(state, context.meshPoints, gain, context.random);
        state.shake = Math.max(state.shake, Math.min(1.5, gain));
      }
      const flareDecay = Math.exp(-dt / FLARE_DECAY_SECONDS * 2.3);
      state.jewelFlare *= flareDecay;
      state.smallJewelFlare *= flareDecay;
      state.shake *= Math.exp(-SHAKE_DECAY * dt);
      const dialDecay = Math.exp(-dt / DIAL_LIGHT_DECAY_SECONDS * 2.3);
      state.tickDialLight *= dialDecay;
      state.outerDialLight *= dialDecay;
      if (state.tickDialLight < 1e-3) state.tickDialLight = 0;
      if (state.outerDialLight < 1e-3) state.outerDialLight = 0;
      if (state.jewelFlare < 1e-3) state.jewelFlare = 0;
      if (state.smallJewelFlare < 1e-3) state.smallJewelFlare = 0;
      if (state.shake < 0.01) state.shake = 0;
      if (state.waveStart >= 0 && now - state.waveStart > state.waveDuration) state.waveStart = -1;
      const drag = Math.exp(-SPARK_DRAG * dt);
      for (let at = 0; at < state.sparks.length; at += PENDOLO_SPARK_STRIDE) {
        if (state.sparks[at + 4] <= 0) continue;
        state.sparks[at] += state.sparks[at + 2] * dt;
        state.sparks[at + 1] += state.sparks[at + 3] * dt;
        state.sparks[at + 2] *= drag;
        state.sparks[at + 3] = state.sparks[at + 3] * drag + SPARK_GRAVITY * dt;
        state.sparks[at + 4] -= dt;
      }
      return state;
    };
    var resolvePendoloWave = (state, now, baseRadius, maxRadius) => {
      if (state.waveStart < 0) return null;
      const progress = (now - state.waveStart) / state.waveDuration;
      if (progress < 0 || progress > 1) return null;
      const eased = 0.3 * progress + 0.7 * progress * progress;
      const start = baseRadius * 0.08;
      return {
        radius: start + (maxRadius - start) * eased,
        band: 200 + 140 * state.waveGain,
        strength: (1 - progress) ** 0.8 * Math.min(1.3, 1.3 * state.waveGain),
        x: state.waveX,
        y: state.waveY
      };
    };
    var resolvePendoloHaloOpacity = (state, now) => {
      if (state.waveStart < 0) return 0;
      const progress = (now - state.waveStart) / state.waveDuration;
      if (progress < 0 || progress > 1) return 0;
      return state.wavePunch * (1 - progress) ** 0.5;
    };
    var PUNCH_RANGE_DB = 30;
    var resolvePendoloWavePunch = (accent, strength) => {
      const a = Math.min(1, Math.max(0, accent));
      if (!(a > 0) || !(strength > 0)) return 0;
      const below = (1 - a) / (1 - BEAT_FX_WEAK_BEAT_FLOOR);
      return Math.min(1, strength * 10 ** (-(PUNCH_RANGE_DB / 20) * below));
    };
    var lightPendoloDials = (state, wave, baseRadius) => {
      if (!wave) return;
      const light = state.wavePunch;
      if (!(state.waveDials & 1) && wave.radius >= baseRadius * PENDOLO_TICK_DIAL) {
        state.waveDials |= 1;
        state.tickDialLight = Math.max(state.tickDialLight, light);
      }
      if (!(state.waveDials & 2) && wave.radius >= baseRadius * PENDOLO_OUTER_DIAL) {
        state.waveDials |= 2;
        state.outerDialLight = Math.max(state.outerDialLight, light);
      }
    };
    var resolvePendoloWaveBump = (wave, distance) => {
      const u = (distance - (wave.radius - wave.band)) / wave.band;
      if (u <= 0 || u >= 1) return 0;
      const s = Math.sin(Math.PI * u);
      return s * s;
    };
    var PENDOLO_WAVE_PUSH = 0.2;
    var PENDOLO_WAVE_LIGHT = 1.8;
    var PENDOLO_WAVE_TINT = 0.5;
    var resolvePendoloPointWave = (dx, dy, radius, band, strength) => {
      if (strength <= 0 || band <= 0) return { x: 0, y: 0 };
      const bump = resolvePendoloWaveBump({ radius, band, strength }, Math.hypot(dx, dy));
      if (bump <= 0) return { x: 0, y: 0 };
      const push = PENDOLO_WAVE_PUSH * strength * bump;
      return { x: dx * push, y: dy * push };
    };
    var LINE_TEXT_REACH = 40;
    var resolvePendoloLineWave = (dx, dy, radius, band, strength) => {
      if (strength <= 0 || band <= 0) return { x: 0, y: 0, light: 0 };
      const length = Math.hypot(dx, dy);
      const bump = resolvePendoloWaveBump({ radius, band, strength }, length + LINE_TEXT_REACH);
      if (bump <= 0 || length === 0) return { x: 0, y: 0, light: 0 };
      const push = (length + LINE_TEXT_REACH) * PENDOLO_WAVE_PUSH * strength * bump;
      return {
        x: dx / length * push,
        y: dy / length * push,
        light: Math.min(1, PENDOLO_WAVE_LIGHT * strength * bump)
      };
    };
    var resolvePendoloLitOpacity = (opacity, light) => light > 0 ? opacity + (1 - opacity) * light * Math.min(1, opacity * 4) : opacity;
    var resolvePendoloShake = (state, random) => {
      if (state.shake < 0.01) return { x: 0, y: 0 };
      const amount = SHAKE_PX * state.shake;
      return { x: (random() - 0.5) * 2 * amount, y: (random() - 0.5) * 2 * amount };
    };
    var isPendoloBeatFxIdle = (state, now) => {
      if (state.jewelFlare > 0.01 || state.smallJewelFlare > 0.01 || state.shake > 0.01) return false;
      if (state.tickDialLight > 0 || state.outerDialLight > 0) return false;
      if (state.waveStart >= 0) return false;
      for (let at = 4; at < state.sparks.length; at += PENDOLO_SPARK_STRIDE) if (state.sparks[at] > 0) return false;
      return true;
    };
    var GOLD = [243, 196, 107];
    var toHsl = (r, g, b) => {
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const l = (max + min) / 2;
      if (max === min) return [0, 0, l];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
      return [h / 6, s, l];
    };
    var fromHsl = (h, s, l) => {
      if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const channel = (t0) => {
        const t = (t0 % 1 + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255));
    };
    var resolvePendoloBeatFxColor = (accent) => {
      const channels = parseColorChannels(accent);
      if (!channels) return GOLD;
      const [h, s, l] = toHsl(channels.r, channels.g, channels.b);
      if (s < 0.12) return GOLD;
      return fromHsl(h, Math.max(s, 0.6), Math.max(l, 0.7));
    };
    var heatPendoloBeatFxColor = (color, heat) => [
      Math.round(color[0] + (255 - color[0]) * heat),
      Math.round(color[1] + (255 - color[1]) * heat),
      Math.round(color[2] + (255 - color[2]) * heat)
    ];
  
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
    var smartBeatActive = (settings) => settings !== null && settings !== void 0 && settings.mode !== "off";
  
    // src/render/folia/components/visualizer/pendolo/pendoloParallax.ts
    var DIAL_FACE = 0;
    var MAIN_SUN_TOP = 0.09;
    var SECOND_TOP = 0.1;
    var TRANS_TOP = 0.14;
    var PENDOLO_BALANCE_TOP = 0.2;
    var PART_HEIGHTS = [
      ["main-static", DIAL_FACE],
      // 各齿轮中心的环和宝石都和那根轴上最上面一层齿轮同高：高低不一时倾斜下各自往不同方向挪，
      // 看着不在齿轮正中。同高也不会被齿轮自己的面挡住（遮挡面那一遍往下压了一点）
      ["main-jewel", MAIN_SUN_TOP],
      ["main-ticks", 0.02],
      ["main-esc", 0.05],
      ["main-sun", MAIN_SUN_TOP],
      ["idler", 0.08],
      ["second-spin", SECOND_TOP],
      ["second-spoke", SECOND_TOP],
      ["second-jewel", SECOND_TOP],
      ["planet-", 0.11],
      ["trans-spin", TRANS_TOP],
      ["trans-jewel", TRANS_TOP],
      // 游丝和摆轮上的图标也和摆轮顶面同高
      ["balance-static", PENDOLO_BALANCE_TOP],
      ["balance-gear", PENDOLO_BALANCE_TOP],
      ["hairspring", PENDOLO_BALANCE_TOP],
      // 刻度针（焦点轴）指着焦点句，和歌词在同一层，略高于主轮，倾斜时一起浮起来
      ["axis", 0.1]
    ];
    var PENDOLO_LYRIC_LAYER_HEIGHT = 0.1;
    var PENDOLO_BALANCE_ICON_HEIGHT = PENDOLO_BALANCE_TOP;
    var PENDOLO_BEAT_OVERLAY_HEIGHT = 0.02;
    var PENDOLO_GEAR_THICKNESS = 0.025;
    var PENDOLO_PART_BASE_SUFFIX = "#base";
    var resolvePendoloPartHeight = (partKey) => {
      if (partKey.endsWith(PENDOLO_PART_BASE_SUFFIX)) {
        const top = resolvePendoloPartHeight(partKey.slice(0, -PENDOLO_PART_BASE_SUFFIX.length));
        return Math.max(0, top - PENDOLO_GEAR_THICKNESS);
      }
      for (const [prefix, height] of PART_HEIGHTS) {
        if (partKey.startsWith(prefix)) return height;
      }
      return DIAL_FACE;
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloBeatFxDraw.ts
    var TICK_COUNT = 60;
    var DIAL_SEGMENTS = 120;
    var DIAL_GLOW_WIDTH = 10;
    var resolveJewels = (input) => {
      const anchors = resolvePendoloClockworkAnchors(input);
      const jewels = [
        { x: input.centerX, y: input.centerY, small: false, height: resolvePendoloPartHeight("main-jewel") },
        { x: anchors.balanceCx, y: anchors.balanceCy, small: false, height: resolvePendoloPartHeight("balance-static") },
        { x: anchors.transCx, y: anchors.transCy, small: true, height: resolvePendoloPartHeight("trans-jewel") },
        { x: anchors.secondGearCx, y: anchors.secondGearCy, small: true, height: resolvePendoloPartHeight("second-jewel") },
        { x: anchors.idlerCx, y: anchors.idlerCy, small: true, height: resolvePendoloPartHeight("idler-static") }
      ];
      for (let index = 0; index < 3; index += 1) {
        const angle = input.escapementAngle * 0.4 + index * Math.PI * 2 / 3;
        jewels.push({
          x: input.centerX + anchors.orbitR * Math.cos(angle),
          y: input.centerY + anchors.orbitR * Math.sin(angle),
          small: true,
          height: resolvePendoloPartHeight(`planet-${index}-jewel`)
        });
      }
      return jewels;
    };
    var resolvePendoloMeshPoints = (layout) => {
      const anchors = resolvePendoloClockworkAnchors(layout);
      const between = (ax, ay, bx, by) => ({
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
        tx: -(by - ay),
        ty: bx - ax
      });
      const towardTransX = anchors.transCx - layout.centerX;
      const towardTransY = anchors.transCy - layout.centerY;
      const length = Math.hypot(towardTransX, towardTransY) || 1;
      return [
        between(anchors.transCx, anchors.transCy, anchors.idlerCx, anchors.idlerCy),
        between(anchors.idlerCx, anchors.idlerCy, anchors.secondGearCx, anchors.secondGearCy),
        // The main wheel's rim where it drives the transmission gear.
        {
          x: layout.centerX + towardTransX / length * layout.baseRadius,
          y: layout.centerY + towardTransY / length * layout.baseRadius,
          tx: -towardTransY,
          ty: towardTransX
        }
      ];
    };
    var flareRadius = (flare, small) => (small ? 26 : 40) * (0.6 + Math.min(1.5, flare));
    var sparkAlpha = (life) => Math.min(1, Math.max(0, life / 0.3));
    var SPARK_TRAIL = 0.045;
    var SPARK_HEAD = 0.012;
    var SPARK_WIDTH = 2.2;
    var SPARK_HEAD_WIDTH = 2.6;
    var hasOverlay = (fx) => {
      if (fx.jewelFlare > 0.01 || fx.smallJewelFlare > 0.01) return true;
      if (fx.tickDialLight > 0 || fx.outerDialLight > 0) return true;
      for (let at = 4; at < fx.sparks.length; at += PENDOLO_SPARK_STRIDE) if (fx.sparks[at] > 0) return true;
      return false;
    };
    var PENDOLO_OVERLAY_STRIDE = 9;
    var PENDOLO_OVERLAY_MAX_VERTICES = (TICK_COUNT + DIAL_SEGMENTS * 4 + 8 + PENDOLO_MAX_SPARKS * 2) * 6;
    var pushQuad = (out, at, corners, color, alpha, radial, height = PENDOLO_BEAT_OVERLAY_HEIGHT) => {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = corners;
      const r = color[0] / 255 * alpha;
      const g = color[1] / 255 * alpha;
      const b = color[2] / 255 * alpha;
      const verts = [
        [x0, y0, -1, -1],
        [x1, y1, 1, -1],
        [x2, y2, -1, 1],
        [x2, y2, -1, 1],
        [x1, y1, 1, -1],
        [x3, y3, 1, 1]
      ];
      let offset = at * PENDOLO_OVERLAY_STRIDE;
      for (const [x, y, u, v] of verts) {
        out[offset] = x;
        out[offset + 1] = y;
        out[offset + 2] = r;
        out[offset + 3] = g;
        out[offset + 4] = b;
        out[offset + 5] = alpha;
        out[offset + 6] = radial ? u : -2;
        out[offset + 7] = radial ? v : -2;
        out[offset + 8] = height;
        offset += PENDOLO_OVERLAY_STRIDE;
      }
      return at + 6;
    };
    var pushSegment = (out, at, ax, ay, bx, by, width, color, alpha, height = PENDOLO_BEAT_OVERLAY_HEIGHT) => {
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / length * width * 0.5;
      const ny = (bx - ax) / length * width * 0.5;
      return pushQuad(out, at, [ax + nx, ay + ny, bx + nx, by + ny, ax - nx, ay - ny, bx - nx, by - ny], color, alpha, false, height);
    };
    var pushLitRing = (out, at, centerX, centerY, dialR, light, color) => {
      const height = 0;
      const hot = heatPendoloBeatFxColor(color, 0.3 * light);
      for (let index = 0; index < DIAL_SEGMENTS; index += 1) {
        const a0 = index * Math.PI * 2 / DIAL_SEGMENTS;
        const a1 = (index + 1) * Math.PI * 2 / DIAL_SEGMENTS;
        const x0 = centerX + dialR * Math.cos(a0);
        const y0 = centerY + dialR * Math.sin(a0);
        const x1 = centerX + dialR * Math.cos(a1);
        const y1 = centerY + dialR * Math.sin(a1);
        at = pushSegment(out, at, x0, y0, x1, y1, DIAL_GLOW_WIDTH, color, 0.22 * light, height);
        at = pushSegment(out, at, x0, y0, x1, y1, 1.5 + 1.5 * light, hot, light, height);
      }
      return at;
    };
    var buildPendoloBeatFxOverlay = (out, input, fx) => {
      if (!hasOverlay(fx)) return 0;
      let at = 0;
      const { centerX, centerY, baseRadius, escapementAngle } = input;
      if (fx.tickDialLight > 0) {
        const outerTickR = baseRadius * PENDOLO_TICK_DIAL;
        const light = fx.tickDialLight;
        for (let index = 0; index < TICK_COUNT; index += 1) {
          const angle = index * Math.PI * 2 / TICK_COUNT + escapementAngle * 0.2;
          const tickLen = index % 5 === 0 ? 12 : 6;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          at = pushSegment(
            out,
            at,
            centerX + outerTickR * cos,
            centerY + outerTickR * sin,
            centerX + (outerTickR + tickLen) * cos,
            centerY + (outerTickR + tickLen) * sin,
            1.5 + 2.5 * light,
            heatPendoloBeatFxColor(fx.color, 0.25 * light),
            0.35 + 0.65 * light
          );
        }
      }
      if (fx.tickDialLight > 0) at = pushLitRing(out, at, centerX, centerY, baseRadius * PENDOLO_TICK_DIAL, fx.tickDialLight, fx.color);
      if (fx.outerDialLight > 0) at = pushLitRing(out, at, centerX, centerY, baseRadius * PENDOLO_OUTER_DIAL, fx.outerDialLight, fx.color);
      if (fx.jewelFlare > 0.01 || fx.smallJewelFlare > 0.01) {
        const hot = heatPendoloBeatFxColor(fx.color, 0.6);
        for (const jewel of resolveJewels(input)) {
          const flare = jewel.small ? Math.max(fx.jewelFlare, fx.smallJewelFlare) : fx.jewelFlare;
          if (flare <= 0.01) continue;
          const r = flareRadius(flare, jewel.small);
          at = pushQuad(out, at, [jewel.x - r, jewel.y - r, jewel.x + r, jewel.y - r, jewel.x - r, jewel.y + r, jewel.x + r, jewel.y + r], hot, Math.min(1, flare), true, jewel.height);
        }
      }
      const tail = fx.color;
      const head = heatPendoloBeatFxColor(fx.color, 0.8);
      for (let p = 0; p < fx.sparks.length; p += PENDOLO_SPARK_STRIDE) {
        const life = fx.sparks[p + 4];
        if (life <= 0) continue;
        const x = fx.sparks[p] - fx.offsetX;
        const y = fx.sparks[p + 1] - fx.offsetY;
        const vx = fx.sparks[p + 2];
        const vy = fx.sparks[p + 3];
        const alpha = sparkAlpha(life);
        at = pushSegment(out, at, x, y, x - vx * SPARK_TRAIL, y - vy * SPARK_TRAIL, SPARK_WIDTH, tail, alpha);
        at = pushSegment(out, at, x, y, x - vx * SPARK_HEAD, y - vy * SPARK_HEAD, SPARK_HEAD_WIDTH, head, alpha);
      }
      return at;
    };
    var resolvePendoloWaveUniform = (wave) => wave ? [wave.radius, wave.band, PENDOLO_WAVE_PUSH * wave.strength, PENDOLO_WAVE_LIGHT * wave.strength] : [0, 0, 0, 0];
    var rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
    var WAVE_SLICES = 14;
    var drawPendoloWaveLens2d = (ctx, canvas, scratch, input, wave, color, cssWidth, cssHeight) => {
      if (scratch.width !== canvas.width || scratch.height !== canvas.height) {
        scratch.width = canvas.width;
        scratch.height = canvas.height;
      }
      const scratchCtx = scratch.getContext("2d");
      if (!scratchCtx) return;
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
      scratchCtx.drawImage(canvas, 0, 0);
      const cx = input.centerX + wave.x;
      const cy = input.centerY + wave.y;
      for (let index = 0; index < WAVE_SLICES; index += 1) {
        const u0 = index / WAVE_SLICES;
        const u1 = (index + 1) / WAVE_SLICES;
        const r0 = Math.max(0, wave.radius - wave.band + wave.band * u0);
        const r1 = wave.radius - wave.band + wave.band * u1;
        if (r1 <= 0) continue;
        const bump = resolvePendoloWaveBump(wave, (r0 + r1) / 2);
        if (bump <= 0) continue;
        const scale = 1 + PENDOLO_WAVE_PUSH * wave.strength * bump;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, Math.PI * 2);
        ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
        ctx.clip("evenodd");
        ctx.translate(cx * (1 - scale), cy * (1 - scale));
        ctx.scale(scale, scale);
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.drawImage(scratch, 0, 0, cssWidth, cssHeight);
        const light = PENDOLO_WAVE_LIGHT * wave.strength * bump;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, light);
        ctx.drawImage(scratch, 0, 0, cssWidth, cssHeight);
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = Math.min(1, PENDOLO_WAVE_TINT * light);
        ctx.fillStyle = rgba(color, 1);
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.restore();
      }
    };
    var drawPendoloBeatFxOverlay2d = (ctx, input, fx) => {
      if (!hasOverlay(fx)) return;
      const { centerX, centerY, baseRadius, escapementAngle } = input;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "butt";
      if (fx.tickDialLight > 0) {
        const outerTickR = baseRadius * PENDOLO_TICK_DIAL;
        const light = fx.tickDialLight;
        for (let index = 0; index < TICK_COUNT; index += 1) {
          const angle = index * Math.PI * 2 / TICK_COUNT + escapementAngle * 0.2;
          const tickLen = index % 5 === 0 ? 12 : 6;
          ctx.strokeStyle = rgba(heatPendoloBeatFxColor(fx.color, 0.25 * light), 0.35 + 0.65 * light);
          ctx.lineWidth = 1.5 + 2.5 * light;
          ctx.beginPath();
          ctx.moveTo(centerX + outerTickR * Math.cos(angle), centerY + outerTickR * Math.sin(angle));
          ctx.lineTo(centerX + (outerTickR + tickLen) * Math.cos(angle), centerY + (outerTickR + tickLen) * Math.sin(angle));
          ctx.stroke();
        }
      }
      const strokeLitRing = (dialR, light) => {
        ctx.strokeStyle = rgba(fx.color, 0.22 * light);
        ctx.lineWidth = DIAL_GLOW_WIDTH;
        ctx.beginPath();
        ctx.arc(centerX, centerY, dialR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgba(heatPendoloBeatFxColor(fx.color, 0.3 * light), light);
        ctx.lineWidth = 1.5 + 1.5 * light;
        ctx.beginPath();
        ctx.arc(centerX, centerY, dialR, 0, Math.PI * 2);
        ctx.stroke();
      };
      if (fx.tickDialLight > 0) strokeLitRing(baseRadius * PENDOLO_TICK_DIAL, fx.tickDialLight);
      if (fx.outerDialLight > 0) strokeLitRing(baseRadius * PENDOLO_OUTER_DIAL, fx.outerDialLight);
      if (fx.jewelFlare > 0.01 || fx.smallJewelFlare > 0.01) {
        const hot = heatPendoloBeatFxColor(fx.color, 0.6);
        for (const jewel of resolveJewels(input)) {
          const flare = jewel.small ? Math.max(fx.jewelFlare, fx.smallJewelFlare) : fx.jewelFlare;
          if (flare <= 0.01) continue;
          const r = flareRadius(flare, jewel.small);
          const gradient = ctx.createRadialGradient(jewel.x, jewel.y, 0, jewel.x, jewel.y, r);
          gradient.addColorStop(0, rgba(hot, Math.min(1, flare)));
          gradient.addColorStop(0.5, rgba(hot, Math.min(1, flare) * 0.25));
          gradient.addColorStop(1, rgba(hot, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(jewel.x, jewel.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const head = heatPendoloBeatFxColor(fx.color, 0.8);
      for (let p = 0; p < fx.sparks.length; p += PENDOLO_SPARK_STRIDE) {
        const life = fx.sparks[p + 4];
        if (life <= 0) continue;
        const x = fx.sparks[p] - fx.offsetX;
        const y = fx.sparks[p + 1] - fx.offsetY;
        const vx = fx.sparks[p + 2];
        const vy = fx.sparks[p + 3];
        const alpha = sparkAlpha(life);
        ctx.strokeStyle = rgba(fx.color, alpha);
        ctx.lineWidth = SPARK_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - vx * SPARK_TRAIL, y - vy * SPARK_TRAIL);
        ctx.stroke();
        ctx.strokeStyle = rgba(head, alpha);
        ctx.lineWidth = SPARK_HEAD_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - vx * SPARK_HEAD, y - vy * SPARK_HEAD);
        ctx.stroke();
      }
      ctx.restore();
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloClockworkMotion.ts
    var createPendoloClockworkMotionState = () => ({
      phase: 0,
      smoothedBass: 0.15,
      secondGearElapsed: 0,
      secondGearStep: 0,
      secondGearAngle: 0,
      secondGearVelocity: 0,
      balanceDirection: 1,
      balanceAmplitude: 0,
      balanceAngle: 0,
      balanceVelocity: 0,
      transBeatTarget: 0,
      transBeatAngle: 0,
      transBeatVelocity: 0
    });
    var TRANS_TEETH = 24;
    var SECOND_TEETH = 15;
    var BEAT_GEAR_STIFFNESS = 260;
    var BEAT_GEAR_DAMPING = 19;
    var SWING_BASE = 0.25;
    var SWING_GAIN = 0.6;
    var SWING_STIFFNESS = 140;
    var SWING_DAMPING = 9;
    var normalizePendoloBass = (value) => {
      const norm = value > 1 ? value / 255 : value;
      return Math.max(0, Math.min(1, norm));
    };
    var stepPendoloClockworkMotion = (state, dt, rawBass, paused, profile, beat) => {
      const clampedBass = normalizePendoloBass(rawBass);
      state.smoothedBass += (clampedBass - state.smoothedBass) * Math.min(0.24, 0.12 * profile.bassResponseMultiplier);
      const bass = state.smoothedBass;
      if (!paused) {
        state.phase += dt * (2.8 + bass * 3.5 * profile.bassResponseMultiplier) * profile.balanceSpeedMultiplier;
        if (beat) {
          if (beat.downbeats > 0) {
            state.transBeatTarget += Math.PI * 2;
            state.secondGearStep -= SECOND_TEETH;
          } else if (beat.beats > 0) {
            state.transBeatTarget += Math.PI * 2 / TRANS_TEETH;
            state.secondGearStep -= 1;
          }
          const secondTarget = state.secondGearStep * (Math.PI * 2 / SECOND_TEETH);
          const damping = Math.exp(-BEAT_GEAR_DAMPING * dt);
          state.secondGearVelocity += (secondTarget - state.secondGearAngle) * BEAT_GEAR_STIFFNESS * dt;
          state.secondGearVelocity *= damping;
          state.secondGearAngle += state.secondGearVelocity * dt;
          state.transBeatVelocity += (state.transBeatTarget - state.transBeatAngle) * BEAT_GEAR_STIFFNESS * dt;
          state.transBeatVelocity *= damping;
          state.transBeatAngle += state.transBeatVelocity * dt;
          if (beat.beats > 0 || beat.downbeats > 0) {
            state.balanceDirection = -state.balanceDirection;
            const gain = beat.downbeats > 0 ? beat.downbeatGain : beat.beatGain;
            state.balanceAmplitude = (SWING_BASE + SWING_GAIN * Math.min(1, gain)) * profile.balanceAmplitudeMultiplier;
          }
          const target = state.balanceDirection * state.balanceAmplitude;
          state.balanceVelocity += (target - state.balanceAngle) * SWING_STIFFNESS * dt;
          state.balanceVelocity *= Math.exp(-SWING_DAMPING * dt);
          state.balanceAngle += state.balanceVelocity * dt;
        } else {
          state.secondGearElapsed += dt;
          const completedSteps = Math.floor(state.secondGearElapsed);
          if (completedSteps > 0) {
            state.secondGearStep += completedSteps;
            state.secondGearElapsed -= completedSteps;
          }
          const secondGearTarget = state.secondGearStep * (Math.PI * 2 / 15);
          const displacement = secondGearTarget - state.secondGearAngle;
          state.secondGearVelocity += displacement * 92 * profile.escapementSpringMultiplier * dt;
          state.secondGearVelocity *= Math.exp(-13 * profile.escapementDampingMultiplier * dt);
          state.secondGearAngle += state.secondGearVelocity * dt;
        }
      }
      const bassOscillation = beat ? state.balanceAngle : Math.sin(state.phase) * (0.15 + bass * 0.7 * profile.bassResponseMultiplier) * profile.balanceAmplitudeMultiplier;
      return {
        bass,
        bassOscillation,
        secondGearAngle: state.secondGearAngle,
        transBeatAngle: beat ? state.transBeatAngle : 0,
        phase: state.phase
      };
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloClockworkMeshes.ts
    var PENDOLO_MESH_STRIDE = 7;
    var PENDOLO_MAX_PARTS = 44;
    var PENDOLO_MITER_LIMIT = 10;
    var PendoloMeshBuilder = class {
      data = [];
      activePartId = 0;
      /** 当前在画的部件的 key（pushPart 设）。 */
      activePartKey = "";
      /** 不为 null 时，appendGearLocal 把画过的齿形记在这里（分层视差开着时）。 */
      gearOutlines = null;
      /** 不为 null 时记下齿轮的面（齿形）和面上的洞，分层视差时算遮挡用。 */
      faceOutlines = null;
      faceHoles = null;
      get vertexCount() {
        return this.data.length / PENDOLO_MESH_STRIDE;
      }
      toFloat32() {
        return new Float32Array(this.data);
      }
      setActivePartId(partId) {
        this.activePartId = partId;
      }
      pushVert(x, y, r, g, b, a) {
        this.data.push(x, y, r, g, b, a, this.activePartId);
      }
      pushTri(ax, ay, bx, by, cx, cy, r, g, b, a) {
        this.pushVert(ax, ay, r, g, b, a);
        this.pushVert(bx, by, r, g, b, a);
        this.pushVert(cx, cy, r, g, b, a);
      }
      appendLine(x0, y0, x1, y1, width, rgba2, extend = 0) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return;
        const ux = dx / len;
        const uy = dy / len;
        const hw = width * 0.5;
        const nx = -uy * hw;
        const ny = ux * hw;
        const ax = x0 - ux * extend;
        const ay = y0 - uy * extend;
        const bx = x1 + ux * extend;
        const by = y1 + uy * extend;
        const [r, g, b, a] = rgba2;
        this.pushTri(ax + nx, ay + ny, ax - nx, ay - ny, bx + nx, by + ny, r, g, b, a);
        this.pushTri(ax - nx, ay - ny, bx - nx, by - ny, bx + nx, by + ny, r, g, b, a);
      }
      /**
       * Strokes a polyline the way Canvas2D does by default: miter joins (falling back to a bevel
       * past a miter limit of 10) and butt caps. Neighbouring segments share their join vertices, so
       * a translucent stroke covers every pixel once; overlapping the segments instead blends the
       * joints twice and they show up as brighter dots.
       */
      appendPolyline(points, width, rgba2, closed = false) {
        const pts = points.filter((point, index) => {
          const previous = index > 0 ? points[index - 1] : null;
          return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-6;
        });
        if (closed && pts.length > 2) {
          const first = pts[0];
          const last = pts[pts.length - 1];
          if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-6) pts.pop();
        }
        const n = pts.length;
        if (n < 2) return;
        const hw = width * 0.5;
        const segmentCount = closed ? n : n - 1;
        const normals = [];
        for (let i = 0; i < segmentCount; i++) {
          const a2 = pts[i];
          const b2 = pts[(i + 1) % n];
          const len = Math.hypot(b2.x - a2.x, b2.y - a2.y);
          normals.push({ x: -(b2.y - a2.y) / len, y: (b2.x - a2.x) / len });
        }
        const starts = [];
        const ends = [];
        const bevels = [];
        for (let i = 0; i < segmentCount; i++) {
          starts.push({ x: normals[i].x * hw, y: normals[i].y * hw });
          ends.push({ x: normals[i].x * hw, y: normals[i].y * hw });
        }
        const joinCount = closed ? n : n - 2;
        for (let j = 0; j < joinCount; j++) {
          const incoming = closed ? (j + segmentCount - 1) % segmentCount : j;
          const outgoing = closed ? j : j + 1;
          const vertex = pts[closed ? j : j + 1];
          const n1 = normals[incoming];
          const n2 = normals[outgoing];
          const mx = n1.x + n2.x;
          const my = n1.y + n2.y;
          const mLen = Math.hypot(mx, my);
          const cosHalf = mLen / 2;
          if (mLen > 1e-6 && 1 / cosHalf <= PENDOLO_MITER_LIMIT) {
            const scale = hw / cosHalf / mLen;
            const miter = { x: mx * scale, y: my * scale };
            ends[incoming] = miter;
            starts[outgoing] = miter;
          } else {
            const turn = n1.x * n2.y - n1.y * n2.x;
            const side = turn > 0 ? -1 : 1;
            bevels.push({
              point: vertex,
              from: { x: n1.x * hw * side, y: n1.y * hw * side },
              to: { x: n2.x * hw * side, y: n2.y * hw * side }
            });
          }
        }
        const [r, g, b, a] = rgba2;
        for (let i = 0; i < segmentCount; i++) {
          const p0 = pts[i];
          const p1 = pts[(i + 1) % n];
          const s0 = starts[i];
          const e0 = ends[i];
          this.pushTri(p0.x + s0.x, p0.y + s0.y, p0.x - s0.x, p0.y - s0.y, p1.x + e0.x, p1.y + e0.y, r, g, b, a);
          this.pushTri(p0.x - s0.x, p0.y - s0.y, p1.x - e0.x, p1.y - e0.y, p1.x + e0.x, p1.y + e0.y, r, g, b, a);
        }
        for (const bevel of bevels) {
          const { point, from, to } = bevel;
          this.pushTri(point.x, point.y, point.x + from.x, point.y + from.y, point.x + to.x, point.y + to.y, r, g, b, a);
        }
      }
      appendCircleStroke(cx, cy, radius, width, rgba2, segments = 64) {
        if (radius <= 0 || width <= 0) return;
        const hw = width * 0.5;
        const inner = Math.max(0, radius - hw);
        const outer = radius + hw;
        const segs = Math.max(segments, Math.ceil(radius * 1.25));
        const [r, g, b, a] = rgba2;
        for (let i = 0; i < segs; i++) {
          const a0 = i * Math.PI * 2 / segs;
          const a1 = (i + 1) * Math.PI * 2 / segs;
          const c0 = Math.cos(a0);
          const s0 = Math.sin(a0);
          const c1 = Math.cos(a1);
          const s1 = Math.sin(a1);
          this.pushTri(
            cx + outer * c0,
            cy + outer * s0,
            cx + inner * c0,
            cy + inner * s0,
            cx + outer * c1,
            cy + outer * s1,
            r,
            g,
            b,
            a
          );
          this.pushTri(
            cx + inner * c0,
            cy + inner * s0,
            cx + inner * c1,
            cy + inner * s1,
            cx + outer * c1,
            cy + outer * s1,
            r,
            g,
            b,
            a
          );
        }
      }
      appendFilledPolygonFromCenter(cx, cy, points, rgba2) {
        if (points.length < 3) return;
        const [r, g, b, a] = rgba2;
        for (let i = 0; i < points.length; i++) {
          const p0 = points[i];
          const p1 = points[(i + 1) % points.length];
          this.pushTri(cx, cy, p0.x, p0.y, p1.x, p1.y, r, g, b, a);
        }
      }
      /**
       * 分层视差的齿轮侧壁：沿齿形每一段立一块四边形，上沿顶点属于 `topPartId`（齿轮本身），下沿属于
       * `bottomPartId`（它的低处线），原点、转角相同、高度不同，投影后连成齿轮的侧面。被齿轮自己顶面
       * 挡住的那一半靠深度测试剔掉，只露出朝外的一侧。
       */
      appendWall(points, topPartId, bottomPartId, rgba2) {
        const [r, g, b, a] = rgba2;
        const vert = (p, partId) => {
          this.data.push(p.x, p.y, r, g, b, a, partId);
        };
        for (let i = 0; i < points.length; i++) {
          const p0 = points[i];
          const p1 = points[(i + 1) % points.length];
          vert(p0, topPartId);
          vert(p0, bottomPartId);
          vert(p1, topPartId);
          vert(p1, topPartId);
          vert(p0, bottomPartId);
          vert(p1, bottomPartId);
        }
      }
      appendArrowHead(tipX, tipY, rgba2) {
        const [r, g, b, a] = rgba2;
        this.pushTri(tipX, tipY - 4, tipX + 8, tipY, tipX, tipY + 4, r, g, b, a);
      }
    };
    var parseRgba = (color) => {
      const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
      );
      if (rgbaMatch) {
        return [
          Number(rgbaMatch[1]) / 255,
          Number(rgbaMatch[2]) / 255,
          Number(rgbaMatch[3]) / 255,
          rgbaMatch[4] === void 0 ? 1 : Number(rgbaMatch[4])
        ];
      }
      const ch = parseColorChannels(color);
      if (!ch) return [1, 1, 1, 1];
      return [ch.r / 255, ch.g / 255, ch.b / 255, 1];
    };
    var buildPendoloClockworkCacheKey = (input) => [
      // Exact, not rounded: the mesh bakes the centre in, so any move must rebuild it.
      input.centerX,
      input.centerY,
      Math.round(input.baseRadius * 10),
      Math.round(input.lyricRingRadius * 10),
      input.showGearDecor,
      input.primaryTextColor,
      input.accentTextColor,
      // 视差开着时多出齿轮的低处线和侧壁
      input.parallaxScalePx ? "parallax" : ""
    ].join("|");
    var gearTeethPointsLocal = (radius, teethCount, toothDepth) => {
      const innerR = radius - toothDepth;
      const outerR = radius;
      const anglePerTooth = Math.PI * 2 / teethCount;
      const pts = [];
      for (let i = 0; i < teethCount; i++) {
        const baseAngle = i * anglePerTooth;
        const angles = [
          baseAngle - anglePerTooth * 0.22,
          baseAngle - anglePerTooth * 0.12,
          baseAngle + anglePerTooth * 0.12,
          baseAngle + anglePerTooth * 0.22
        ];
        const radii = [innerR, outerR, outerR, innerR];
        for (let k = 0; k < 4; k++) {
          pts.push({
            x: radii[k] * Math.cos(angles[k]),
            y: radii[k] * Math.sin(angles[k])
          });
        }
      }
      return pts;
    };
    var appendGearLocal = (mesh, radius, teethCount, toothDepth, stroke, lineWidth, fill) => {
      const pts = gearTeethPointsLocal(radius, teethCount, toothDepth);
      if (fill) mesh.appendFilledPolygonFromCenter(0, 0, pts, parseRgba(fill));
      mesh.appendPolyline(pts, lineWidth, parseRgba(stroke), true);
      mesh.gearOutlines?.push({ partKey: mesh.activePartKey, kind: "polyline", pts, lineWidth, rgba: parseRgba(stroke) });
      mesh.faceOutlines?.push({ partKey: mesh.activePartKey, pts, filled: Boolean(fill) });
    };
    var appendSpokedWheelLocal = (mesh, hubR, rimR, spokeCount, stroke, lineWidth) => {
      const rgba2 = parseRgba(stroke);
      const circle = (cx, cy, radius, segments = 64) => {
        mesh.appendCircleStroke(cx, cy, radius, lineWidth, rgba2, segments);
        mesh.gearOutlines?.push({ partKey: mesh.activePartKey, kind: "circle", cx, cy, radius, segments, lineWidth, rgba: rgba2 });
      };
      circle(0, 0, hubR);
      circle(0, 0, rimR);
      const angleStep = Math.PI * 2 / spokeCount;
      for (let i = 0; i < spokeCount; i++) {
        const a = i * angleStep;
        mesh.appendLine(
          hubR * Math.cos(a),
          hubR * Math.sin(a),
          rimR * Math.cos(a),
          rimR * Math.sin(a),
          lineWidth,
          rgba2
        );
      }
      const midR = (hubR + rimR) * 0.5;
      const holeR = (rimR - hubR) * 0.22;
      for (let i = 0; i < spokeCount; i++) {
        const a = i * angleStep + angleStep * 0.5;
        circle(midR * Math.cos(a), midR * Math.sin(a), holeR, 24);
        mesh.faceHoles?.push({ partKey: mesh.activePartKey, cx: midR * Math.cos(a), cy: midR * Math.sin(a), radius: holeR });
      }
    };
    var appendHairspringLocal = (mesh, startR, endR, coils, stroke, lineWidth) => {
      const totalAngle = coils * Math.PI * 2;
      const steps = Math.round(coils * 60);
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * totalAngle;
        const r = startR + (endR - startR) * Math.pow(t, 0.9);
        pts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
      }
      mesh.appendPolyline(pts, lineWidth, parseRgba(stroke), false);
    };
    var appendJewelLocal = (mesh, outerR, innerR, strokeOuter, strokeInner, outerWidth, innerWidth) => {
      mesh.appendCircleStroke(0, 0, outerR, outerWidth, parseRgba(strokeOuter), 28);
      mesh.appendCircleStroke(0, 0, innerR, innerWidth, parseRgba(strokeInner), 20);
    };
    var fixedOrigin = (x, y) => () => ({ x, y });
    var fixedRotation = (angle) => () => angle;
    var buildPendoloClockworkCachedScene = (input) => {
      const key = buildPendoloClockworkCacheKey(input);
      const mesh = new PendoloMeshBuilder();
      const parts = [];
      const partKeys = /* @__PURE__ */ new Map();
      if (input.showGearDecor === "none") {
        return { key, data: mesh.toFloat32(), parts, vertexCount: 0 };
      }
      const { centerX, centerY, baseRadius, primaryTextColor, accentTextColor, showGearDecor } = input;
      const anchors = resolvePendoloClockworkAnchors(input);
      const palette = buildPendoloClockworkPalette(primaryTextColor, accentTextColor, showGearDecor);
      const m = palette.decorOpacityMultiplier;
      const mainOrigin = fixedOrigin(centerX, centerY);
      const pushPart = (transformKey, build2, getOrigin, getRotation) => {
        let partId = partKeys.get(transformKey);
        if (partId === void 0) {
          if (parts.length >= PENDOLO_MAX_PARTS) {
            console.warn("[pendoloClockworkMeshes] exceeded PENDOLO_MAX_PARTS");
            return;
          }
          partId = parts.length;
          partKeys.set(transformKey, partId);
          parts.push({ getOrigin, getRotation, height: resolvePendoloPartHeight(transformKey) });
        }
        mesh.setActivePartId(partId);
        mesh.activePartKey = transformKey;
        build2();
      };
      const parallax = Boolean(input.parallaxScalePx);
      if (parallax) {
        mesh.gearOutlines = [];
        mesh.faceOutlines = [];
        mesh.faceHoles = [];
      }
      pushPart("main-static", () => {
        const ringRgba = parseRgba(palette.primaryAlpha15);
        for (const r of [0.3, 0.6, 0.85, 1.15, 1.4].map((f) => baseRadius * f)) {
          mesh.appendCircleStroke(0, 0, r, 1, ringRgba);
        }
        const bevel = parseRgba(palette.bevelRing);
        mesh.appendCircleStroke(0, 0, baseRadius * 0.88, 0.8, bevel);
        mesh.appendCircleStroke(0, 0, baseRadius * 0.92, 0.8, bevel);
      }, mainOrigin, fixedRotation(0));
      pushPart("main-jewel", () => {
        appendJewelLocal(mesh, 4.5, 2.5, palette.jewelStrokeColor, palette.jewelFillColor, 1.2, 0.8);
      }, mainOrigin, fixedRotation(0));
      pushPart("main-ticks", () => {
        const outerTickR = baseRadius * 1.15;
        for (let i = 0; i < 60; i++) {
          const angle = i * Math.PI * 2 / 60;
          const isMajor = i % 5 === 0;
          const tickLen = isMajor ? 12 : 6;
          mesh.appendLine(
            outerTickR * Math.cos(angle),
            outerTickR * Math.sin(angle),
            (outerTickR + tickLen) * Math.cos(angle),
            (outerTickR + tickLen) * Math.sin(angle),
            isMajor ? 1.5 : 1,
            parseRgba(isMajor ? palette.accentAlpha35 : palette.primaryAlpha15)
          );
        }
      }, mainOrigin, (motion2) => motion2.escapementAngle * 0.2);
      pushPart("main-esc", () => {
        appendGearLocal(mesh, baseRadius + 8, 36, 10, palette.gearAccentAlpha, 2.2, palette.mainGearFill);
        appendSpokedWheelLocal(mesh, baseRadius * 0.2, baseRadius * 0.85, 6, palette.gearPrimaryAlpha, 1.8);
        const guillocheInnerR = baseRadius * 0.62;
        const guillocheOuterR = baseRadius * 0.83;
        for (let i = 0; i < 48; i++) {
          const a = i * Math.PI * 2 / 48;
          const innerOffset = i % 2 === 0 ? guillocheInnerR : guillocheInnerR + (guillocheOuterR - guillocheInnerR) * 0.3;
          mesh.appendLine(
            innerOffset * Math.cos(a),
            innerOffset * Math.sin(a),
            guillocheOuterR * Math.cos(a),
            guillocheOuterR * Math.sin(a),
            0.7,
            parseRgba(i % 2 === 0 ? palette.primaryAlpha10 : palette.guillocheAlt)
          );
        }
        const rivetR = baseRadius * 0.96;
        const rivet = parseRgba(palette.rivetStroke);
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI * 2 / 12;
          mesh.appendCircleStroke(rivetR * Math.cos(a), rivetR * Math.sin(a), 2.2, 0.8, rivet, 16);
        }
      }, mainOrigin, (motion2) => motion2.escapementAngle);
      pushPart(
        "main-sun",
        () => appendGearLocal(mesh, baseRadius * 0.22, 12, 6, palette.gearAccentStrongAlpha, 2.1),
        mainOrigin,
        (motion2) => -motion2.escapementAngle * 2.5
      );
      for (let planetIdx = 0; planetIdx < 3; planetIdx++) {
        const idx = planetIdx;
        const planetOrigin = (motion2) => {
          const planetAngle = motion2.escapementAngle * 0.4 + idx * Math.PI * 2 / 3;
          return {
            x: centerX + anchors.orbitR * Math.cos(planetAngle),
            y: centerY + anchors.orbitR * Math.sin(planetAngle)
          };
        };
        pushPart(
          `planet-${idx}-gear`,
          () => appendGearLocal(mesh, anchors.planetR, 14, 5, palette.planetGearAlpha, 1.7),
          planetOrigin,
          (motion2) => -motion2.escapementAngle * 3 + idx * 0.5
        );
        pushPart(
          `planet-${idx}-jewel`,
          () => appendJewelLocal(mesh, 3.5, 1.8, palette.jewelStrokeColor, palette.jewelFillColor, 1, 0.7),
          planetOrigin,
          fixedRotation(0)
        );
      }
      const balanceOrigin = fixedOrigin(anchors.balanceCx, anchors.balanceCy);
      pushPart(
        "balance-gear",
        () => appendGearLocal(
          mesh,
          anchors.balanceR,
          20,
          7,
          palette.gearAccentStrongAlpha,
          2.1,
          palette.balanceGearFill
        ),
        balanceOrigin,
        (motion2) => motion2.phase * 0.1
      );
      pushPart("balance-static", () => {
        mesh.appendCircleStroke(0, 0, anchors.balanceR * 0.52, 1.8, parseRgba(palette.gearPrimarySubtleAlpha));
        appendJewelLocal(mesh, 3.5, 1.8, palette.jewelStrokeColor, palette.jewelFillColor, 1, 0.7);
      }, balanceOrigin, fixedRotation(0));
      pushPart(
        "hairspring",
        () => appendHairspringLocal(
          mesh,
          anchors.balanceR * 0.56,
          anchors.balanceR * 0.88,
          3.5,
          colorWithAlpha(accentTextColor, 0.3 * m),
          0.8
        ),
        balanceOrigin,
        (motion2) => motion2.bassOscillation * 0.6 + motion2.phase * 0.1 * 0.3
      );
      const transOrigin = fixedOrigin(anchors.transCx, anchors.transCy);
      pushPart("trans-spin", () => {
        appendGearLocal(mesh, anchors.transR, 24, 7, palette.gearPrimaryAlpha, 1.8);
        appendSpokedWheelLocal(
          mesh,
          anchors.transR * 0.25,
          anchors.transR * 0.85,
          5,
          palette.gearPrimarySubtleAlpha,
          1.5
        );
        const genevaSpan = anchors.transR * 1.6;
        const genevaStep = genevaSpan / 10;
        const clipR = anchors.transR * 0.8;
        for (let i = 1; i <= 9; i++) {
          const yOff = -genevaSpan * 0.5 + i * genevaStep;
          const halfChord = Math.sqrt(Math.max(0, clipR * clipR - yOff * yOff));
          if (halfChord < 0.5) continue;
          mesh.appendLine(
            -halfChord,
            yOff,
            halfChord,
            yOff,
            0.7,
            parseRgba(i % 2 === 0 ? palette.primaryAlpha10 : palette.genevaAlt)
          );
        }
      }, transOrigin, (motion2) => -motion2.escapementAngle * 1.4 + (motion2.transBeatAngle ?? 0));
      pushPart(
        "trans-jewel",
        () => appendJewelLocal(mesh, 3.5, 1.8, palette.jewelStrokeColor, palette.jewelFillColor, 1, 0.7),
        transOrigin,
        fixedRotation(0)
      );
      const secondOrigin = fixedOrigin(anchors.secondGearCx, anchors.secondGearCy);
      pushPart(
        "second-spin",
        () => appendGearLocal(
          mesh,
          anchors.secondGearR,
          15,
          5,
          palette.gearAccentAlpha,
          1.8,
          palette.secondGearFill
        ),
        secondOrigin,
        (motion2) => motion2.secondGearAngle
      );
      pushPart(
        "second-spoke",
        () => appendSpokedWheelLocal(
          mesh,
          anchors.secondGearR * 0.28,
          anchors.secondGearR * 0.76,
          4,
          palette.gearPrimarySubtleAlpha,
          1.3
        ),
        secondOrigin,
        (motion2) => -motion2.secondGearAngle
      );
      pushPart(
        "second-jewel",
        () => appendJewelLocal(mesh, 2.8, 1.5, palette.jewelStrokeColor, palette.jewelFillColor, 0.8, 0.6),
        secondOrigin,
        fixedRotation(0)
      );
      const idlerOrigin = fixedOrigin(anchors.idlerCx, anchors.idlerCy);
      pushPart(
        "idler-spin",
        () => appendGearLocal(mesh, anchors.idlerR, 10, 3.5, palette.idlerStroke, 1.3),
        idlerOrigin,
        (motion2) => motion2.escapementAngle * 2.2
      );
      pushPart("idler-static", () => {
        mesh.appendCircleStroke(0, 0, anchors.idlerR * 0.45, 0.8, parseRgba(palette.idlerInner));
        appendJewelLocal(mesh, 2.2, 1.2, palette.jewelStrokeColor, palette.jewelFillColor, 0.7, 0.5);
      }, idlerOrigin, fixedRotation(0));
      pushPart("axis", () => {
        const axis = parseRgba(palette.gearAccentStrongAlpha);
        mesh.appendLine(
          centerX + baseRadius * 0.8,
          centerY,
          centerX + anchors.focalAxisEndRadius,
          centerY,
          2,
          axis
        );
        mesh.appendArrowHead(centerX + anchors.focalAxisEndRadius, centerY, axis);
      }, fixedOrigin(0, 0), fixedRotation(0));
      if (!parallax || !mesh.gearOutlines?.length) {
        return {
          key,
          data: mesh.toFloat32(),
          parts,
          vertexCount: mesh.vertexCount
        };
      }
      const base = new PendoloMeshBuilder();
      const baseIds = /* @__PURE__ */ new Map();
      for (const outline of mesh.gearOutlines) {
        const sourceId = partKeys.get(outline.partKey);
        if (sourceId === void 0) continue;
        const source = parts[sourceId];
        let baseId = baseIds.get(outline.partKey);
        if (baseId === void 0) {
          if (parts.length >= PENDOLO_MAX_PARTS) {
            console.warn("[pendoloClockworkMeshes] exceeded PENDOLO_MAX_PARTS (gear bases)");
            continue;
          }
          baseId = parts.length;
          baseIds.set(outline.partKey, baseId);
          parts.push({
            getOrigin: source.getOrigin,
            getRotation: source.getRotation,
            height: resolvePendoloPartHeight(`${outline.partKey}${PENDOLO_PART_BASE_SUFFIX}`)
          });
        }
        base.setActivePartId(baseId);
        if (outline.kind === "polyline") {
          const [wr, wg, wb, wa] = outline.rgba;
          base.appendWall(outline.pts, sourceId, baseId, [wr, wg, wb, wa * PENDOLO_GEAR_WALL_ALPHA]);
          base.setActivePartId(baseId);
          base.appendPolyline(outline.pts, outline.lineWidth, outline.rgba, true);
        } else {
          base.appendCircleStroke(outline.cx, outline.cy, outline.radius, outline.lineWidth, outline.rgba, outline.segments);
        }
      }
      const front = base.toFloat32();
      const back = mesh.toFloat32();
      const data = new Float32Array(front.length + back.length);
      data.set(front, 0);
      data.set(back, front.length);
      const occluders = buildOccluderFaces(mesh, partKeys, parseRgba(palette.secondGearFill));
      return {
        key,
        data,
        parts,
        vertexCount: base.vertexCount + mesh.vertexCount,
        faceData: occluders.data,
        faces: occluders.faces
      };
    };
    var PENDOLO_GEAR_WALL_ALPHA = 0.18;
    var HOLE_FACE_PART = {
      "second-spoke": "second-spin"
    };
    var buildOccluderFaces = (mesh, partKeys, unfilledRgba) => {
      const out = new PendoloMeshBuilder();
      const faces = [];
      const holeRgba = [0, 0, 0, 0];
      for (const face of mesh.faceOutlines ?? []) {
        const partId = partKeys.get(face.partKey);
        if (partId === void 0) continue;
        const fanStart = out.vertexCount;
        out.setActivePartId(partId);
        out.appendFilledPolygonFromCenter(0, 0, face.pts, face.filled ? holeRgba : unfilledRgba);
        const fanCount = out.vertexCount - fanStart;
        const holeStart = out.vertexCount;
        for (const hole of mesh.faceHoles ?? []) {
          const owner = HOLE_FACE_PART[hole.partKey] ?? hole.partKey;
          if (owner !== face.partKey) continue;
          const holePart = partKeys.get(hole.partKey);
          if (holePart === void 0) continue;
          out.setActivePartId(holePart);
          const pts = Array.from({ length: 24 }, (_, i) => {
            const a = i * Math.PI * 2 / 24;
            return { x: hole.cx + hole.radius * Math.cos(a), y: hole.cy + hole.radius * Math.sin(a) };
          });
          out.appendFilledPolygonFromCenter(hole.cx, hole.cy, pts, holeRgba);
        }
        faces.push({ fanStart, fanCount, holeStart, holeCount: out.vertexCount - holeStart });
      }
      return { data: out.toFloat32(), faces };
    };
    var fillPendoloTransformTables = (parts, motion2, origins, rotations) => {
      for (let i = 0; i < parts.length; i++) {
        const origin = parts[i].getOrigin(motion2);
        origins[i * 2] = origin.x;
        origins[i * 2 + 1] = origin.y;
        rotations[i] = parts[i].getRotation(motion2);
      }
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloDialProjection.ts
    var PENDOLO_TILT_LIMIT_DEG = 70;
    var PENDOLO_PERSPECTIVE_FACTOR = 1.2;
    var buildPendoloTiltProjection = (tiltDeg, axisDeg, viewportWidth, viewportHeight) => {
      const matrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const focal = PENDOLO_PERSPECTIVE_FACTOR * Math.max(1, viewportWidth, viewportHeight);
      if (!tiltDeg) return { matrix, flat: true, lift: [0, 0, -1 / focal], invFocal: 1 / focal };
      const theta = Math.max(-PENDOLO_TILT_LIMIT_DEG, Math.min(PENDOLO_TILT_LIMIT_DEG, tiltDeg)) * Math.PI / 180;
      const phi = axisDeg * Math.PI / 180;
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const k = 1 - cos;
      matrix[0] = cos + ux * ux * k;
      matrix[1] = ux * uy * k;
      matrix[3] = ux * uy * k;
      matrix[4] = cos + uy * uy * k;
      matrix[6] = uy * sin / focal;
      matrix[7] = -ux * sin / focal;
      return {
        matrix,
        flat: false,
        lift: [uy * sin, -ux * sin, -cos / focal],
        invFocal: 1 / focal
      };
    };
    var PENDOLO_HUB_VIEW_FOCAL_FACTOR = 0.75;
    var PENDOLO_HUB_VIEW_TARGET_X = 0.5;
    var PENDOLO_HUB_VIEW_TARGET_Y = 0.42;
    var buildPendoloHubViewProjection = (cameraHeightPx, backDistancePx, targetDistancePx, side, hubX, hubY, viewportWidth, viewportHeight) => {
      const s = side;
      const H = Math.max(1, cameraHeightPx);
      const B = Math.max(0, backDistancePx);
      const D = Math.max(1, targetDistancePx);
      const Dc = D + B;
      const L2 = Dc * Dc + H * H;
      const L = Math.sqrt(L2);
      const F = PENDOLO_HUB_VIEW_FOCAL_FACTOR * Math.max(1, viewportWidth, viewportHeight);
      const sx = viewportWidth * PENDOLO_HUB_VIEW_TARGET_X - hubX;
      const sy = viewportHeight * PENDOLO_HUB_VIEW_TARGET_Y - hubY;
      const w0 = s * Dc / L2;
      const wc = (Dc * B + H * H) / L2;
      const matrix = new Float32Array([
        sx * w0,
        F * s / L,
        sx * wc,
        -F * s * H / L2 + sy * w0,
        0,
        F * D * H / L2 + sy * wc,
        w0,
        0,
        wc
      ]);
      const lw = -H / L2;
      return {
        matrix,
        flat: false,
        lift: [sx * lw, -F * Dc / L2 + sy * lw, lw],
        invFocal: 0
      };
    };
    var buildPendoloDialProjection = (tilt, mirror) => {
      if (!mirror) return tilt;
      const m = tilt.matrix;
      return {
        matrix: new Float32Array([-m[0], m[1], m[2], -m[3], m[4], m[5], -m[6], m[7], m[8]]),
        flat: tilt.flat,
        lift: tilt.lift,
        invFocal: tilt.invFocal
      };
    };
    var buildPendoloLayerProjection = (projection, heightPx) => {
      if (projection.flat || !heightPx) return projection;
      const m = projection.matrix;
      const shrink = 1 - heightPx * projection.invFocal;
      const [lx, ly, lw] = projection.lift;
      return {
        ...projection,
        matrix: new Float32Array([
          m[0] * shrink,
          m[1] * shrink,
          m[2] + heightPx * lx,
          m[3] * shrink,
          m[4] * shrink,
          m[5] + heightPx * ly,
          m[6] * shrink,
          m[7] * shrink,
          m[8] + heightPx * lw
        ])
      };
    };
    var invertPendoloProjectionMatrix = (m) => {
      const [a, b, c, d, e, f, g, h, i] = m;
      const A = e * i - f * h;
      const B = -(d * i - f * g);
      const C = d * h - e * g;
      const det = a * A + b * B + c * C;
      if (Math.abs(det) < 1e-9) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const inv = 1 / det;
      return new Float32Array([
        A * inv,
        -(b * i - c * h) * inv,
        (b * f - c * e) * inv,
        B * inv,
        (a * i - c * g) * inv,
        -(a * f - c * d) * inv,
        C * inv,
        -(a * h - b * g) * inv,
        (a * e - b * d) * inv
      ]);
    };
    var resolvePendoloSpaceCssTransform = (projection) => {
      const [a, b, c, d, e, f, g, h, i] = projection.matrix;
      const [lx, ly, lw] = projection.lift;
      return `matrix3d(${a}, ${d}, 0, ${g}, ${b}, ${e}, 0, ${h}, ${lx}, ${ly}, 1, ${lw}, ${c}, ${f}, 0, ${i})`;
    };
    var resolvePendoloPlaneCssTransform = (projection) => {
      const [a, b, c, d, e, f, g, h, i] = projection.matrix;
      return `matrix3d(${a}, ${d}, 0, ${g}, ${b}, ${e}, 0, ${h}, 0, 0, 1, 0, ${c}, ${f}, 0, ${i})`;
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloClockworkWebGL.ts
    var PENDOLO_PROJECTION_NEAR = "0.02";
    var VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_pos;
  layout(location = 1) in vec4 a_color;
  layout(location = 2) in float a_part;
  uniform vec2 u_resolution;
  uniform float u_dpr;
  uniform vec2 u_origins[${PENDOLO_MAX_PARTS}];
  uniform float u_rotations[${PENDOLO_MAX_PARTS}];
  // \u5404\u90E8\u4EF6\u79BB\u8868\u76D8\u5E73\u9762\u7684\u9AD8\u5EA6\uFF08CSS px\uFF09\uFF1B\u4E0D\u503E\u659C\u65F6\u5168\u662F 0
  uniform float u_heights[${PENDOLO_MAX_PARTS}];
  // \u906E\u6321\u9762\u90A3\u4E00\u904D\u628A\u9762\u5F80\u4E0B\u538B\u4E00\u70B9\uFF08CSS px\uFF09\uFF0C\u548C\u9762\u540C\u9AD8\u7684\u7EBF\u3001\u586B\u8272\u624D\u4E0D\u4F1A\u88AB\u81EA\u5DF1\u7684\u9762\u6321\u4F4F
  uniform float u_depthBias;
  // Shockwave lens: centre (CSS px), and crest radius, width, push share, light share.
  uniform vec2 u_waveCenter;
  uniform vec4 u_wave;
  // \u8868\u76D8\u6295\u5F71\uFF08pendoloDialProjection.ts\uFF09\uFF1A\u955C\u50CF / \u503E\u659C\u65F6 u_projOn = 1\uFF0C\u5E73\u9762\u4E0A\u76F8\u5BF9\u8F6E\u5FC3\u7684\u70B9 p \u6295\u5230
  // u_hub + (M\xB7p).xy / (M\xB7p).z\uFF1B\u5173\u7740\u65F6\u4E0D\u78B0\u9876\u70B9\uFF0C\u753B\u9762\u548C\u539F\u6765\u4E00\u6837\u3002
  uniform float u_projOn;
  uniform vec2 u_hub;
  uniform mat3 u_proj;
  // \u5206\u5C42\u89C6\u5DEE\uFF1A\u79BB\u8868\u76D8\u5E73\u9762\u9AD8 hgt\uFF08CSS px\uFF0C\u671D\u89C2\u770B\u8005\uFF09\u7684\u70B9\u5148\u5728\u5E73\u9762\u5185\u7F29 1 - hgt/f\uFF0C\u518D\u52A0\u4E0A\u62AC\u9AD8\u65B9\u5411\uFF1B
  // hgt = 0 \u65F6\u5C31\u662F\u5E73\u9762\u672C\u8EAB\u7684\u6295\u5F71\uFF08pendoloDialProjection.ts \u7684 buildPendoloLayerProjection \u540C\u4E00\u4E2A\u5F0F\u5B50\uFF09\u3002
  uniform vec3 u_lift;
  uniform float u_invFocal;
  vec3 projectDial(vec2 world, float hgt) {
    return u_proj * vec3((world - u_hub) * (1.0 - hgt * u_invFocal), 1.0) + hgt * u_lift;
  }
  // \u6295\u5F71\u540E\u7684\u9F50\u6B21\u5750\u6807\u76F4\u63A5\u4EA4\u7ED9 GPU\uFF1A\u900F\u89C6\u9664\u6CD5\u548C w \u2264 0\uFF08\u8F6E\u5FC3\u89C6\u89D2\u65F6\u76F8\u673A\u80CC\u540E\uFF09\u7684\u88C1\u526A\u90FD\u7531\u5B83\u505A\uFF0C
  // \u8DE8\u8FC7\u76F8\u673A\u5E73\u9762\u7684\u4E09\u89D2\u5F62\u4E0D\u4F1A\u88AB\u62C9\u6210\u957F\u523A\u3002\u6DF1\u5EA6 z/w = 1 - 2\xB7near/w \u662F 1/w \u7684\u7EBF\u6027\u51FD\u6570\uFF0C\u8FD1\u5904\u5C0F\uFF1B
  // \u53EA\u6709\u5206\u5C42\u89C6\u5DEE\u7684\u906E\u6321\u6253\u5F00\u6DF1\u5EA6\u6D4B\u8BD5\u65F6\u624D\u7528\u5F97\u4E0A\u3002w \u6BD4 near \u8FD8\u5C0F\u7684\uFF08\u8D34\u7740\u76F8\u673A\uFF09\u88AB\u8FD1\u5E73\u9762\u88C1\u6389\u3002
  vec4 projectedClip(vec3 h) {
    float w = h.z;
    vec2 px = (u_hub * w + h.xy) * u_dpr;
    return vec4(
      (px.x / u_resolution.x) * 2.0 - w,
      w - (px.y / u_resolution.y) * 2.0,
      w - ${PENDOLO_PROJECTION_NEAR} * 2.0,
      w
    );
  }
  out vec4 v_color;
  out float v_light;
  void main() {
    v_color = a_color;
    int id = int(a_part + 0.5);
    vec2 origin = u_origins[id];
    float rotation = u_rotations[id];
    float c = cos(rotation);
    float s = sin(rotation);
    vec2 world = vec2(a_pos.x * c - a_pos.y * s, a_pos.x * s + a_pos.y * c) + origin;
    v_light = 0.0;
    if (u_wave.y > 0.0) {
      vec2 rel = world - u_waveCenter;
      float u = (length(rel) - (u_wave.x - u_wave.y)) / u_wave.y;
      if (u > 0.0 && u < 1.0) {
        float b = sin(3.14159265 * u);
        b *= b;
        world += rel * (u_wave.z * b);
        v_light = u_wave.w * b;
      }
    }
    if (u_projOn > 0.5) {
      vec3 h = projectDial(world, u_heights[id] - u_depthBias);
      gl_Position = projectedClip(h);
      return;
    }
    vec2 px = world * u_dpr;
    vec2 clip = vec2(
      (px.x / u_resolution.x) * 2.0 - 1.0,
      1.0 - (px.y / u_resolution.y) * 2.0
    );
    gl_Position = vec4(clip, 0.0, 1.0);
  }
  `;
    var FRAG = `#version 300 es
  precision highp float;
  in vec4 v_color;
  in float v_light;
  uniform vec3 u_waveColor;
  uniform float u_waveTint;
  out vec4 outColor;
  void main() {
    // The lens lights what it passes, like the frame added onto itself, and tints it toward the effect
    // colour; v_light is 0 outside it, where both are exact no-ops (mix by 0 is the colour itself).
    float a = min(1.0, v_color.a * (1.0 + v_light));
    vec3 rgb = mix(v_color.rgb, u_waveColor, min(1.0, u_waveTint * v_light));
    outColor = vec4(rgb * a, a);
  }
  `;
    var FX_VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_pos;
  layout(location = 1) in vec4 a_color;
  layout(location = 2) in vec2 a_uv;
  // \u5206\u5C42\u89C6\u5DEE\u7684\u9AD8\u5EA6\uFF08\u8F6E\u76D8\u534A\u5F84\u7684\u6BD4\u4F8B\uFF09\uFF1A\u523B\u5EA6\u3001\u706B\u82B1\u8D34\u7740\u523B\u5EA6\uFF0C\u5B9D\u77F3\u4EAE\u6591\u548C\u5404\u81EA\u7684\u5B9D\u77F3\u540C\u9AD8
  layout(location = 3) in float a_height;
  uniform vec2 u_resolution;
  uniform float u_dpr;
  // \u9AD8\u5EA6\u6BD4\u4F8B\u6362\u6210 CSS px \u7684\u500D\u6570\uFF08\u89C6\u5DEE\u5F3A\u5EA6\u4E58\u8F6E\u76D8\u534A\u5F84\uFF09
  uniform float u_fxHeight;
  // \u8868\u76D8\u6295\u5F71\uFF08pendoloDialProjection.ts\uFF09\uFF1A\u955C\u50CF / \u503E\u659C\u65F6 u_projOn = 1\uFF0C\u5E73\u9762\u4E0A\u76F8\u5BF9\u8F6E\u5FC3\u7684\u70B9 p \u6295\u5230
  // u_hub + (M\xB7p).xy / (M\xB7p).z\uFF1B\u5173\u7740\u65F6\u4E0D\u78B0\u9876\u70B9\uFF0C\u753B\u9762\u548C\u539F\u6765\u4E00\u6837\u3002
  uniform float u_projOn;
  uniform vec2 u_hub;
  uniform mat3 u_proj;
  // \u5206\u5C42\u89C6\u5DEE\uFF1A\u79BB\u8868\u76D8\u5E73\u9762\u9AD8 hgt\uFF08CSS px\uFF0C\u671D\u89C2\u770B\u8005\uFF09\u7684\u70B9\u5148\u5728\u5E73\u9762\u5185\u7F29 1 - hgt/f\uFF0C\u518D\u52A0\u4E0A\u62AC\u9AD8\u65B9\u5411\uFF1B
  // hgt = 0 \u65F6\u5C31\u662F\u5E73\u9762\u672C\u8EAB\u7684\u6295\u5F71\uFF08pendoloDialProjection.ts \u7684 buildPendoloLayerProjection \u540C\u4E00\u4E2A\u5F0F\u5B50\uFF09\u3002
  uniform vec3 u_lift;
  uniform float u_invFocal;
  vec3 projectDial(vec2 world, float hgt) {
    return u_proj * vec3((world - u_hub) * (1.0 - hgt * u_invFocal), 1.0) + hgt * u_lift;
  }
  // \u6295\u5F71\u540E\u7684\u9F50\u6B21\u5750\u6807\u76F4\u63A5\u4EA4\u7ED9 GPU\uFF1A\u900F\u89C6\u9664\u6CD5\u548C w \u2264 0\uFF08\u8F6E\u5FC3\u89C6\u89D2\u65F6\u76F8\u673A\u80CC\u540E\uFF09\u7684\u88C1\u526A\u90FD\u7531\u5B83\u505A\uFF0C
  // \u8DE8\u8FC7\u76F8\u673A\u5E73\u9762\u7684\u4E09\u89D2\u5F62\u4E0D\u4F1A\u88AB\u62C9\u6210\u957F\u523A\u3002\u6DF1\u5EA6 z/w = 1 - 2\xB7near/w \u662F 1/w \u7684\u7EBF\u6027\u51FD\u6570\uFF0C\u8FD1\u5904\u5C0F\uFF1B
  // \u53EA\u6709\u5206\u5C42\u89C6\u5DEE\u7684\u906E\u6321\u6253\u5F00\u6DF1\u5EA6\u6D4B\u8BD5\u65F6\u624D\u7528\u5F97\u4E0A\u3002w \u6BD4 near \u8FD8\u5C0F\u7684\uFF08\u8D34\u7740\u76F8\u673A\uFF09\u88AB\u8FD1\u5E73\u9762\u88C1\u6389\u3002
  vec4 projectedClip(vec3 h) {
    float w = h.z;
    vec2 px = (u_hub * w + h.xy) * u_dpr;
    return vec4(
      (px.x / u_resolution.x) * 2.0 - w,
      w - (px.y / u_resolution.y) * 2.0,
      w - ${PENDOLO_PROJECTION_NEAR} * 2.0,
      w
    );
  }
  out vec4 v_color;
  out vec2 v_uv;
  void main() {
    v_color = a_color;
    v_uv = a_uv;
    vec2 world = a_pos;
    if (u_projOn > 0.5) {
      gl_Position = projectedClip(projectDial(world, a_height * u_fxHeight));
      return;
    }
    vec2 px = world * u_dpr;
    gl_Position = vec4((px.x / u_resolution.x) * 2.0 - 1.0, 1.0 - (px.y / u_resolution.y) * 2.0, 0.0, 1.0);
  }
  `;
    var FX_FRAG = `#version 300 es
  precision highp float;
  in vec4 v_color;
  in vec2 v_uv;
  out vec4 outColor;
  void main() {
    float a = 1.0;
    if (v_uv.x > -1.5) {
      a = clamp(1.0 - length(v_uv), 0.0, 1.0);
      a *= a;
    }
    outColor = v_color * a;
  }
  `;
    var GRAD_VERT = `#version 300 es
  precision highp float;
  const vec2 pos[4] = vec2[4](
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0)
  );
  out vec2 v_uv;
  void main() {
    v_uv = pos[gl_VertexID] * 0.5 + 0.5;
    gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
  }
  `;
    var GRAD_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform vec2 u_center;
  uniform float u_radius;
  uniform vec2 u_resolution;
  uniform vec3 u_bg;
  // \u955C\u50CF / \u503E\u659C\u65F6\u4ECE\u5C4F\u5E55\u50CF\u7D20\u53CD\u67E5\u56DE\u8868\u76D8\u5E73\u9762\uFF08u_projInv \u662F\u6295\u5F71\u7684\u9006\uFF0CCSS px \u76F8\u5BF9\u8F6E\u5FC3\uFF09\uFF0C\u6E10\u53D8\u8DDF\u7740\u8868\u76D8\u53D8\u6210\u692D\u5706
  uniform float u_projOn;
  uniform float u_gdpr;
  uniform mat3 u_projInv;
  out vec4 outColor;
  // Match Canvas2D stops: 0\u21920.72, 0.35\u21920.52, 0.7\u21920.20, 1\u21920
  float radialAlpha(float t) {
    if (t <= 0.35) return mix(0.72, 0.52, t / 0.35);
    if (t <= 0.7) return mix(0.52, 0.20, (t - 0.35) / 0.35);
    return mix(0.20, 0.0, (t - 0.7) / 0.3);
  }
  void main() {
    // u_center is measured from the top like every CSS coordinate here; v_uv.y runs bottom-up.
    vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution;
    float dist = distance(px, u_center);
    if (u_projOn > 0.5) {
      vec3 q = u_projInv * vec3((px - u_center) / u_gdpr, 1.0);
      if (q.z <= 0.0) discard;
      dist = length(q.xy / q.z) * u_gdpr;
    }
    float t = clamp(dist / max(u_radius, 1.0), 0.0, 1.0);
    float a = radialAlpha(t);
    outColor = vec4(u_bg * a, a);
  }
  `;
    var COVER_VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_pos;
  layout(location = 1) in vec2 a_uv;
  uniform vec2 u_resolution;
  uniform float u_dpr;
  // \u8868\u76D8\u6295\u5F71\uFF08pendoloDialProjection.ts\uFF09\uFF1A\u955C\u50CF / \u503E\u659C\u65F6 u_projOn = 1\uFF0C\u5E73\u9762\u4E0A\u76F8\u5BF9\u8F6E\u5FC3\u7684\u70B9 p \u6295\u5230
  // u_hub + (M\xB7p).xy / (M\xB7p).z\uFF1B\u5173\u7740\u65F6\u4E0D\u78B0\u9876\u70B9\uFF0C\u753B\u9762\u548C\u539F\u6765\u4E00\u6837\u3002
  uniform float u_projOn;
  uniform vec2 u_hub;
  uniform mat3 u_proj;
  // \u5206\u5C42\u89C6\u5DEE\uFF1A\u79BB\u8868\u76D8\u5E73\u9762\u9AD8 hgt\uFF08CSS px\uFF0C\u671D\u89C2\u770B\u8005\uFF09\u7684\u70B9\u5148\u5728\u5E73\u9762\u5185\u7F29 1 - hgt/f\uFF0C\u518D\u52A0\u4E0A\u62AC\u9AD8\u65B9\u5411\uFF1B
  // hgt = 0 \u65F6\u5C31\u662F\u5E73\u9762\u672C\u8EAB\u7684\u6295\u5F71\uFF08pendoloDialProjection.ts \u7684 buildPendoloLayerProjection \u540C\u4E00\u4E2A\u5F0F\u5B50\uFF09\u3002
  uniform vec3 u_lift;
  uniform float u_invFocal;
  vec3 projectDial(vec2 world, float hgt) {
    return u_proj * vec3((world - u_hub) * (1.0 - hgt * u_invFocal), 1.0) + hgt * u_lift;
  }
  // \u6295\u5F71\u540E\u7684\u9F50\u6B21\u5750\u6807\u76F4\u63A5\u4EA4\u7ED9 GPU\uFF1A\u900F\u89C6\u9664\u6CD5\u548C w \u2264 0\uFF08\u8F6E\u5FC3\u89C6\u89D2\u65F6\u76F8\u673A\u80CC\u540E\uFF09\u7684\u88C1\u526A\u90FD\u7531\u5B83\u505A\uFF0C
  // \u8DE8\u8FC7\u76F8\u673A\u5E73\u9762\u7684\u4E09\u89D2\u5F62\u4E0D\u4F1A\u88AB\u62C9\u6210\u957F\u523A\u3002\u6DF1\u5EA6 z/w = 1 - 2\xB7near/w \u662F 1/w \u7684\u7EBF\u6027\u51FD\u6570\uFF0C\u8FD1\u5904\u5C0F\uFF1B
  // \u53EA\u6709\u5206\u5C42\u89C6\u5DEE\u7684\u906E\u6321\u6253\u5F00\u6DF1\u5EA6\u6D4B\u8BD5\u65F6\u624D\u7528\u5F97\u4E0A\u3002w \u6BD4 near \u8FD8\u5C0F\u7684\uFF08\u8D34\u7740\u76F8\u673A\uFF09\u88AB\u8FD1\u5E73\u9762\u88C1\u6389\u3002
  vec4 projectedClip(vec3 h) {
    float w = h.z;
    vec2 px = (u_hub * w + h.xy) * u_dpr;
    return vec4(
      (px.x / u_resolution.x) * 2.0 - w,
      w - (px.y / u_resolution.y) * 2.0,
      w - ${PENDOLO_PROJECTION_NEAR} * 2.0,
      w
    );
  }
  out vec2 v_uv;
  void main() {
    v_uv = a_uv;
    vec2 world = a_pos;
    if (u_projOn > 0.5) {
      // \u9F50\u6B21\u5750\u6807\u4EA4\u7ED9 GPU \u505A\u900F\u89C6\u9664\u6CD5\uFF0C\u8D34\u56FE\u6309\u900F\u89C6\u6B63\u786E\u63D2\u503C
      gl_Position = projectedClip(projectDial(world, 0.0));
      return;
    }
    vec2 px = world * u_dpr;
    vec2 clip = vec2(
      (px.x / u_resolution.x) * 2.0 - 1.0,
      1.0 - (px.y / u_resolution.y) * 2.0
    );
    gl_Position = vec4(clip, 0.0, 1.0);
  }
  `;
    var COVER_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform sampler2D u_tex;
  uniform float u_opacity;
  out vec4 outColor;
  void main() {
    vec2 c = v_uv * 2.0 - 1.0;
    if (dot(c, c) > 1.0) discard;
    vec4 tex = texture(u_tex, v_uv);
    float a = tex.a * u_opacity;
    outColor = vec4(tex.rgb * a, a);
  }
  `;
    var compileShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("[pendoloClockworkWebGL] shader compile", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    var linkProgram = (gl, vert, frag) => {
      const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
      if (!vs || !fs) return null;
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn("[pendoloClockworkWebGL] program link", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    };
    var getProjectionUniforms = (gl, program) => ({
      on: gl.getUniformLocation(program, "u_projOn"),
      hub: gl.getUniformLocation(program, "u_hub"),
      proj: gl.getUniformLocation(program, "u_proj"),
      lift: gl.getUniformLocation(program, "u_lift"),
      invFocal: gl.getUniformLocation(program, "u_invFocal")
    });
    var setProjectionUniforms = (gl, locs, input) => {
      if (!locs) return;
      const m = input.projection;
      gl.uniform1f(locs.on, m ? 1 : 0);
      if (!m) return;
      gl.uniform2f(locs.hub, input.centerX, input.centerY);
      gl.uniformMatrix3fv(locs.proj, true, m);
      const lift = input.parallaxScalePx ? input.parallaxLift : null;
      gl.uniform3f(locs.lift, lift?.[0] ?? 0, lift?.[1] ?? 0, lift?.[2] ?? 0);
      gl.uniform1f(locs.invFocal, lift ? input.parallaxInvFocal ?? 0 : 0);
    };
    var colorToRgb = (color) => {
      const ch = parseColorChannels(color);
      if (!ch) return [0, 0, 0];
      return [ch.r / 255, ch.g / 255, ch.b / 255];
    };
    var PendoloClockworkRenderer = class {
      /**
       * `antialias` 是上下文的 MSAA（#929，默认开）。建上下文时就定了，一块画布只认第一次拿到的上下文，
       * 所以改它要换一块新画布、建一个新的渲染器（PendoloClockworkCanvas 按它给画布换 key）。
       */
      constructor(canvas, antialias = true, depthStencil = false) {
        this.canvas = canvas;
        const gl = canvas.getContext("webgl2", {
          alpha: true,
          premultipliedAlpha: true,
          antialias,
          // 分层视差的遮挡：深度缓冲记齿轮顶面，模板缓冲从面上抠洞。只在倾斜且开视差时要，
          // 平放时不多占这两块缓冲（开 MSAA 时还是多重采样的）；变了换画布（同 antialias）
          depth: depthStencil,
          stencil: depthStencil,
          powerPreference: "high-performance"
        });
        if (!gl) return;
        this.gl = gl;
        const attributes = gl.getContextAttributes();
        this.canOcclude = Boolean(depthStencil && attributes?.depth && attributes.stencil);
        this.meshProgram = linkProgram(gl, VERT, FRAG);
        this.gradProgram = linkProgram(gl, GRAD_VERT, GRAD_FRAG);
        this.coverProgram = linkProgram(gl, COVER_VERT, COVER_FRAG);
        if (this.meshProgram) {
          this.meshUniformRes = gl.getUniformLocation(this.meshProgram, "u_resolution");
          this.meshUniformDpr = gl.getUniformLocation(this.meshProgram, "u_dpr");
          this.meshUniformOrigins = gl.getUniformLocation(this.meshProgram, "u_origins");
          this.meshUniformRotations = gl.getUniformLocation(this.meshProgram, "u_rotations");
          this.meshUniformWaveCenter = gl.getUniformLocation(this.meshProgram, "u_waveCenter");
          this.meshUniformWave = gl.getUniformLocation(this.meshProgram, "u_wave");
          this.meshUniformWaveColor = gl.getUniformLocation(this.meshProgram, "u_waveColor");
          this.meshUniformWaveTint = gl.getUniformLocation(this.meshProgram, "u_waveTint");
          this.meshProjection = getProjectionUniforms(gl, this.meshProgram);
          this.meshUniformHeights = gl.getUniformLocation(this.meshProgram, "u_heights");
          this.meshUniformDepthBias = gl.getUniformLocation(this.meshProgram, "u_depthBias");
        }
        if (this.gradProgram) {
          this.gradUniformCenter = gl.getUniformLocation(this.gradProgram, "u_center");
          this.gradUniformRadius = gl.getUniformLocation(this.gradProgram, "u_radius");
          this.gradUniformRes = gl.getUniformLocation(this.gradProgram, "u_resolution");
          this.gradUniformBg = gl.getUniformLocation(this.gradProgram, "u_bg");
          this.gradUniformProjOn = gl.getUniformLocation(this.gradProgram, "u_projOn");
          this.gradUniformDpr = gl.getUniformLocation(this.gradProgram, "u_gdpr");
          this.gradUniformProjInv = gl.getUniformLocation(this.gradProgram, "u_projInv");
        }
        if (this.coverProgram) {
          this.coverUniformRes = gl.getUniformLocation(this.coverProgram, "u_resolution");
          this.coverUniformDpr = gl.getUniformLocation(this.coverProgram, "u_dpr");
          this.coverUniformTex = gl.getUniformLocation(this.coverProgram, "u_tex");
          this.coverUniformOpacity = gl.getUniformLocation(this.coverProgram, "u_opacity");
          this.coverProjection = getProjectionUniforms(gl, this.coverProgram);
        }
        this.meshVbo = gl.createBuffer();
        this.meshVao = gl.createVertexArray();
        gl.bindVertexArray(this.meshVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVbo);
        const strideBytes = PENDOLO_MESH_STRIDE * 4;
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, strideBytes, 0);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, strideBytes, 8);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, strideBytes, 24);
        gl.bindVertexArray(null);
        this.coverVbo = gl.createBuffer();
        this.coverVao = gl.createVertexArray();
        gl.bindVertexArray(this.coverVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coverVbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.coverVerts.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.bindVertexArray(null);
        this.fullscreenVao = gl.createVertexArray();
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      canvas;
      gl = null;
      meshProgram = null;
      gradProgram = null;
      coverProgram = null;
      /** Beat FX overlay; created on the first frame that has any, never for a user who has none. */
      fxProgram = null;
      fxVbo = null;
      fxVao = null;
      fxUniformRes = null;
      fxUniformDpr = null;
      fxProjection = null;
      meshProjection = null;
      coverProjection = null;
      gradUniformProjOn = null;
      gradUniformDpr = null;
      gradUniformProjInv = null;
      /** 上一次求逆用的投影和结果；投影只随布局 / 设置变，不必每帧求逆。 */
      gradInverseSource = null;
      gradInverse = null;
      fxVerts = null;
      fxFailed = false;
      meshUniformWaveCenter = null;
      meshUniformWave = null;
      meshUniformWaveColor = null;
      meshUniformWaveTint = null;
      meshVbo = null;
      meshVao = null;
      coverVbo = null;
      coverVao = null;
      fullscreenVao = null;
      coverTex = null;
      /** The image currently in `coverTex`; uploads are keyed on the image, not its URL. */
      coverSource = null;
      /**
       * An image whose upload threw (a cross-origin cover without CORS taints WebGL, where Canvas2D
       * would still draw it). It is not retried, so a bad cover costs one failed upload, not one
       * per frame.
       */
      failedCoverSource = null;
      /** The cover quad as last uploaded: centre and radius in CSS pixels. */
      coverQuadKey = "";
      cachedScene = null;
      meshUniformRes = null;
      meshUniformDpr = null;
      meshUniformOrigins = null;
      meshUniformRotations = null;
      gradUniformCenter = null;
      gradUniformRadius = null;
      gradUniformRes = null;
      gradUniformBg = null;
      coverUniformRes = null;
      coverUniformDpr = null;
      coverUniformTex = null;
      coverUniformOpacity = null;
      originTable = new Float32Array(PENDOLO_MAX_PARTS * 2);
      rotationTable = new Float32Array(PENDOLO_MAX_PARTS);
      /** 各部件的视差高度（CSS px）；不倾斜时全是 0。 */
      heightTable = new Float32Array(PENDOLO_MAX_PARTS);
      meshUniformHeights = null;
      meshUniformDepthBias = null;
      faceVbo = null;
      faceVao = null;
      /** faceVbo 里现在是哪个场景的遮挡面。 */
      faceSceneKey = "";
      fxUniformHeight = null;
      coverVerts = new Float32Array(16);
      /** 上下文真的带了深度和模板缓冲，分层视差的遮挡才做。 */
      canOcclude = false;
      get isReady() {
        return Boolean(
          this.gl && !this.gl.isContextLost() && this.meshProgram && this.gradProgram && this.coverProgram && this.meshVbo && this.meshVao
        );
      }
      dispose() {
        const gl = this.gl;
        if (!gl) return;
        if (this.meshVao) gl.deleteVertexArray(this.meshVao);
        if (this.coverVao) gl.deleteVertexArray(this.coverVao);
        if (this.fullscreenVao) gl.deleteVertexArray(this.fullscreenVao);
        if (this.meshVbo) gl.deleteBuffer(this.meshVbo);
        if (this.faceVbo) gl.deleteBuffer(this.faceVbo);
        if (this.faceVao) gl.deleteVertexArray(this.faceVao);
        this.faceVbo = null;
        this.faceVao = null;
        this.faceSceneKey = "";
        if (this.coverVbo) gl.deleteBuffer(this.coverVbo);
        if (this.meshProgram) gl.deleteProgram(this.meshProgram);
        if (this.gradProgram) gl.deleteProgram(this.gradProgram);
        if (this.coverProgram) gl.deleteProgram(this.coverProgram);
        if (this.fxVao) gl.deleteVertexArray(this.fxVao);
        if (this.fxVbo) gl.deleteBuffer(this.fxVbo);
        if (this.fxProgram) gl.deleteProgram(this.fxProgram);
        this.fxVao = null;
        this.fxVbo = null;
        this.fxProgram = null;
        if (this.coverTex) gl.deleteTexture(this.coverTex);
        this.coverTex = null;
        this.coverSource = null;
        this.cachedScene = null;
        this.gl = null;
      }
      /**
       * Disposes and, once the canvas has left the document, gives the context back to the
       * browser. Chromium keeps only about 16 live WebGL contexts and drops the oldest past that,
       * which may belong to another visualizer. A canvas still in the document (StrictMode's
       * simulated unmount) keeps its context, so the remount can attach to it again.
       */
      release() {
        const gl = this.gl;
        this.dispose();
        if (gl && !this.canvas.isConnected && !gl.isContextLost()) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        }
      }
      /** Whether this cover image could not be uploaded (a cross-origin cover without CORS). */
      isCoverRejected(image) {
        return image !== null && image === this.failedCoverSource;
      }
      /** Uploads cover art when the decoded image changes; returns whether a cover is ready. */
      syncCoverImage(image) {
        const gl = this.gl;
        if (!image || image === this.failedCoverSource) {
          if (this.coverTex) {
            gl.deleteTexture(this.coverTex);
            this.coverTex = null;
          }
          this.coverSource = null;
          return false;
        }
        if (image === this.coverSource && this.coverTex) return true;
        if (!this.coverTex) this.coverTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.coverTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        } catch {
          this.failedCoverSource = image;
          gl.deleteTexture(this.coverTex);
          this.coverTex = null;
          this.coverSource = null;
          return false;
        }
        this.coverSource = image;
        return true;
      }
      resize(pixelWidth, pixelHeight) {
        const gl = this.gl;
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
          this.canvas.width = pixelWidth;
          this.canvas.height = pixelHeight;
        }
        gl.viewport(0, 0, pixelWidth, pixelHeight);
      }
      /**
       * Draws one clockwork frame. Positions in the mesh are CSS pixels. `beatFx` is 智能动感模式'
       * frame; absent, the frame is exactly the one drawn before it existed.
       */
      draw(options) {
        const gl = this.gl;
        if (!gl || !this.isReady) return;
        const { input, cssWidth, cssHeight, dpr, beatFx = null } = options;
        const pixelW = Math.round(cssWidth * dpr);
        const pixelH = Math.round(cssHeight * dpr);
        if (pixelW <= 0 || pixelH <= 0) return;
        this.resize(pixelW, pixelH);
        const hasCover = input.showCover && this.syncCoverImage(input.coverImage);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (input.showCenterGradient) {
          this.drawGradient(input, pixelW, pixelH, dpr);
        }
        if (hasCover) {
          this.drawCover(input, pixelW, pixelH, dpr);
        }
        if (input.showGearDecor !== "none") {
          this.drawMesh(input, pixelW, pixelH, dpr, beatFx);
          if (beatFx) this.drawBeatFx(input, beatFx, pixelW, pixelH, dpr);
        }
      }
      /** Builds the overlay program on first use; false (and never again) if it cannot. */
      ensureFx() {
        if (this.fxProgram) return true;
        if (this.fxFailed) return false;
        const gl = this.gl;
        this.fxProgram = linkProgram(gl, FX_VERT, FX_FRAG);
        if (!this.fxProgram) {
          this.fxFailed = true;
          return false;
        }
        this.fxUniformRes = gl.getUniformLocation(this.fxProgram, "u_resolution");
        this.fxUniformDpr = gl.getUniformLocation(this.fxProgram, "u_dpr");
        this.fxProjection = getProjectionUniforms(gl, this.fxProgram);
        this.fxUniformHeight = gl.getUniformLocation(this.fxProgram, "u_fxHeight");
        this.fxVerts = new Float32Array(PENDOLO_OVERLAY_MAX_VERTICES * PENDOLO_OVERLAY_STRIDE);
        this.fxVbo = gl.createBuffer();
        this.fxVao = gl.createVertexArray();
        gl.bindVertexArray(this.fxVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fxVbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.fxVerts.byteLength, gl.DYNAMIC_DRAW);
        const strideBytes = PENDOLO_OVERLAY_STRIDE * 4;
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, strideBytes, 0);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, strideBytes, 8);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, strideBytes, 24);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, strideBytes, 32);
        gl.bindVertexArray(null);
        return true;
      }
      /** The additive overlay: lit ticks, jewel flares, sparks. Nothing at all on a frame without any. */
      drawBeatFx(input, beatFx, pixelW, pixelH, dpr) {
        if (!this.fxVerts && !this.ensureFx()) return;
        const verts = this.fxVerts;
        const count = buildPendoloBeatFxOverlay(verts, input, beatFx);
        if (count === 0) return;
        const gl = this.gl;
        gl.useProgram(this.fxProgram);
        gl.bindVertexArray(this.fxVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fxVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, count * PENDOLO_OVERLAY_STRIDE);
        gl.uniform2f(this.fxUniformRes, pixelW, pixelH);
        gl.uniform1f(this.fxUniformDpr, dpr);
        setProjectionUniforms(gl, this.fxProjection, input);
        gl.uniform1f(this.fxUniformHeight, input.parallaxScalePx ?? 0);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.TRIANGLES, 0, count);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(null);
      }
      drawGradient(input, pixelW, pixelH, dpr) {
        const gl = this.gl;
        const anchors = resolvePendoloClockworkAnchors(input);
        gl.useProgram(this.gradProgram);
        gl.bindVertexArray(this.fullscreenVao);
        const rgb = colorToRgb(input.backgroundColor || "#000000");
        gl.uniform2f(this.gradUniformCenter, input.centerX * dpr, input.centerY * dpr);
        gl.uniform1f(this.gradUniformRadius, anchors.gradientR * dpr);
        gl.uniform2f(this.gradUniformRes, pixelW, pixelH);
        gl.uniform3f(this.gradUniformBg, rgb[0], rgb[1], rgb[2]);
        const m = input.projection;
        gl.uniform1f(this.gradUniformProjOn, m ? 1 : 0);
        if (m) {
          if (this.gradInverseSource !== m || !this.gradInverse) {
            this.gradInverseSource = m;
            this.gradInverse = invertPendoloProjectionMatrix(m);
          }
          gl.uniform1f(this.gradUniformDpr, dpr);
          gl.uniformMatrix3fv(this.gradUniformProjInv, true, this.gradInverse);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
      }
      drawCover(input, pixelW, pixelH, dpr) {
        const gl = this.gl;
        const anchors = resolvePendoloClockworkAnchors(input);
        const r = anchors.coverRadius;
        const { centerX, centerY, showGearDecor } = input;
        const opacity = 0.42 * (showGearDecor === "full" ? 1 : 0.6);
        gl.useProgram(this.coverProgram);
        gl.bindVertexArray(this.coverVao);
        const flipU = input.mirrored === true;
        const quadKey = `${centerX}|${centerY}|${r}|${flipU ? 1 : 0}`;
        if (quadKey !== this.coverQuadKey) {
          this.coverQuadKey = quadKey;
          const u0 = flipU ? 1 : 0;
          const u1 = flipU ? 0 : 1;
          this.coverVerts.set([
            centerX - r,
            centerY - r,
            u0,
            0,
            centerX + r,
            centerY - r,
            u1,
            0,
            centerX - r,
            centerY + r,
            u0,
            1,
            centerX + r,
            centerY + r,
            u1,
            1
          ]);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.coverVbo);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.coverVerts);
        }
        gl.uniform2f(this.coverUniformRes, pixelW, pixelH);
        gl.uniform1f(this.coverUniformDpr, dpr);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.coverTex);
        gl.uniform1i(this.coverUniformTex, 0);
        gl.uniform1f(this.coverUniformOpacity, opacity);
        setProjectionUniforms(gl, this.coverProjection, input);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
      }
      ensureCachedScene(input) {
        const key = buildPendoloClockworkCacheKey(input);
        if (this.cachedScene?.key === key) return this.cachedScene;
        const next = buildPendoloClockworkCachedScene(input);
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVbo);
        gl.bufferData(gl.ARRAY_BUFFER, next.data, gl.STATIC_DRAW);
        this.cachedScene = next;
        return next;
      }
      drawMesh(input, pixelW, pixelH, dpr, beatFx) {
        const gl = this.gl;
        const scene = this.ensureCachedScene(input);
        if (scene.vertexCount === 0 || scene.parts.length === 0) return;
        const motion2 = {
          escapementAngle: input.escapementAngle,
          phase: input.phase,
          bassOscillation: input.bassOscillation,
          secondGearAngle: input.secondGearAngle,
          transBeatAngle: input.transBeatAngle
        };
        fillPendoloTransformTables(scene.parts, motion2, this.originTable, this.rotationTable);
        gl.useProgram(this.meshProgram);
        gl.bindVertexArray(this.meshVao);
        gl.uniform2f(this.meshUniformRes, pixelW, pixelH);
        gl.uniform1f(this.meshUniformDpr, dpr);
        gl.uniform2fv(this.meshUniformOrigins, this.originTable);
        gl.uniform1fv(this.meshUniformRotations, this.rotationTable);
        const wave = resolvePendoloWaveUniform(beatFx?.wave ?? null);
        const waveSide = input.mirrored ? -1 : 1;
        gl.uniform2f(this.meshUniformWaveCenter, input.centerX + waveSide * (beatFx?.wave?.x ?? 0), input.centerY + (beatFx?.wave?.y ?? 0));
        setProjectionUniforms(gl, this.meshProjection, input);
        const heightScale = input.projection ? input.parallaxScalePx ?? 0 : 0;
        for (let i = 0; i < scene.parts.length; i++) this.heightTable[i] = scene.parts[i].height * heightScale;
        gl.uniform1fv(this.meshUniformHeights, this.heightTable);
        gl.uniform4f(this.meshUniformWave, wave[0], wave[1], wave[2], wave[3]);
        const tint = beatFx?.wave ? beatFx.color : null;
        gl.uniform3f(this.meshUniformWaveColor, tint ? tint[0] / 255 : 0, tint ? tint[1] / 255 : 0, tint ? tint[2] / 255 : 0);
        gl.uniform1f(this.meshUniformWaveTint, tint ? PENDOLO_WAVE_TINT : 0);
        gl.uniform1f(this.meshUniformDepthBias, 0);
        const occluding = this.canOcclude && heightScale > 0 && Boolean(scene.faces?.length) && this.drawOccluders(scene, heightScale);
        gl.bindVertexArray(this.meshVao);
        gl.drawArrays(gl.TRIANGLES, 0, scene.vertexCount);
        if (occluding) {
          gl.disable(gl.DEPTH_TEST);
          gl.depthMask(true);
        }
        gl.bindVertexArray(null);
      }
      /**
       * 分层视差的遮挡：先把各齿轮的顶面写进深度缓冲（不出颜色），每块面先用模板把自己的洞标出来、
       * 写深度时跳过洞；之后的线和填色按深度测试画，被上层齿轮挡住的就不画。网格程序和高度表已经设好。
       */
      drawOccluders(scene, heightScale) {
        const gl = this.gl;
        if (!gl || !scene.faceData || !scene.faces) return false;
        if (!this.faceVbo) {
          this.faceVbo = gl.createBuffer();
          this.faceVao = gl.createVertexArray();
          gl.bindVertexArray(this.faceVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.faceVbo);
          const strideBytes = PENDOLO_MESH_STRIDE * 4;
          gl.enableVertexAttribArray(0);
          gl.enableVertexAttribArray(1);
          gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, strideBytes, 0);
          gl.vertexAttribPointer(1, 4, gl.FLOAT, false, strideBytes, 8);
          gl.vertexAttribPointer(2, 1, gl.FLOAT, false, strideBytes, 24);
        }
        gl.bindVertexArray(this.faceVao);
        if (this.faceSceneKey !== scene.key) {
          gl.bindBuffer(gl.ARRAY_BUFFER, this.faceVbo);
          gl.bufferData(gl.ARRAY_BUFFER, scene.faceData, gl.STATIC_DRAW);
          this.faceSceneKey = scene.key;
        }
        gl.depthMask(true);
        gl.stencilMask(255);
        gl.clearDepth(1);
        gl.clearStencil(0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);
        gl.uniform1f(this.meshUniformDepthBias, Math.max(0.02, 25e-4 * heightScale));
        scene.faces.forEach((face, index) => {
          const ref = index % 255 + 1;
          if (face.holeCount > 0) {
            gl.disable(gl.DEPTH_TEST);
            gl.depthMask(false);
            gl.stencilFunc(gl.ALWAYS, ref, 255);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
            gl.drawArrays(gl.TRIANGLES, face.holeStart, face.holeCount);
            gl.enable(gl.DEPTH_TEST);
          }
          gl.depthMask(true);
          gl.depthFunc(gl.LESS);
          gl.stencilFunc(gl.NOTEQUAL, ref, 255);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
          gl.drawArrays(gl.TRIANGLES, face.fanStart, face.fanCount);
        });
        gl.disable(gl.STENCIL_TEST);
        gl.uniform1f(this.meshUniformDepthBias, 0);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(false);
        return true;
      }
    };
  
    // src/render/folia/components/visualizer/pendolo/PendoloClockworkCanvas.tsx
    var PendoloClockworkCanvas = ({
      centerX,
      centerY,
      viewportWidth,
      viewportHeight,
      baseRadius,
      lyricRingRadius,
      escapementAngleMotionValue,
      audioBassMotionValue,
      audioBass = 0.18,
      primaryTextColor,
      accentTextColor,
      backgroundColor = "#000000",
      showGearDecor,
      showCenterGradient = true,
      showCover = false,
      coverUrl = null,
      enableLineGlow = false,
      paused = false,
      motionProfile,
      beatFxRef,
      renderScale = 1,
      antialias = true,
      mirrored = false,
      projection,
      parallaxScalePx = 0,
      depthStencil = false,
      onBackendChange
    }) => {
      const webglCanvasRef = useRef(null);
      const canvas2dRef = useRef(null);
      const rendererRef = useRef(null);
      const useWebglRef = useRef(false);
      const lastBackendRef = useRef(null);
      const onBackendChangeRef = useRef(onBackendChange);
      onBackendChangeRef.current = onBackendChange;
      const motionStateRef = useRef(createPendoloClockworkMotionState());
      const lastTimestampRef = useRef(null);
      const coverImageRef = useRef(null);
      const coverNeeds2dRef = useRef(false);
      const noCorsCoverOriginsRef = useRef(/* @__PURE__ */ new Set());
      const beatCounterRef = useRef(createPendoloBeatCounter());
      const beatTriggersRef = useRef(readPendoloBeatTriggers(createPendoloBeatCounter()));
      const beatInputRef = useRef({ beats: 0, downbeats: 0, beatGain: 0, downbeatGain: 0 });
      const beatFxFrameRef = useRef(null);
      const waveScratchRef = useRef(null);
      const contentBox = useMemo(
        () => resolvePendoloClockworkBox(
          centerX,
          centerY,
          baseRadius,
          lyricRingRadius,
          viewportWidth,
          viewportHeight,
          showCenterGradient,
          mirrored,
          Boolean(projection && !projection.flat)
        ),
        [baseRadius, centerX, centerY, lyricRingRadius, mirrored, projection, showCenterGradient, viewportHeight, viewportWidth]
      );
      const projectionMatrix = mirrored || projection && !projection.flat ? projection?.matrix ?? null : null;
      const propsRef = useRef({
        contentBox,
        centerX,
        centerY,
        baseRadius,
        lyricRingRadius,
        audioBass,
        primaryTextColor,
        accentTextColor,
        backgroundColor,
        showGearDecor,
        showCenterGradient,
        showCover,
        coverUrl,
        enableLineGlow,
        paused,
        motionProfile,
        renderScale,
        projectionMatrix,
        projectionPerspective: Boolean(projection && !projection.flat),
        mirrored,
        parallaxScalePx: projection && !projection.flat ? parallaxScalePx : 0,
        parallaxLift: projection?.lift,
        parallaxInvFocal: projection?.invFocal
      });
      useEffect(() => {
        propsRef.current = {
          contentBox,
          centerX,
          centerY,
          baseRadius,
          lyricRingRadius,
          audioBass,
          primaryTextColor,
          accentTextColor,
          backgroundColor,
          showGearDecor,
          showCenterGradient,
          showCover,
          coverUrl,
          enableLineGlow,
          paused,
          motionProfile,
          renderScale,
          projectionMatrix,
          projectionPerspective: Boolean(projection && !projection.flat),
          mirrored,
          parallaxScalePx: projection && !projection.flat ? parallaxScalePx : 0,
          parallaxLift: projection?.lift,
          parallaxInvFocal: projection?.invFocal
        };
      }, [
        projectionMatrix,
        projection,
        mirrored,
        parallaxScalePx,
        contentBox,
        centerX,
        centerY,
        baseRadius,
        lyricRingRadius,
        audioBass,
        primaryTextColor,
        accentTextColor,
        backgroundColor,
        showGearDecor,
        showCenterGradient,
        showCover,
        coverUrl,
        enableLineGlow,
        paused,
        motionProfile,
        renderScale
      ]);
      useEffect(() => {
        if (showGearDecor !== "none" || showCenterGradient || showCover) return;
        lastBackendRef.current = null;
        onBackendChangeRef.current?.(true);
      }, [showGearDecor, showCenterGradient, showCover]);
      useEffect(() => {
        coverImageRef.current = null;
        coverNeeds2dRef.current = false;
        if (!showCover || !coverUrl) return void 0;
        let origin = "";
        try {
          origin = new URL(coverUrl, window.location.href).origin;
        } catch {
          origin = "";
        }
        coverNeeds2dRef.current = noCorsCoverOriginsRef.current.has(origin);
        let cancelled = false;
        let img = null;
        const load = (crossOrigin) => {
          const next = new Image();
          if (crossOrigin) next.crossOrigin = "anonymous";
          next.onload = () => {
            if (cancelled) return;
            coverImageRef.current = next;
            coverNeeds2dRef.current = !crossOrigin;
            if (crossOrigin) noCorsCoverOriginsRef.current.delete(origin);
            else noCorsCoverOriginsRef.current.add(origin);
          };
          next.onerror = () => {
            if (cancelled) return;
            if (crossOrigin) {
              load(false);
            } else {
              coverImageRef.current = null;
              coverNeeds2dRef.current = false;
            }
          };
          next.src = coverUrl;
          img = next;
        };
        load(true);
        return () => {
          cancelled = true;
          if (img) {
            img.onload = null;
            img.onerror = null;
          }
        };
      }, [coverUrl, showCover]);
      useEffect(() => {
        const webglCanvas = webglCanvasRef.current;
        if (rendererRef.current && rendererRef.current.canvas !== webglCanvas) {
          rendererRef.current.release();
          rendererRef.current = null;
          useWebglRef.current = false;
        }
        if (showGearDecor === "none" && !showCenterGradient && !showCover) return void 0;
        const attachRenderer = () => {
          if (!webglCanvas || rendererRef.current) return;
          const created = new PendoloClockworkRenderer(webglCanvas, antialias, depthStencil);
          if (created.isReady) {
            rendererRef.current = created;
            useWebglRef.current = true;
            if (canvas2dRef.current) canvas2dRef.current.style.visibility = "hidden";
          } else {
            created.release();
            useWebglRef.current = false;
            webglCanvas.style.visibility = "hidden";
            if (canvas2dRef.current) canvas2dRef.current.style.visibility = "visible";
          }
        };
        attachRenderer();
        const handleContextLost = (event) => {
          event.preventDefault();
          rendererRef.current?.dispose();
          rendererRef.current = null;
          useWebglRef.current = false;
        };
        const handleContextRestored = () => attachRenderer();
        webglCanvas?.addEventListener("webglcontextlost", handleContextLost);
        webglCanvas?.addEventListener("webglcontextrestored", handleContextRestored);
        let animationFrameId = 0;
        const render = (timestamp) => {
          const p = propsRef.current;
          if (p.showGearDecor === "none" && !p.showCenterGradient && !p.showCover) return;
          if (lastTimestampRef.current === null) {
            lastTimestampRef.current = timestamp;
          }
          const dt = Math.min((timestamp - lastTimestampRef.current) / 1e3, 0.05);
          lastTimestampRef.current = timestamp;
          const rawBass = audioBassMotionValue ? audioBassMotionValue.get() : p.audioBass;
          const gearBeats = beatFxRef?.current.active && getBeatEffectStrength(BEAT_EFFECT_IDS.pendoloGearBeats) > 0;
          const beatFx = beatFxRef?.current.active ? beatFxRef.current : null;
          let beatInput = null;
          if (gearBeats) {
            const triggers = readPendoloBeatTriggers(beatCounterRef.current, beatTriggersRef.current);
            beatInput = beatInputRef.current;
            beatInput.beats = triggers.beats;
            beatInput.downbeats = triggers.downbeats;
            beatInput.beatGain = triggers.beatGain;
            beatInput.downbeatGain = triggers.downbeatGain;
          } else {
            beatCounterRef.current.synced = false;
          }
          const motion2 = stepPendoloClockworkMotion(
            motionStateRef.current,
            dt,
            rawBass,
            p.paused,
            p.motionProfile,
            beatInput
          );
          const escapementAngle = escapementAngleMotionValue.get();
          const box = p.contentBox;
          const frame = {
            centerX: p.centerX - box.left,
            centerY: p.centerY - box.top,
            baseRadius: p.baseRadius,
            lyricRingRadius: p.lyricRingRadius,
            escapementAngle,
            phase: motion2.phase,
            bassOscillation: motion2.bassOscillation,
            secondGearAngle: motion2.secondGearAngle,
            transBeatAngle: motion2.transBeatAngle,
            primaryTextColor: p.primaryTextColor,
            accentTextColor: p.accentTextColor,
            backgroundColor: p.backgroundColor || "#000000",
            showGearDecor: p.showGearDecor,
            showCenterGradient: p.showCenterGradient,
            showCover: p.showCover,
            coverImage: coverImageRef.current,
            projection: p.projectionMatrix,
            projectionPerspective: p.projectionPerspective,
            mirrored: p.mirrored,
            parallaxScalePx: p.parallaxScalePx,
            parallaxLift: p.parallaxLift,
            parallaxInvFocal: p.parallaxInvFocal
          };
          let fxFrame = null;
          if (beatFx && !(beatFx.wave === null && isPendoloBeatFxIdle(beatFx.state, beatFx.now))) {
            fxFrame = beatFxFrameRef.current ?? {
              jewelFlare: 0,
              smallJewelFlare: 0,
              tickDialLight: 0,
              outerDialLight: 0,
              sparks: beatFx.state.sparks,
              offsetX: 0,
              offsetY: 0,
              wave: null,
              color: beatFx.color
            };
            beatFxFrameRef.current = fxFrame;
            fxFrame.jewelFlare = beatFx.state.jewelFlare;
            fxFrame.smallJewelFlare = beatFx.state.smallJewelFlare;
            fxFrame.tickDialLight = beatFx.state.tickDialLight;
            fxFrame.outerDialLight = beatFx.state.outerDialLight;
            fxFrame.sparks = beatFx.state.sparks;
            fxFrame.offsetX = box.left;
            fxFrame.offsetY = box.top;
            fxFrame.wave = beatFx.wave;
            fxFrame.color = beatFx.color;
          }
          const width = box.width;
          const height = box.height;
          if (width <= 0 || height <= 0) {
            animationFrameId = window.requestAnimationFrame(render);
            return;
          }
          const dpr = resolveLyricPixelRatio(window.devicePixelRatio || 1, p.renderScale);
          const renderer = rendererRef.current;
          if (useWebglRef.current && !renderer?.isReady) useWebglRef.current = false;
          const coverNeeds2d = Boolean(
            frame.showCover && (coverNeeds2dRef.current || renderer?.isCoverRejected(frame.coverImage))
          );
          const drawWebgl = Boolean(useWebglRef.current && renderer && !coverNeeds2d);
          if (lastBackendRef.current !== drawWebgl) {
            lastBackendRef.current = drawWebgl;
            onBackendChangeRef.current?.(drawWebgl);
          }
          if (drawWebgl && renderer) {
            if (webglCanvasRef.current) webglCanvasRef.current.style.visibility = "visible";
            if (canvas2dRef.current) canvas2dRef.current.style.visibility = "hidden";
            renderer.draw({
              input: frame,
              cssWidth: width,
              cssHeight: height,
              dpr,
              beatFx: fxFrame
            });
          } else {
            if (webglCanvasRef.current) webglCanvasRef.current.style.visibility = "hidden";
            const canvas = canvas2dRef.current;
            if (!canvas) {
              animationFrameId = window.requestAnimationFrame(render);
              return;
            }
            canvas.style.visibility = "visible";
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              animationFrameId = window.requestAnimationFrame(render);
              return;
            }
            const pixelWidth = Math.round(width * dpr);
            const pixelHeight = Math.round(height * dpr);
            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
              canvas.width = pixelWidth;
              canvas.height = pixelHeight;
            }
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            const applyDialTransform = () => {
              const m = frame.projection;
              if (!m) return;
              ctx.translate(frame.centerX, frame.centerY);
              ctx.transform(m[0], m[3], m[1], m[4], 0, 0);
              ctx.translate(-frame.centerX, -frame.centerY);
            };
            ctx.save();
            applyDialTransform();
            drawPendoloClockwork2d(ctx, frame);
            ctx.restore();
            if (fxFrame) {
              if (fxFrame.wave) {
                waveScratchRef.current ??= document.createElement("canvas");
                drawPendoloWaveLens2d(ctx, canvas, waveScratchRef.current, frame, fxFrame.wave, fxFrame.color, width, height);
              }
              ctx.save();
              applyDialTransform();
              drawPendoloBeatFxOverlay2d(ctx, frame, fxFrame);
              ctx.restore();
            }
            ctx.restore();
          }
          animationFrameId = window.requestAnimationFrame(render);
        };
        animationFrameId = window.requestAnimationFrame(render);
        return () => {
          if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
          webglCanvas?.removeEventListener("webglcontextlost", handleContextLost);
          webglCanvas?.removeEventListener("webglcontextrestored", handleContextRestored);
        };
      }, [showGearDecor, showCenterGradient, showCover, audioBassMotionValue, escapementAngleMotionValue, beatFxRef, antialias, depthStencil]);
      useEffect(() => () => {
        rendererRef.current?.release();
        rendererRef.current = null;
      }, []);
      if (showGearDecor === "none" && !showCenterGradient && !showCover) {
        return null;
      }
      const canvasClass = "absolute inset-0 w-full h-full pointer-events-none";
      const boxStyle = {
        left: `${contentBox.left}px`,
        top: `${contentBox.top}px`,
        width: `${contentBox.width}px`,
        height: `${contentBox.height}px`,
        zIndex: 1
      };
      const lineGlow = enableLineGlow ? `drop-shadow(0 0 4px ${colorWithAlpha(accentTextColor, 0.65)}) drop-shadow(0 0 12px ${colorWithAlpha(accentTextColor, 0.3)})` : void 0;
      return /* @__PURE__ */ jsxs("div", { className: "absolute pointer-events-none", style: boxStyle, children: [
        /* @__PURE__ */ jsx(
          "canvas",
          {
            ref: webglCanvasRef,
            className: canvasClass,
            style: { filter: lineGlow },
            "aria-hidden": "true"
          },
          `${antialias ? "msaa" : "plain"}${depthStencil ? "-depth" : ""}`
        ),
        /* @__PURE__ */ jsx(
          "canvas",
          {
            ref: canvas2dRef,
            className: canvasClass,
            style: { visibility: "hidden", filter: lineGlow },
            "aria-hidden": "true"
          }
        )
      ] });
    };
    var PendoloClockworkCanvas_default = PendoloClockworkCanvas;
  
    // src/render/folia/utils/lyrics/alternateText.ts
    var findAlternateText = (alternateTexts, role) => alternateTexts?.find((entry) => entry.role === role && entry.text.trim())?.text.trim() ?? null;
    var resolveTrackText = (source, role) => {
      const directText = role === "translation" ? source.translation : source.romanization;
      return directText?.trim() || findAlternateText(source.alternateTexts, role);
    };
    var resolveLyricSubtitleTracks = (source, mode, isReadable = () => true) => {
      if (!source || mode === "none") {
        return [];
      }
      const roles = mode === "both" ? ["romanization", "translation"] : [mode];
      const tracks = [];
      for (const role of roles) {
        const text = resolveTrackText(source, role);
        if (!text || !isReadable(text)) {
          continue;
        }
        if (tracks.some((track) => track.text === text)) {
          continue;
        }
        tracks.push({ role, text });
      }
      return tracks;
    };
    var resolveSubtitleContentMode = (mode, legacyShowTranslation = true) => mode ?? (legacyShowTranslation ? "translation" : "none");
  
    // src/render/folia/vendor/pretext/dist/generated/bidi-data.js
    var latin1BidiTypes = [
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "S",
      "B",
      "S",
      "WS",
      "B",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "B",
      "B",
      "B",
      "S",
      "WS",
      "ON",
      "ON",
      "ET",
      "ET",
      "ET",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "ES",
      "CS",
      "ES",
      "CS",
      "CS",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "EN",
      "CS",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "ON",
      "ON",
      "ON",
      "ON",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "B",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "CS",
      "ON",
      "ET",
      "ET",
      "ET",
      "ET",
      "ON",
      "ON",
      "ON",
      "ON",
      "L",
      "ON",
      "ON",
      "BN",
      "ON",
      "ON",
      "ET",
      "ET",
      "EN",
      "EN",
      "ON",
      "L",
      "ON",
      "ON",
      "ON",
      "EN",
      "L",
      "ON",
      "ON",
      "ON",
      "ON",
      "ON",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "ON",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "ON",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L",
      "L"
    ];
    var nonLatin1BidiRanges = [
      [697, 698, "ON"],
      [706, 719, "ON"],
      [722, 735, "ON"],
      [741, 749, "ON"],
      [751, 767, "ON"],
      [768, 879, "NSM"],
      [884, 885, "ON"],
      [894, 894, "ON"],
      [900, 901, "ON"],
      [903, 903, "ON"],
      [1014, 1014, "ON"],
      [1155, 1161, "NSM"],
      [1418, 1418, "ON"],
      [1421, 1422, "ON"],
      [1423, 1423, "ET"],
      [1424, 1424, "R"],
      [1425, 1469, "NSM"],
      [1470, 1470, "R"],
      [1471, 1471, "NSM"],
      [1472, 1472, "R"],
      [1473, 1474, "NSM"],
      [1475, 1475, "R"],
      [1476, 1477, "NSM"],
      [1478, 1478, "R"],
      [1479, 1479, "NSM"],
      [1480, 1535, "R"],
      [1536, 1541, "AN"],
      [1542, 1543, "ON"],
      [1544, 1544, "AL"],
      [1545, 1546, "ET"],
      [1547, 1547, "AL"],
      [1548, 1548, "CS"],
      [1549, 1549, "AL"],
      [1550, 1551, "ON"],
      [1552, 1562, "NSM"],
      [1563, 1610, "AL"],
      [1611, 1631, "NSM"],
      [1632, 1641, "AN"],
      [1642, 1642, "ET"],
      [1643, 1644, "AN"],
      [1645, 1647, "AL"],
      [1648, 1648, "NSM"],
      [1649, 1749, "AL"],
      [1750, 1756, "NSM"],
      [1757, 1757, "AN"],
      [1758, 1758, "ON"],
      [1759, 1764, "NSM"],
      [1765, 1766, "AL"],
      [1767, 1768, "NSM"],
      [1769, 1769, "ON"],
      [1770, 1773, "NSM"],
      [1774, 1775, "AL"],
      [1776, 1785, "EN"],
      [1786, 1808, "AL"],
      [1809, 1809, "NSM"],
      [1810, 1839, "AL"],
      [1840, 1866, "NSM"],
      [1867, 1957, "AL"],
      [1958, 1968, "NSM"],
      [1969, 1983, "AL"],
      [1984, 2026, "R"],
      [2027, 2035, "NSM"],
      [2036, 2037, "R"],
      [2038, 2041, "ON"],
      [2042, 2044, "R"],
      [2045, 2045, "NSM"],
      [2046, 2069, "R"],
      [2070, 2073, "NSM"],
      [2074, 2074, "R"],
      [2075, 2083, "NSM"],
      [2084, 2084, "R"],
      [2085, 2087, "NSM"],
      [2088, 2088, "R"],
      [2089, 2093, "NSM"],
      [2094, 2136, "R"],
      [2137, 2139, "NSM"],
      [2140, 2143, "R"],
      [2144, 2191, "AL"],
      [2192, 2193, "AN"],
      [2194, 2198, "AL"],
      [2199, 2207, "NSM"],
      [2208, 2249, "AL"],
      [2250, 2273, "NSM"],
      [2274, 2274, "AN"],
      [2275, 2306, "NSM"],
      [2362, 2362, "NSM"],
      [2364, 2364, "NSM"],
      [2369, 2376, "NSM"],
      [2381, 2381, "NSM"],
      [2385, 2391, "NSM"],
      [2402, 2403, "NSM"],
      [2433, 2433, "NSM"],
      [2492, 2492, "NSM"],
      [2497, 2500, "NSM"],
      [2509, 2509, "NSM"],
      [2530, 2531, "NSM"],
      [2546, 2547, "ET"],
      [2555, 2555, "ET"],
      [2558, 2558, "NSM"],
      [2561, 2562, "NSM"],
      [2620, 2620, "NSM"],
      [2625, 2626, "NSM"],
      [2631, 2632, "NSM"],
      [2635, 2637, "NSM"],
      [2641, 2641, "NSM"],
      [2672, 2673, "NSM"],
      [2677, 2677, "NSM"],
      [2689, 2690, "NSM"],
      [2748, 2748, "NSM"],
      [2753, 2757, "NSM"],
      [2759, 2760, "NSM"],
      [2765, 2765, "NSM"],
      [2786, 2787, "NSM"],
      [2801, 2801, "ET"],
      [2810, 2815, "NSM"],
      [2817, 2817, "NSM"],
      [2876, 2876, "NSM"],
      [2879, 2879, "NSM"],
      [2881, 2884, "NSM"],
      [2893, 2893, "NSM"],
      [2901, 2902, "NSM"],
      [2914, 2915, "NSM"],
      [2946, 2946, "NSM"],
      [3008, 3008, "NSM"],
      [3021, 3021, "NSM"],
      [3059, 3064, "ON"],
      [3065, 3065, "ET"],
      [3066, 3066, "ON"],
      [3072, 3072, "NSM"],
      [3076, 3076, "NSM"],
      [3132, 3132, "NSM"],
      [3134, 3136, "NSM"],
      [3142, 3144, "NSM"],
      [3146, 3149, "NSM"],
      [3157, 3158, "NSM"],
      [3170, 3171, "NSM"],
      [3192, 3198, "ON"],
      [3201, 3201, "NSM"],
      [3260, 3260, "NSM"],
      [3276, 3277, "NSM"],
      [3298, 3299, "NSM"],
      [3328, 3329, "NSM"],
      [3387, 3388, "NSM"],
      [3393, 3396, "NSM"],
      [3405, 3405, "NSM"],
      [3426, 3427, "NSM"],
      [3457, 3457, "NSM"],
      [3530, 3530, "NSM"],
      [3538, 3540, "NSM"],
      [3542, 3542, "NSM"],
      [3633, 3633, "NSM"],
      [3636, 3642, "NSM"],
      [3647, 3647, "ET"],
      [3655, 3662, "NSM"],
      [3761, 3761, "NSM"],
      [3764, 3772, "NSM"],
      [3784, 3790, "NSM"],
      [3864, 3865, "NSM"],
      [3893, 3893, "NSM"],
      [3895, 3895, "NSM"],
      [3897, 3897, "NSM"],
      [3898, 3901, "ON"],
      [3953, 3966, "NSM"],
      [3968, 3972, "NSM"],
      [3974, 3975, "NSM"],
      [3981, 3991, "NSM"],
      [3993, 4028, "NSM"],
      [4038, 4038, "NSM"],
      [4141, 4144, "NSM"],
      [4146, 4151, "NSM"],
      [4153, 4154, "NSM"],
      [4157, 4158, "NSM"],
      [4184, 4185, "NSM"],
      [4190, 4192, "NSM"],
      [4209, 4212, "NSM"],
      [4226, 4226, "NSM"],
      [4229, 4230, "NSM"],
      [4237, 4237, "NSM"],
      [4253, 4253, "NSM"],
      [4957, 4959, "NSM"],
      [5008, 5017, "ON"],
      [5120, 5120, "ON"],
      [5760, 5760, "WS"],
      [5787, 5788, "ON"],
      [5906, 5908, "NSM"],
      [5938, 5939, "NSM"],
      [5970, 5971, "NSM"],
      [6002, 6003, "NSM"],
      [6068, 6069, "NSM"],
      [6071, 6077, "NSM"],
      [6086, 6086, "NSM"],
      [6089, 6099, "NSM"],
      [6107, 6107, "ET"],
      [6109, 6109, "NSM"],
      [6128, 6137, "ON"],
      [6144, 6154, "ON"],
      [6155, 6157, "NSM"],
      [6158, 6158, "BN"],
      [6159, 6159, "NSM"],
      [6277, 6278, "NSM"],
      [6313, 6313, "NSM"],
      [6432, 6434, "NSM"],
      [6439, 6440, "NSM"],
      [6450, 6450, "NSM"],
      [6457, 6459, "NSM"],
      [6464, 6464, "ON"],
      [6468, 6469, "ON"],
      [6622, 6655, "ON"],
      [6679, 6680, "NSM"],
      [6683, 6683, "NSM"],
      [6742, 6742, "NSM"],
      [6744, 6750, "NSM"],
      [6752, 6752, "NSM"],
      [6754, 6754, "NSM"],
      [6757, 6764, "NSM"],
      [6771, 6780, "NSM"],
      [6783, 6783, "NSM"],
      [6832, 6877, "NSM"],
      [6880, 6891, "NSM"],
      [6912, 6915, "NSM"],
      [6964, 6964, "NSM"],
      [6966, 6970, "NSM"],
      [6972, 6972, "NSM"],
      [6978, 6978, "NSM"],
      [7019, 7027, "NSM"],
      [7040, 7041, "NSM"],
      [7074, 7077, "NSM"],
      [7080, 7081, "NSM"],
      [7083, 7085, "NSM"],
      [7142, 7142, "NSM"],
      [7144, 7145, "NSM"],
      [7149, 7149, "NSM"],
      [7151, 7153, "NSM"],
      [7212, 7219, "NSM"],
      [7222, 7223, "NSM"],
      [7376, 7378, "NSM"],
      [7380, 7392, "NSM"],
      [7394, 7400, "NSM"],
      [7405, 7405, "NSM"],
      [7412, 7412, "NSM"],
      [7416, 7417, "NSM"],
      [7616, 7679, "NSM"],
      [8125, 8125, "ON"],
      [8127, 8129, "ON"],
      [8141, 8143, "ON"],
      [8157, 8159, "ON"],
      [8173, 8175, "ON"],
      [8189, 8190, "ON"],
      [8192, 8202, "WS"],
      [8203, 8205, "BN"],
      [8207, 8207, "R"],
      [8208, 8231, "ON"],
      [8232, 8232, "WS"],
      [8233, 8233, "B"],
      [8234, 8238, "BN"],
      [8239, 8239, "CS"],
      [8240, 8244, "ET"],
      [8245, 8259, "ON"],
      [8260, 8260, "CS"],
      [8261, 8286, "ON"],
      [8287, 8287, "WS"],
      [8288, 8303, "BN"],
      [8304, 8304, "EN"],
      [8308, 8313, "EN"],
      [8314, 8315, "ES"],
      [8316, 8318, "ON"],
      [8320, 8329, "EN"],
      [8330, 8331, "ES"],
      [8332, 8334, "ON"],
      [8352, 8399, "ET"],
      [8400, 8432, "NSM"],
      [8448, 8449, "ON"],
      [8451, 8454, "ON"],
      [8456, 8457, "ON"],
      [8468, 8468, "ON"],
      [8470, 8472, "ON"],
      [8478, 8483, "ON"],
      [8485, 8485, "ON"],
      [8487, 8487, "ON"],
      [8489, 8489, "ON"],
      [8494, 8494, "ET"],
      [8506, 8507, "ON"],
      [8512, 8516, "ON"],
      [8522, 8525, "ON"],
      [8528, 8543, "ON"],
      [8585, 8587, "ON"],
      [8592, 8721, "ON"],
      [8722, 8722, "ES"],
      [8723, 8723, "ET"],
      [8724, 9013, "ON"],
      [9083, 9108, "ON"],
      [9110, 9257, "ON"],
      [9280, 9290, "ON"],
      [9312, 9351, "ON"],
      [9352, 9371, "EN"],
      [9450, 9899, "ON"],
      [9901, 10239, "ON"],
      [10496, 11123, "ON"],
      [11126, 11263, "ON"],
      [11493, 11498, "ON"],
      [11503, 11505, "NSM"],
      [11513, 11519, "ON"],
      [11647, 11647, "NSM"],
      [11744, 11775, "NSM"],
      [11776, 11869, "ON"],
      [11904, 11929, "ON"],
      [11931, 12019, "ON"],
      [12032, 12245, "ON"],
      [12272, 12287, "ON"],
      [12288, 12288, "WS"],
      [12289, 12292, "ON"],
      [12296, 12320, "ON"],
      [12330, 12333, "NSM"],
      [12336, 12336, "ON"],
      [12342, 12343, "ON"],
      [12349, 12351, "ON"],
      [12441, 12442, "NSM"],
      [12443, 12444, "ON"],
      [12448, 12448, "ON"],
      [12539, 12539, "ON"],
      [12736, 12773, "ON"],
      [12783, 12783, "ON"],
      [12829, 12830, "ON"],
      [12880, 12895, "ON"],
      [12924, 12926, "ON"],
      [12977, 12991, "ON"],
      [13004, 13007, "ON"],
      [13175, 13178, "ON"],
      [13278, 13279, "ON"],
      [13311, 13311, "ON"],
      [19904, 19967, "ON"],
      [42128, 42182, "ON"],
      [42509, 42511, "ON"],
      [42607, 42610, "NSM"],
      [42611, 42611, "ON"],
      [42612, 42621, "NSM"],
      [42622, 42623, "ON"],
      [42654, 42655, "NSM"],
      [42736, 42737, "NSM"],
      [42752, 42785, "ON"],
      [42888, 42888, "ON"],
      [43010, 43010, "NSM"],
      [43014, 43014, "NSM"],
      [43019, 43019, "NSM"],
      [43045, 43046, "NSM"],
      [43048, 43051, "ON"],
      [43052, 43052, "NSM"],
      [43064, 43065, "ET"],
      [43124, 43127, "ON"],
      [43204, 43205, "NSM"],
      [43232, 43249, "NSM"],
      [43263, 43263, "NSM"],
      [43302, 43309, "NSM"],
      [43335, 43345, "NSM"],
      [43392, 43394, "NSM"],
      [43443, 43443, "NSM"],
      [43446, 43449, "NSM"],
      [43452, 43453, "NSM"],
      [43493, 43493, "NSM"],
      [43561, 43566, "NSM"],
      [43569, 43570, "NSM"],
      [43573, 43574, "NSM"],
      [43587, 43587, "NSM"],
      [43596, 43596, "NSM"],
      [43644, 43644, "NSM"],
      [43696, 43696, "NSM"],
      [43698, 43700, "NSM"],
      [43703, 43704, "NSM"],
      [43710, 43711, "NSM"],
      [43713, 43713, "NSM"],
      [43756, 43757, "NSM"],
      [43766, 43766, "NSM"],
      [43882, 43883, "ON"],
      [44005, 44005, "NSM"],
      [44008, 44008, "NSM"],
      [44013, 44013, "NSM"],
      [64285, 64285, "R"],
      [64286, 64286, "NSM"],
      [64287, 64296, "R"],
      [64297, 64297, "ES"],
      [64298, 64335, "R"],
      [64336, 64450, "AL"],
      [64451, 64466, "ON"],
      [64467, 64829, "AL"],
      [64830, 64847, "ON"],
      [64848, 64911, "AL"],
      [64912, 64913, "ON"],
      [64914, 64967, "AL"],
      [64968, 64975, "ON"],
      [64976, 65007, "BN"],
      [65008, 65020, "AL"],
      [65021, 65023, "ON"],
      [65024, 65039, "NSM"],
      [65040, 65049, "ON"],
      [65056, 65071, "NSM"],
      [65072, 65103, "ON"],
      [65104, 65104, "CS"],
      [65105, 65105, "ON"],
      [65106, 65106, "CS"],
      [65108, 65108, "ON"],
      [65109, 65109, "CS"],
      [65110, 65118, "ON"],
      [65119, 65119, "ET"],
      [65120, 65121, "ON"],
      [65122, 65123, "ES"],
      [65124, 65126, "ON"],
      [65128, 65128, "ON"],
      [65129, 65130, "ET"],
      [65131, 65131, "ON"],
      [65136, 65278, "AL"],
      [65279, 65279, "BN"],
      [65281, 65282, "ON"],
      [65283, 65285, "ET"],
      [65286, 65290, "ON"],
      [65291, 65291, "ES"],
      [65292, 65292, "CS"],
      [65293, 65293, "ES"],
      [65294, 65295, "CS"],
      [65296, 65305, "EN"],
      [65306, 65306, "CS"],
      [65307, 65312, "ON"],
      [65339, 65344, "ON"],
      [65371, 65381, "ON"],
      [65504, 65505, "ET"],
      [65506, 65508, "ON"],
      [65509, 65510, "ET"],
      [65512, 65518, "ON"],
      [65520, 65528, "BN"],
      [65529, 65533, "ON"],
      [65534, 65535, "BN"],
      [65793, 65793, "ON"],
      [65856, 65932, "ON"],
      [65936, 65948, "ON"],
      [65952, 65952, "ON"],
      [66045, 66045, "NSM"],
      [66272, 66272, "NSM"],
      [66273, 66299, "EN"],
      [66422, 66426, "NSM"],
      [67584, 67870, "R"],
      [67871, 67871, "ON"],
      [67872, 68096, "R"],
      [68097, 68099, "NSM"],
      [68100, 68100, "R"],
      [68101, 68102, "NSM"],
      [68103, 68107, "R"],
      [68108, 68111, "NSM"],
      [68112, 68151, "R"],
      [68152, 68154, "NSM"],
      [68155, 68158, "R"],
      [68159, 68159, "NSM"],
      [68160, 68324, "R"],
      [68325, 68326, "NSM"],
      [68327, 68408, "R"],
      [68409, 68415, "ON"],
      [68416, 68863, "R"],
      [68864, 68899, "AL"],
      [68900, 68903, "NSM"],
      [68904, 68911, "AL"],
      [68912, 68921, "AN"],
      [68922, 68927, "AL"],
      [68928, 68937, "AN"],
      [68938, 68968, "R"],
      [68969, 68973, "NSM"],
      [68974, 68974, "ON"],
      [68975, 69215, "R"],
      [69216, 69246, "AN"],
      [69247, 69290, "R"],
      [69291, 69292, "NSM"],
      [69293, 69311, "R"],
      [69312, 69327, "AL"],
      [69328, 69336, "ON"],
      [69337, 69369, "AL"],
      [69370, 69375, "NSM"],
      [69376, 69423, "R"],
      [69424, 69445, "AL"],
      [69446, 69456, "NSM"],
      [69457, 69487, "AL"],
      [69488, 69505, "R"],
      [69506, 69509, "NSM"],
      [69510, 69631, "R"],
      [69633, 69633, "NSM"],
      [69688, 69702, "NSM"],
      [69714, 69733, "ON"],
      [69744, 69744, "NSM"],
      [69747, 69748, "NSM"],
      [69759, 69761, "NSM"],
      [69811, 69814, "NSM"],
      [69817, 69818, "NSM"],
      [69826, 69826, "NSM"],
      [69888, 69890, "NSM"],
      [69927, 69931, "NSM"],
      [69933, 69940, "NSM"],
      [70003, 70003, "NSM"],
      [70016, 70017, "NSM"],
      [70070, 70078, "NSM"],
      [70089, 70092, "NSM"],
      [70095, 70095, "NSM"],
      [70191, 70193, "NSM"],
      [70196, 70196, "NSM"],
      [70198, 70199, "NSM"],
      [70206, 70206, "NSM"],
      [70209, 70209, "NSM"],
      [70367, 70367, "NSM"],
      [70371, 70378, "NSM"],
      [70400, 70401, "NSM"],
      [70459, 70460, "NSM"],
      [70464, 70464, "NSM"],
      [70502, 70508, "NSM"],
      [70512, 70516, "NSM"],
      [70587, 70592, "NSM"],
      [70606, 70606, "NSM"],
      [70608, 70608, "NSM"],
      [70610, 70610, "NSM"],
      [70625, 70626, "NSM"],
      [70712, 70719, "NSM"],
      [70722, 70724, "NSM"],
      [70726, 70726, "NSM"],
      [70750, 70750, "NSM"],
      [70835, 70840, "NSM"],
      [70842, 70842, "NSM"],
      [70847, 70848, "NSM"],
      [70850, 70851, "NSM"],
      [71090, 71093, "NSM"],
      [71100, 71101, "NSM"],
      [71103, 71104, "NSM"],
      [71132, 71133, "NSM"],
      [71219, 71226, "NSM"],
      [71229, 71229, "NSM"],
      [71231, 71232, "NSM"],
      [71264, 71276, "ON"],
      [71339, 71339, "NSM"],
      [71341, 71341, "NSM"],
      [71344, 71349, "NSM"],
      [71351, 71351, "NSM"],
      [71453, 71453, "NSM"],
      [71455, 71455, "NSM"],
      [71458, 71461, "NSM"],
      [71463, 71467, "NSM"],
      [71727, 71735, "NSM"],
      [71737, 71738, "NSM"],
      [71995, 71996, "NSM"],
      [71998, 71998, "NSM"],
      [72003, 72003, "NSM"],
      [72148, 72151, "NSM"],
      [72154, 72155, "NSM"],
      [72160, 72160, "NSM"],
      [72193, 72198, "NSM"],
      [72201, 72202, "NSM"],
      [72243, 72248, "NSM"],
      [72251, 72254, "NSM"],
      [72263, 72263, "NSM"],
      [72273, 72278, "NSM"],
      [72281, 72283, "NSM"],
      [72330, 72342, "NSM"],
      [72344, 72345, "NSM"],
      [72544, 72544, "NSM"],
      [72546, 72548, "NSM"],
      [72550, 72550, "NSM"],
      [72752, 72758, "NSM"],
      [72760, 72765, "NSM"],
      [72850, 72871, "NSM"],
      [72874, 72880, "NSM"],
      [72882, 72883, "NSM"],
      [72885, 72886, "NSM"],
      [73009, 73014, "NSM"],
      [73018, 73018, "NSM"],
      [73020, 73021, "NSM"],
      [73023, 73029, "NSM"],
      [73031, 73031, "NSM"],
      [73104, 73105, "NSM"],
      [73109, 73109, "NSM"],
      [73111, 73111, "NSM"],
      [73459, 73460, "NSM"],
      [73472, 73473, "NSM"],
      [73526, 73530, "NSM"],
      [73536, 73536, "NSM"],
      [73538, 73538, "NSM"],
      [73562, 73562, "NSM"],
      [73685, 73692, "ON"],
      [73693, 73696, "ET"],
      [73697, 73713, "ON"],
      [78912, 78912, "NSM"],
      [78919, 78933, "NSM"],
      [90398, 90409, "NSM"],
      [90413, 90415, "NSM"],
      [92912, 92916, "NSM"],
      [92976, 92982, "NSM"],
      [94031, 94031, "NSM"],
      [94095, 94098, "NSM"],
      [94178, 94178, "ON"],
      [94180, 94180, "NSM"],
      [113821, 113822, "NSM"],
      [113824, 113827, "BN"],
      [117760, 117973, "ON"],
      [118e3, 118009, "EN"],
      [118010, 118012, "ON"],
      [118016, 118451, "ON"],
      [118458, 118480, "ON"],
      [118496, 118512, "ON"],
      [118528, 118573, "NSM"],
      [118576, 118598, "NSM"],
      [119143, 119145, "NSM"],
      [119155, 119162, "BN"],
      [119163, 119170, "NSM"],
      [119173, 119179, "NSM"],
      [119210, 119213, "NSM"],
      [119273, 119274, "ON"],
      [119296, 119361, "ON"],
      [119362, 119364, "NSM"],
      [119365, 119365, "ON"],
      [119552, 119638, "ON"],
      [120513, 120513, "ON"],
      [120539, 120539, "ON"],
      [120571, 120571, "ON"],
      [120597, 120597, "ON"],
      [120629, 120629, "ON"],
      [120655, 120655, "ON"],
      [120687, 120687, "ON"],
      [120713, 120713, "ON"],
      [120745, 120745, "ON"],
      [120771, 120771, "ON"],
      [120782, 120831, "EN"],
      [121344, 121398, "NSM"],
      [121403, 121452, "NSM"],
      [121461, 121461, "NSM"],
      [121476, 121476, "NSM"],
      [121499, 121503, "NSM"],
      [121505, 121519, "NSM"],
      [122880, 122886, "NSM"],
      [122888, 122904, "NSM"],
      [122907, 122913, "NSM"],
      [122915, 122916, "NSM"],
      [122918, 122922, "NSM"],
      [123023, 123023, "NSM"],
      [123184, 123190, "NSM"],
      [123566, 123566, "NSM"],
      [123628, 123631, "NSM"],
      [123647, 123647, "ET"],
      [124140, 124143, "NSM"],
      [124398, 124399, "NSM"],
      [124643, 124643, "NSM"],
      [124646, 124646, "NSM"],
      [124654, 124655, "NSM"],
      [124661, 124661, "NSM"],
      [124928, 125135, "R"],
      [125136, 125142, "NSM"],
      [125143, 125251, "R"],
      [125252, 125258, "NSM"],
      [125259, 126063, "R"],
      [126064, 126143, "AL"],
      [126144, 126207, "R"],
      [126208, 126287, "AL"],
      [126288, 126463, "R"],
      [126464, 126703, "AL"],
      [126704, 126705, "ON"],
      [126706, 126719, "AL"],
      [126720, 126975, "R"],
      [126976, 127019, "ON"],
      [127024, 127123, "ON"],
      [127136, 127150, "ON"],
      [127153, 127167, "ON"],
      [127169, 127183, "ON"],
      [127185, 127221, "ON"],
      [127232, 127242, "EN"],
      [127243, 127247, "ON"],
      [127279, 127279, "ON"],
      [127338, 127343, "ON"],
      [127405, 127405, "ON"],
      [127584, 127589, "ON"],
      [127744, 128728, "ON"],
      [128732, 128748, "ON"],
      [128752, 128764, "ON"],
      [128768, 128985, "ON"],
      [128992, 129003, "ON"],
      [129008, 129008, "ON"],
      [129024, 129035, "ON"],
      [129040, 129095, "ON"],
      [129104, 129113, "ON"],
      [129120, 129159, "ON"],
      [129168, 129197, "ON"],
      [129200, 129211, "ON"],
      [129216, 129217, "ON"],
      [129232, 129240, "ON"],
      [129280, 129623, "ON"],
      [129632, 129645, "ON"],
      [129648, 129660, "ON"],
      [129664, 129674, "ON"],
      [129678, 129734, "ON"],
      [129736, 129736, "ON"],
      [129741, 129756, "ON"],
      [129759, 129770, "ON"],
      [129775, 129784, "ON"],
      [129792, 129938, "ON"],
      [129940, 130031, "ON"],
      [130032, 130041, "EN"],
      [130042, 130042, "ON"],
      [131070, 131071, "BN"],
      [196606, 196607, "BN"],
      [262142, 262143, "BN"],
      [327678, 327679, "BN"],
      [393214, 393215, "BN"],
      [458750, 458751, "BN"],
      [524286, 524287, "BN"],
      [589822, 589823, "BN"],
      [655358, 655359, "BN"],
      [720894, 720895, "BN"],
      [786430, 786431, "BN"],
      [851966, 851967, "BN"],
      [917502, 917759, "BN"],
      [917760, 917999, "NSM"],
      [918e3, 921599, "BN"],
      [983038, 983039, "BN"],
      [1048574, 1048575, "BN"],
      [1114110, 1114111, "BN"]
    ];
  
    // src/render/folia/vendor/pretext/dist/bidi.js
    function classifyCodePoint(codePoint) {
      if (codePoint <= 255)
        return latin1BidiTypes[codePoint];
      let lo = 0;
      let hi = nonLatin1BidiRanges.length - 1;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        const range = nonLatin1BidiRanges[mid];
        if (codePoint < range[0]) {
          hi = mid - 1;
          continue;
        }
        if (codePoint > range[1]) {
          lo = mid + 1;
          continue;
        }
        return range[2];
      }
      return "L";
    }
    function computeBidiLevels(str) {
      const len = str.length;
      if (len === 0)
        return null;
      const types = new Array(len);
      let paragraphHasBidi = false;
      let paragraphStart = 0;
      let levels = null;
      for (let i = 0; i < len; ) {
        const first = str.charCodeAt(i);
        let codePoint = first;
        let codeUnitLength = 1;
        if (first >= 55296 && first <= 56319 && i + 1 < len) {
          const second = str.charCodeAt(i + 1);
          if (second >= 56320 && second <= 57343) {
            codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
            codeUnitLength = 2;
          }
        }
        const t = classifyCodePoint(codePoint);
        if (t === "R" || t === "AL" || t === "AN")
          paragraphHasBidi = true;
        for (let j = 0; j < codeUnitLength; j++) {
          types[i + j] = t;
        }
        if (t === "B") {
          if (paragraphHasBidi) {
            levels ??= new Int8Array(len);
            levels[i] = resolveParagraphLevels(types, levels, paragraphStart, i);
          }
          paragraphStart = i + codeUnitLength;
          paragraphHasBidi = false;
        }
        i += codeUnitLength;
      }
      if (paragraphHasBidi) {
        levels ??= new Int8Array(len);
        resolveParagraphLevels(types, levels, paragraphStart, len);
      }
      return levels;
    }
    function resolveParagraphLevels(types, levels, start, end) {
      let startLevel = 0;
      for (let i = start; i < end; i++) {
        const t = types[i];
        if (t === "L") {
          startLevel = 0;
          break;
        }
        if (t === "R" || t === "AL") {
          startLevel = 1;
          break;
        }
      }
      const e = startLevel & 1 ? "R" : "L";
      const sor = e;
      let lastType = sor;
      for (let i = start; i < end; i++) {
        if (types[i] === "NSM")
          types[i] = lastType;
        else
          lastType = types[i];
      }
      lastType = sor;
      for (let i = start; i < end; i++) {
        const t = types[i];
        if (t === "EN")
          types[i] = lastType === "AL" ? "AN" : "EN";
        else if (t === "R" || t === "L" || t === "AL")
          lastType = t;
      }
      for (let i = start; i < end; i++) {
        if (types[i] === "AL")
          types[i] = "R";
      }
      for (let i = start + 1; i < end - 1; i++) {
        if (types[i] === "ES" && types[i - 1] === "EN" && types[i + 1] === "EN") {
          types[i] = "EN";
        }
        if (types[i] === "CS" && (types[i - 1] === "EN" || types[i - 1] === "AN") && types[i + 1] === types[i - 1]) {
          types[i] = types[i - 1];
        }
      }
      for (let i = start; i < end; i++) {
        if (types[i] !== "EN")
          continue;
        let j;
        for (j = i - 1; j >= start && types[j] === "ET"; j--)
          types[j] = "EN";
        for (j = i + 1; j < end && types[j] === "ET"; j++)
          types[j] = "EN";
      }
      for (let i = start; i < end; i++) {
        const t = types[i];
        if (t === "WS" || t === "ES" || t === "ET" || t === "CS")
          types[i] = "ON";
      }
      lastType = sor;
      for (let i = start; i < end; i++) {
        const t = types[i];
        if (t === "EN")
          types[i] = lastType === "L" ? "L" : "EN";
        else if (t === "R" || t === "L")
          lastType = t;
      }
      for (let i = start; i < end; i++) {
        if (types[i] !== "ON")
          continue;
        let runEnd = i + 1;
        while (runEnd < end && types[runEnd] === "ON")
          runEnd++;
        const before = i > start ? types[i - 1] : sor;
        const after = runEnd < end ? types[runEnd] : sor;
        const bDir = before !== "L" ? "R" : "L";
        const aDir = after !== "L" ? "R" : "L";
        if (bDir === aDir) {
          for (let j = i; j < runEnd; j++)
            types[j] = bDir;
        }
        i = runEnd - 1;
      }
      for (let i = start; i < end; i++) {
        if (types[i] === "ON")
          types[i] = e;
      }
      for (let i = start; i < end; i++) {
        const t = types[i];
        let level = startLevel;
        if ((startLevel & 1) === 0) {
          if (t === "R")
            level++;
          else if (t === "AN" || t === "EN")
            level += 2;
        } else if (t === "L" || t === "AN" || t === "EN") {
          level++;
        }
        levels[i] = level;
      }
      return startLevel;
    }
    function computeSegmentLevels(normalized, segStarts) {
      const bidiLevels = computeBidiLevels(normalized);
      if (bidiLevels === null)
        return null;
      const segLevels = new Int8Array(segStarts.length);
      for (let i = 0; i < segStarts.length; i++) {
        segLevels[i] = bidiLevels[segStarts[i]];
      }
      return segLevels;
    }
  
    // src/render/folia/vendor/pretext/dist/analysis.js
    var collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
    var needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
    function normalizeWhitespaceNormal(text) {
      if (!needsWhitespaceNormalizationRe.test(text))
        return text;
      let normalized = text.replace(collapsibleWhitespaceRunRe, " ");
      if (normalized.charCodeAt(0) === 32) {
        normalized = normalized.slice(1);
      }
      if (normalized.length > 0 && normalized.charCodeAt(normalized.length - 1) === 32) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    }
    function normalizeWhitespacePreWrap(text) {
      if (!/[\r\f]/.test(text))
        return text;
      return text.replace(/\r\n/g, "\n").replace(/[\r\f]/g, "\n");
    }
    var sharedGraphemeSegmenter = null;
    function getSharedGraphemeSegmenter() {
      if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
      }
      return sharedGraphemeSegmenter;
    }
    var sharedWordSegmenter = null;
    var segmenterLocale;
    function getSharedWordSegmenter() {
      if (sharedWordSegmenter === null) {
        sharedWordSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: "word" });
      }
      return sharedWordSegmenter;
    }
    var arabicScriptRe = new RegExp("\\p{Script=Arabic}", "u");
    var combiningMarkRe = new RegExp("\\p{M}", "u");
    var decimalDigitRe = new RegExp("\\p{Nd}", "u");
    function containsArabicScript(text) {
      return arabicScriptRe.test(text);
    }
    var cjkRe = /[\u3000-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u{20000}-\u{2A6DF}\u{2A700}-\u{2EE5D}\u{2F800}-\u{2FA1F}\u{30000}-\u{33479}]/u;
    function isCJK(s) {
      return cjkRe.test(s);
    }
    function endsWithLineStartProhibitedText(text) {
      const last = getLastCodePoint(text);
      return last !== null && (kinsokuStart.has(last) || leftStickyPunctuation.has(last));
    }
    var keepAllGlueChars = /* @__PURE__ */ new Set([
      "\xA0",
      "\u202F",
      "\u2060",
      "\uFEFF"
    ]);
    var keepAllDashBreakChars = /* @__PURE__ */ new Set([
      "-",
      "\u2010",
      "\u2013",
      "\u2014"
    ]);
    function endsWithKeepAllGlueText(text) {
      const last = getLastCodePoint(text);
      return last !== null && keepAllGlueChars.has(last);
    }
    function endsWithKeepAllDashBreakText(text) {
      const last = getLastCodePoint(text);
      return last !== null && keepAllDashBreakChars.has(last);
    }
    function canContinueKeepAllTextRun(previousText, breakAfterPunctuation) {
      if (endsWithKeepAllGlueText(previousText))
        return false;
      if (!breakAfterPunctuation)
        return true;
      if (endsWithLineStartProhibitedText(previousText))
        return false;
      if (endsWithKeepAllDashBreakText(previousText))
        return false;
      return true;
    }
    var kinsokuStart = /* @__PURE__ */ new Set([
      "\uFF0C",
      "\uFF0E",
      "\uFF01",
      "\uFF1A",
      "\uFF1B",
      "\uFF1F",
      "\u3001",
      "\u3002",
      "\u30FB",
      "\uFF09",
      "\u3015",
      "\u3009",
      "\u300B",
      "\u300D",
      "\u300F",
      "\u3011",
      "\u3017",
      "\u3019",
      "\u301B",
      "\u30FC",
      "\u3005",
      "\u303B",
      "\u309D",
      "\u309E",
      "\u30FD",
      "\u30FE"
    ]);
    var kinsokuEnd = /* @__PURE__ */ new Set([
      '"',
      "(",
      "[",
      "{",
      "\xA1",
      "\xBF",
      "\u201C",
      "\u2018",
      "\u201A",
      "\u201E",
      "\xAB",
      "\u2039",
      "\u2E18",
      "\uFF08",
      "\u3014",
      "\u3008",
      "\u300A",
      "\u300C",
      "\u300E",
      "\u3010",
      "\u3016",
      "\u3018",
      "\u301A"
    ]);
    var forwardStickyGlue = /* @__PURE__ */ new Set([
      "'",
      "\u2019"
    ]);
    var leftStickyPunctuation = /* @__PURE__ */ new Set([
      ".",
      ",",
      "!",
      "?",
      ":",
      ";",
      "\u060C",
      "\u061B",
      "\u061F",
      "\u0964",
      "\u0965",
      "\u104A",
      "\u104B",
      "\u104C",
      "\u104D",
      "\u104F",
      ")",
      "]",
      "}",
      "%",
      '"',
      "\u201D",
      "\u2019",
      "\xBB",
      "\u203A",
      "\u2026"
    ]);
    var arabicNoSpaceTrailingPunctuation = /* @__PURE__ */ new Set([
      ":",
      ".",
      "\u060C",
      "\u061B"
    ]);
    var myanmarMedialGlue = /* @__PURE__ */ new Set([
      "\u104F"
    ]);
    var closingQuoteChars = /* @__PURE__ */ new Set([
      "\u201D",
      "\u2019",
      "\xBB",
      "\u203A",
      "\u300D",
      "\u300F",
      "\u3011",
      "\u300B",
      "\u3009",
      "\u3015",
      "\uFF09"
    ]);
    function isLeftStickyPunctuationSegment(segment) {
      if (isPunctuationGlueCluster(segment))
        return true;
      let sawPunctuation = false;
      for (const ch of segment) {
        if (leftStickyPunctuation.has(ch) || isLineBreakNumericAffix(ch)) {
          sawPunctuation = true;
          continue;
        }
        if (sawPunctuation && combiningMarkRe.test(ch))
          continue;
        return false;
      }
      return sawPunctuation;
    }
    function isCJKLineStartProhibitedSegment(segment) {
      for (const ch of segment) {
        if (!kinsokuStart.has(ch) && !leftStickyPunctuation.has(ch))
          return false;
      }
      return segment.length > 0;
    }
    function isForwardStickyClusterSegment(segment) {
      if (isPunctuationGlueCluster(segment))
        return true;
      for (const ch of segment) {
        if (!kinsokuEnd.has(ch) && !forwardStickyGlue.has(ch) && !combiningMarkRe.test(ch) && !isLineBreakNumericAffix(ch)) {
          return false;
        }
      }
      return segment.length > 0;
    }
    function isPunctuationGlueCluster(segment) {
      let sawPunctuation = false;
      for (const ch of segment) {
        if (ch === "\\" || combiningMarkRe.test(ch))
          continue;
        if (kinsokuEnd.has(ch) || leftStickyPunctuation.has(ch) || forwardStickyGlue.has(ch)) {
          sawPunctuation = true;
          continue;
        }
        return false;
      }
      return sawPunctuation;
    }
    function previousCodePointStart(text, end) {
      const last = end - 1;
      if (last <= 0)
        return Math.max(last, 0);
      const lastCodeUnit = text.charCodeAt(last);
      if (lastCodeUnit < 56320 || lastCodeUnit > 57343)
        return last;
      const maybeHigh = last - 1;
      if (maybeHigh < 0)
        return last;
      const highCodeUnit = text.charCodeAt(maybeHigh);
      return highCodeUnit >= 55296 && highCodeUnit <= 56319 ? maybeHigh : last;
    }
    function getLastCodePoint(text) {
      if (text.length === 0)
        return null;
      const start = previousCodePointStart(text, text.length);
      return text.slice(start);
    }
    function getFirstSignificantCodePoint(text) {
      for (const ch of text) {
        if (!combiningMarkRe.test(ch))
          return ch;
      }
      return null;
    }
    function getLastSignificantCodePoint(text, end = text.length) {
      for (; end > 0; ) {
        const start = previousCodePointStart(text, end);
        const ch = text.slice(start, end);
        if (!combiningMarkRe.test(ch))
          return ch;
        end = start;
      }
      return null;
    }
    var lineBreakNumericAffixRanges = [
      36,
      37,
      43,
      43,
      92,
      92,
      162,
      165,
      176,
      177,
      1423,
      1423,
      1545,
      1547,
      1642,
      1642,
      2046,
      2047,
      2546,
      2547,
      2553,
      2555,
      2801,
      2801,
      3065,
      3065,
      3449,
      3449,
      3647,
      3647,
      6107,
      6107,
      8240,
      8247,
      8279,
      8279,
      8352,
      8399,
      8451,
      8451,
      8457,
      8457,
      8470,
      8470,
      8722,
      8723,
      43064,
      43064,
      65020,
      65020,
      65129,
      65130,
      65284,
      65285,
      65504,
      65505,
      65509,
      65510,
      73693,
      73696,
      123647,
      123647,
      126124,
      126124,
      126128,
      126128
    ];
    function isCodePointInRanges(codePoint, ranges) {
      for (let i = 0; i < ranges.length; i += 2) {
        if (codePoint >= ranges[i] && codePoint <= ranges[i + 1])
          return true;
      }
      return false;
    }
    function isLineBreakNumericAffix(ch) {
      const codePoint = ch.codePointAt(0);
      return codePoint !== void 0 && isCodePointInRanges(codePoint, lineBreakNumericAffixRanges);
    }
    function endsWithLineBreakNumericAffix(text) {
      const last = getLastSignificantCodePoint(text);
      return last !== null && isLineBreakNumericAffix(last);
    }
    function startsWithDecimalDigit(text) {
      const first = getFirstSignificantCodePoint(text);
      return first !== null && decimalDigitRe.test(first);
    }
    function splitTrailingForwardStickyCluster(text) {
      let splitIndex = text.length;
      while (splitIndex > 0) {
        const start = previousCodePointStart(text, splitIndex);
        const ch = text.slice(start, splitIndex);
        if (combiningMarkRe.test(ch) || kinsokuEnd.has(ch) || forwardStickyGlue.has(ch)) {
          splitIndex = start;
          continue;
        }
        break;
      }
      if (splitIndex <= 0 || splitIndex === text.length)
        return null;
      return {
        head: text.slice(0, splitIndex),
        tail: text.slice(splitIndex)
      };
    }
    function getRepeatableSingleCharRunChar(text, isWordLike, kind) {
      return kind === "text" && !isWordLike && text.length === 1 && text !== "-" && text !== "\u2014" ? text : null;
    }
    function hasArabicNoSpacePunctuation(containsArabic, lastCodePoint) {
      return containsArabic && lastCodePoint !== null && arabicNoSpaceTrailingPunctuation.has(lastCodePoint);
    }
    function endsWithMyanmarMedialGlue(segment) {
      const lastCodePoint = getLastCodePoint(segment);
      return lastCodePoint !== null && myanmarMedialGlue.has(lastCodePoint);
    }
    function splitLeadingSpaceAndMarks(segment) {
      if (segment.length < 2 || segment[0] !== " ")
        return null;
      const marks = segment.slice(1);
      if (new RegExp("^\\p{M}+$", "u").test(marks)) {
        return { space: " ", marks };
      }
      return null;
    }
    function endsWithClosingQuote(text) {
      let end = text.length;
      while (end > 0) {
        const start = previousCodePointStart(text, end);
        const ch = text.slice(start, end);
        if (closingQuoteChars.has(ch))
          return true;
        if (!leftStickyPunctuation.has(ch))
          return false;
        end = start;
      }
      return false;
    }
    function classifySegmentBreakChar(ch, whiteSpace) {
      if (whiteSpace === "pre-wrap") {
        if (ch === " ")
          return "preserved-space";
        if (ch === "	")
          return "tab";
        if (ch === "\n")
          return "hard-break";
      }
      if (ch === " ")
        return "space";
      if (ch === "\xA0" || ch === "\u202F" || ch === "\u2060" || ch === "\uFEFF") {
        return "glue";
      }
      if (ch === "\u200B")
        return "zero-width-break";
      if (ch === "\xAD")
        return "soft-hyphen";
      return "text";
    }
    var breakCharRe = /[\x20\t\n\xA0\xAD\u200B\u202F\u2060\uFEFF]/;
    function joinTextParts(parts) {
      return parts.length === 1 ? parts[0] : parts.join("");
    }
    function joinReversedPrefixParts(prefixParts, tail) {
      const parts = [];
      for (let i = prefixParts.length - 1; i >= 0; i--) {
        parts.push(prefixParts[i]);
      }
      parts.push(tail);
      return joinTextParts(parts);
    }
    function splitSegmentByBreakKind(segment, isWordLike, start, whiteSpace) {
      if (!breakCharRe.test(segment)) {
        return [{ text: segment, isWordLike, kind: "text", start }];
      }
      const pieces = [];
      let currentKind = null;
      let currentStart = 0;
      let currentWordLike = false;
      let offset = 0;
      for (const ch of segment) {
        const kind = classifySegmentBreakChar(ch, whiteSpace);
        const wordLike = kind === "text" && isWordLike;
        if (currentKind !== null && kind === currentKind && wordLike === currentWordLike) {
          offset += ch.length;
          continue;
        }
        if (currentKind !== null) {
          pieces.push({
            text: segment.slice(currentStart, offset),
            isWordLike: currentWordLike,
            kind: currentKind,
            start: start + currentStart
          });
        }
        currentKind = kind;
        currentStart = offset;
        currentWordLike = wordLike;
        offset += ch.length;
      }
      if (currentKind !== null) {
        pieces.push({
          text: segment.slice(currentStart),
          isWordLike: currentWordLike,
          kind: currentKind,
          start: start + currentStart
        });
      }
      return pieces;
    }
    function isTextRunBoundary(kind) {
      return kind === "space" || kind === "preserved-space" || kind === "zero-width-break" || kind === "hard-break";
    }
    var urlSchemeSegmentRe = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
    function isUrlLikeRunStart(segmentation, index) {
      const text = segmentation.texts[index];
      if (text.startsWith("www."))
        return true;
      return urlSchemeSegmentRe.test(text) && index + 1 < segmentation.len && segmentation.kinds[index + 1] === "text" && segmentation.texts[index + 1] === "//";
    }
    function isUrlQueryBoundarySegment(text) {
      return text.includes("?") && (text.includes("://") || text.startsWith("www."));
    }
    function mergeUrlRuns(segmentation, normalized, profile) {
      const texts = [];
      const isWordLike = [];
      const kinds = [];
      const starts = [];
      for (let i = 0; i < segmentation.len; i++) {
        const start = segmentation.starts[i];
        let text = segmentation.texts[i];
        let wordLike = segmentation.isWordLike[i];
        const kind = segmentation.kinds[i];
        let queryStartOverride = -1;
        if (kind === "text" && isUrlLikeRunStart(segmentation, i)) {
          const urlParts = [text];
          let j2 = i + 1;
          while (j2 < segmentation.len && !isTextRunBoundary(segmentation.kinds[j2]) && numericAffixBoundary(normalized, segmentation.starts[j2], profile) !== false) {
            if (queryStartOverride < 0 && isUrlLikeRunStart(segmentation, j2)) {
              queryStartOverride = segmentation.starts[j2];
            }
            const nextText = segmentation.texts[j2];
            urlParts.push(nextText);
            wordLike = true;
            j2++;
            if (nextText.includes("?"))
              break;
          }
          text = joinTextParts(urlParts);
          i = j2 - 1;
        }
        texts.push(text);
        isWordLike.push(wordLike);
        kinds.push(kind);
        starts.push(start);
        if (!isUrlQueryBoundarySegment(text))
          continue;
        const nextIndex = i + 1;
        if (nextIndex >= segmentation.len || isTextRunBoundary(segmentation.kinds[nextIndex])) {
          continue;
        }
        const queryParts = [];
        const queryStart = queryStartOverride < 0 ? segmentation.starts[nextIndex] : queryStartOverride;
        let j = nextIndex;
        while (j < segmentation.len && !isTextRunBoundary(segmentation.kinds[j]) && numericAffixBoundary(normalized, segmentation.starts[j], profile) !== false) {
          queryParts.push(segmentation.texts[j]);
          j++;
        }
        if (queryParts.length > 0) {
          texts.push(joinTextParts(queryParts));
          isWordLike.push(true);
          kinds.push("text");
          starts.push(queryStart);
          i = j - 1;
        }
      }
      return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts
      };
    }
    var numericJoinerChars = /* @__PURE__ */ new Set([
      ":",
      "-",
      "/",
      "\xD7",
      ",",
      ".",
      "+",
      "\u2013",
      "\u2014"
    ]);
    var wordInternalSymbolRe = /[\p{P}\p{S}\p{Co}]/u;
    var emojiPresentationRe = new RegExp("\\p{Emoji_Presentation}", "u");
    var noSpaceWordBreakAfterChars = /* @__PURE__ */ new Set([
      "?",
      "\u058A",
      "-",
      "\u2010",
      "\u2012",
      "\u2013",
      "\u2014",
      "\u2026",
      "\u203C",
      "\u203D",
      "\u2049"
    ]);
    function isAsciiWordInternalSymbolCode(code) {
      return code >= 33 && code <= 47 && code !== 45 || code >= 58 && code <= 64 && code !== 63 || code >= 91 && code <= 96 || code >= 123 && code <= 126;
    }
    function isNoSpaceWordInternalSymbol(ch) {
      const code = ch.charCodeAt(0);
      if (code < 128)
        return isAsciiWordInternalSymbolCode(code);
      return !noSpaceWordBreakAfterChars.has(ch) && !emojiPresentationRe.test(ch) && wordInternalSymbolRe.test(ch);
    }
    function isNoSpaceWordInternalSymbolSegment(text) {
      let sawSymbol = false;
      for (const ch of text) {
        if (combiningMarkRe.test(ch))
          continue;
        if (!isNoSpaceWordInternalSymbol(ch))
          return false;
        sawSymbol = true;
      }
      return sawSymbol;
    }
    function endsWithNoSpaceWordJoiner(text) {
      for (let end = text.length; end > 0; ) {
        const start = previousCodePointStart(text, end);
        const ch = text.slice(start, end);
        if (combiningMarkRe.test(ch)) {
          end = start;
          continue;
        }
        return isNoSpaceWordInternalSymbol(ch) || isLineBreakNumericAffix(ch);
      }
      return false;
    }
    var asciiAlphabeticBoundaryRe = /[A-Za-z#&*<=>@^_`~]/;
    function isAsciiBoundary(left, right) {
      return left.charCodeAt(0) < 128 && right.charCodeAt(0) < 128;
    }
    function numericAffixBoundary(source, boundary, profile) {
      if (!profile.geckoAsciiLineBreaks || boundary <= 0 || boundary >= source.length)
        return null;
      const left = getLastSignificantCodePoint(source, boundary);
      const right = String.fromCodePoint(source.codePointAt(boundary));
      if (left === null || !isAsciiBoundary(left, right))
        return null;
      const leftAffix = isLineBreakNumericAffix(left);
      const rightAffix = isLineBreakNumericAffix(right);
      if (!leftAffix && !rightAffix)
        return null;
      if (right === ")" || right === "]" || right === "}" || "!,.:;?/".includes(right))
        return true;
      if ("([{".includes(left) || left === '"' || left === "'" || right === '"' || right === "'")
        return true;
      if (right === "|" || right === "-")
        return true;
      if (leftAffix && asciiAlphabeticBoundaryRe.test(right) || asciiAlphabeticBoundaryRe.test(left) && rightAffix)
        return true;
      if (rightAffix && (")]}".includes(left) || /[0-9]/.test(left)))
        return true;
      if (leftAffix && ("([{".includes(right) || /[0-9]/.test(right)))
        return true;
      return false;
    }
    function openingPunctuationJoinsPrevious(left, right, profile, leftEnd = left.length) {
      const first = right[0];
      if (first === void 0 || !"([{".includes(first))
        return null;
      const last = getLastSignificantCodePoint(left, leftEnd);
      if (last === null)
        return null;
      if (profile.geckoAsciiLineBreaks && isAsciiBoundary(last, first)) {
        return asciiAlphabeticBoundaryRe.test(last) || decimalDigitRe.test(last) || `"'([{`.includes(last) || isLineBreakNumericAffix(last);
      }
      if (last.charCodeAt(0) >= 128) {
        return !isCJK(last) && /[\p{L}\p{N}]/u.test(last) ? true : null;
      }
      return /[A-Za-z0-9]/.test(last) || "$'(/<@[^_`{".includes(last);
    }
    function canJoinNoSpaceWordBoundary(leftText, leftWordLike, rightText, rightWordLike, profile) {
      if (rightText[0] === "-" && isCJK(leftText))
        return true;
      if (isCJK(leftText) || isCJK(rightText))
        return false;
      const openingJoin = openingPunctuationJoinsPrevious(leftText, rightText, profile);
      if (openingJoin !== null)
        return openingJoin;
      const leftSymbol = !leftWordLike && isNoSpaceWordInternalSymbolSegment(leftText);
      const rightSymbol = !rightWordLike && isNoSpaceWordInternalSymbolSegment(rightText);
      const leftAffix = endsWithLineBreakNumericAffix(leftText);
      const leftEndsJoiner = (leftWordLike || leftAffix) && endsWithNoSpaceWordJoiner(leftText);
      if (!leftSymbol && !rightSymbol && !leftEndsJoiner)
        return false;
      return (leftWordLike || leftSymbol || leftAffix) && (rightWordLike || rightSymbol);
    }
    function segmentContainsDecimalDigit(text) {
      for (const ch of text) {
        if (decimalDigitRe.test(ch))
          return true;
      }
      return false;
    }
    function isNumericRunSegment(text) {
      if (text.length === 0)
        return false;
      for (const ch of text) {
        if (decimalDigitRe.test(ch) || numericJoinerChars.has(ch))
          continue;
        return false;
      }
      return true;
    }
    function mergeNumericRuns(segmentation, normalized, profile) {
      const texts = [];
      const isWordLike = [];
      const kinds = [];
      const starts = [];
      function pushNumericRun(text, start) {
        if (text.includes("-")) {
          const parts = text.split("-");
          let shouldSplit = parts.length > 1;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!shouldSplit)
              break;
            if (part.length === 0 || !segmentContainsDecimalDigit(part) || !isNumericRunSegment(part)) {
              shouldSplit = false;
            }
          }
          if (shouldSplit) {
            let offset = 0;
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const splitText = i < parts.length - 1 ? `${part}-` : part;
              texts.push(splitText);
              isWordLike.push(true);
              kinds.push("text");
              starts.push(start + offset);
              offset += splitText.length;
            }
            return;
          }
        }
        texts.push(text);
        isWordLike.push(true);
        kinds.push("text");
        starts.push(start);
      }
      for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        const kind = segmentation.kinds[i];
        if (kind === "text" && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
          const mergedParts = [text];
          let j = i + 1;
          while (j < segmentation.len && segmentation.kinds[j] === "text" && isNumericRunSegment(segmentation.texts[j]) && numericAffixBoundary(normalized, segmentation.starts[j], profile) !== false) {
            mergedParts.push(segmentation.texts[j]);
            j++;
          }
          pushNumericRun(joinTextParts(mergedParts), segmentation.starts[i]);
          i = j - 1;
          continue;
        }
        texts.push(text);
        isWordLike.push(segmentation.isWordLike[i]);
        kinds.push(kind);
        starts.push(segmentation.starts[i]);
      }
      return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts
      };
    }
    function mergeNoSpaceWordChains(segmentation, normalized, profile) {
      const texts = [];
      const isWordLike = [];
      const kinds = [];
      const starts = [];
      let i = 0;
      while (i < segmentation.len) {
        const text = segmentation.texts[i];
        const kind = segmentation.kinds[i];
        const wordLike = segmentation.isWordLike[i];
        if (kind === "text") {
          const mergedParts = [text];
          let j = i + 1;
          let mergedWordLike = wordLike;
          while (j < segmentation.len && segmentation.kinds[j] === "text" && (numericAffixBoundary(normalized, segmentation.starts[j], profile) ?? canJoinNoSpaceWordBoundary(segmentation.texts[j - 1], segmentation.isWordLike[j - 1], segmentation.texts[j], segmentation.isWordLike[j], profile))) {
            const nextText = segmentation.texts[j];
            mergedParts.push(nextText);
            mergedWordLike = mergedWordLike || segmentation.isWordLike[j];
            j++;
          }
          if (j > i + 1) {
            texts.push(joinTextParts(mergedParts));
            isWordLike.push(mergedWordLike);
            kinds.push("text");
            starts.push(segmentation.starts[i]);
            i = j;
            continue;
          }
        }
        texts.push(text);
        isWordLike.push(wordLike);
        kinds.push(kind);
        starts.push(segmentation.starts[i]);
        i++;
      }
      return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts
      };
    }
    function mergeGlueConnectedTextRuns(segmentation) {
      const texts = [];
      const isWordLike = [];
      const kinds = [];
      const starts = [];
      let read = 0;
      while (read < segmentation.len) {
        const textParts = [segmentation.texts[read]];
        let wordLike = segmentation.isWordLike[read];
        let kind = segmentation.kinds[read];
        let start = segmentation.starts[read];
        if (kind === "glue") {
          const glueParts = [textParts[0]];
          const glueStart = start;
          read++;
          while (read < segmentation.len && segmentation.kinds[read] === "glue") {
            glueParts.push(segmentation.texts[read]);
            read++;
          }
          const glueText = joinTextParts(glueParts);
          if (read < segmentation.len && segmentation.kinds[read] === "text") {
            textParts[0] = glueText;
            textParts.push(segmentation.texts[read]);
            wordLike = segmentation.isWordLike[read];
            kind = "text";
            start = glueStart;
            read++;
          } else {
            texts.push(glueText);
            isWordLike.push(false);
            kinds.push("glue");
            starts.push(glueStart);
            continue;
          }
        } else {
          read++;
        }
        if (kind === "text") {
          while (read < segmentation.len && segmentation.kinds[read] === "glue") {
            const glueParts = [];
            while (read < segmentation.len && segmentation.kinds[read] === "glue") {
              glueParts.push(segmentation.texts[read]);
              read++;
            }
            const glueText = joinTextParts(glueParts);
            if (read < segmentation.len && segmentation.kinds[read] === "text") {
              textParts.push(glueText, segmentation.texts[read]);
              wordLike = wordLike || segmentation.isWordLike[read];
              read++;
              continue;
            }
            textParts.push(glueText);
          }
        }
        texts.push(joinTextParts(textParts));
        isWordLike.push(wordLike);
        kinds.push(kind);
        starts.push(start);
      }
      return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts
      };
    }
    function carryTrailingForwardStickyAcrossCJKBoundary(segmentation) {
      const { texts, kinds, starts } = segmentation;
      for (let i = 0; i < texts.length - 1; i++) {
        if (kinds[i] !== "text" || kinds[i + 1] !== "text")
          continue;
        if (!isCJK(texts[i]) || !isCJK(texts[i + 1]))
          continue;
        const split = splitTrailingForwardStickyCluster(texts[i]);
        if (split === null)
          continue;
        texts[i] = split.head;
        texts[i + 1] = split.tail + texts[i + 1];
        starts[i + 1] = starts[i] + split.head.length;
      }
    }
    function buildMergedSegmentation(normalized, profile, whiteSpace) {
      const wordSegmenter = getSharedWordSegmenter();
      let mergedLen = 0;
      const mergedTexts = [];
      const mergedWordLike = [];
      const mergedKinds = [];
      const mergedStarts = [];
      let hasTail = false;
      let tailStart = 0;
      let tailEnd = 0;
      let tailWordLike = false;
      let tailKind = "text";
      let tailSingleCharRunChar = null;
      let tailContainsCJK = false;
      let tailContainsArabicScript = false;
      let tailEndsWithClosingQuote = false;
      let tailEndsWithMyanmarMedialGlue = false;
      let tailHasArabicNoSpacePunctuation = false;
      for (const s of wordSegmenter.segment(normalized)) {
        for (const piece of splitSegmentByBreakKind(s.segment, s.isWordLike ?? false, s.index, whiteSpace)) {
          const isText = piece.kind === "text";
          const repeatableSingleCharRunChar = getRepeatableSingleCharRunChar(piece.text, piece.isWordLike, piece.kind);
          const pieceContainsCJK = isCJK(piece.text);
          const pieceContainsArabicScript = containsArabicScript(piece.text);
          const pieceLastCodePoint = getLastCodePoint(piece.text);
          const pieceEndsWithClosingQuote = endsWithClosingQuote(piece.text);
          const pieceEndsWithMyanmarMedialGlue = endsWithMyanmarMedialGlue(piece.text);
          const pieceEnd = piece.start + piece.text.length;
          const boundaryJoin = numericAffixBoundary(normalized, piece.start, profile) ?? (tailContainsCJK || pieceContainsCJK ? null : openingPunctuationJoinsPrevious(normalized, piece.text, profile, piece.start));
          let appendToTail = false;
          if (profile.carryCJKAfterClosingQuote && isText && hasTail && tailKind === "text" && pieceContainsCJK && tailContainsCJK && tailEndsWithClosingQuote) {
            appendToTail = true;
          } else if (isText && hasTail && tailKind === "text" && isCJKLineStartProhibitedSegment(piece.text) && tailContainsCJK) {
            appendToTail = true;
          } else if (isText && hasTail && tailKind === "text" && tailEndsWithMyanmarMedialGlue) {
            appendToTail = true;
          } else if (isText && hasTail && tailKind === "text" && piece.isWordLike && pieceContainsArabicScript && tailHasArabicNoSpacePunctuation) {
            appendToTail = true;
          } else if (repeatableSingleCharRunChar !== null && hasTail && tailKind === "text" && tailSingleCharRunChar === repeatableSingleCharRunChar && boundaryJoin !== false) {
            tailEnd = pieceEnd;
            continue;
          } else if (isText && !piece.isWordLike && hasTail && tailKind === "text" && !tailContainsCJK && (isLeftStickyPunctuationSegment(piece.text) || piece.text === "-" && tailWordLike)) {
            appendToTail = true;
          }
          if (isText && hasTail && tailKind === "text" && boundaryJoin !== null)
            appendToTail = boundaryJoin;
          if (appendToTail) {
            tailEnd = pieceEnd;
            tailWordLike = tailWordLike || piece.isWordLike;
            tailSingleCharRunChar = null;
            tailContainsCJK = tailContainsCJK || pieceContainsCJK;
            tailContainsArabicScript = tailContainsArabicScript || pieceContainsArabicScript;
            tailEndsWithClosingQuote = pieceEndsWithClosingQuote;
            tailEndsWithMyanmarMedialGlue = pieceEndsWithMyanmarMedialGlue;
            tailHasArabicNoSpacePunctuation = hasArabicNoSpacePunctuation(tailContainsArabicScript, pieceLastCodePoint);
          } else {
            if (hasTail) {
              mergedTexts[mergedLen] = normalized.slice(tailStart, tailEnd);
              mergedWordLike[mergedLen] = tailWordLike;
              mergedKinds[mergedLen] = tailKind;
              mergedStarts[mergedLen] = tailStart;
              mergedLen++;
            }
            hasTail = true;
            tailStart = piece.start;
            tailEnd = pieceEnd;
            tailWordLike = piece.isWordLike;
            tailKind = piece.kind;
            tailSingleCharRunChar = repeatableSingleCharRunChar;
            tailContainsCJK = pieceContainsCJK;
            tailContainsArabicScript = pieceContainsArabicScript;
            tailEndsWithClosingQuote = pieceEndsWithClosingQuote;
            tailEndsWithMyanmarMedialGlue = pieceEndsWithMyanmarMedialGlue;
            tailHasArabicNoSpacePunctuation = hasArabicNoSpacePunctuation(pieceContainsArabicScript, pieceLastCodePoint);
          }
        }
      }
      if (hasTail) {
        mergedTexts[mergedLen] = normalized.slice(tailStart, tailEnd);
        mergedWordLike[mergedLen] = tailWordLike;
        mergedKinds[mergedLen] = tailKind;
        mergedStarts[mergedLen] = tailStart;
        mergedLen++;
      }
      for (let i = 1; i < mergedLen; i++) {
        if (mergedKinds[i] === "text" && !mergedWordLike[i] && isPunctuationGlueCluster(mergedTexts[i]) && mergedKinds[i - 1] === "text" && !isCJK(mergedTexts[i - 1]) && (numericAffixBoundary(normalized, mergedStarts[i], profile) ?? openingPunctuationJoinsPrevious(normalized, mergedTexts[i], profile, mergedStarts[i])) !== false) {
          mergedTexts[i - 1] += mergedTexts[i];
          mergedWordLike[i - 1] = mergedWordLike[i - 1] || mergedWordLike[i];
          mergedTexts[i] = "";
        }
      }
      let nextLiveIndex = -1;
      let forwardStickyPrefixParts = null;
      for (let i = mergedLen - 1; i >= 0; i--) {
        const text = mergedTexts[i];
        if (text.length === 0)
          continue;
        const nextText = forwardStickyPrefixParts?.at(-1) ?? (nextLiveIndex >= 0 ? mergedTexts[nextLiveIndex] : null);
        if (mergedKinds[i] === "text" && !mergedWordLike[i] && nextText !== null && mergedKinds[nextLiveIndex] === "text" && ((numericAffixBoundary(normalized, mergedStarts[i] + text.length, profile) ?? (isForwardStickyClusterSegment(text) && openingPunctuationJoinsPrevious(text, nextText, profile) !== false)) || text === "-" && startsWithDecimalDigit(nextText))) {
          if (forwardStickyPrefixParts === null)
            forwardStickyPrefixParts = [];
          forwardStickyPrefixParts.push(text);
          mergedStarts[nextLiveIndex] = mergedStarts[i];
          mergedTexts[i] = "";
          continue;
        }
        if (forwardStickyPrefixParts !== null) {
          mergedTexts[nextLiveIndex] = joinReversedPrefixParts(forwardStickyPrefixParts, mergedTexts[nextLiveIndex]);
          forwardStickyPrefixParts = null;
        }
        nextLiveIndex = i;
      }
      if (forwardStickyPrefixParts !== null) {
        mergedTexts[nextLiveIndex] = joinReversedPrefixParts(forwardStickyPrefixParts, mergedTexts[nextLiveIndex]);
      }
      let compactLen = 0;
      for (let read = 0; read < mergedLen; read++) {
        const text = mergedTexts[read];
        if (text.length === 0)
          continue;
        if (compactLen !== read) {
          mergedTexts[compactLen] = text;
          mergedWordLike[compactLen] = mergedWordLike[read];
          mergedKinds[compactLen] = mergedKinds[read];
          mergedStarts[compactLen] = mergedStarts[read];
        }
        compactLen++;
      }
      mergedTexts.length = compactLen;
      mergedWordLike.length = compactLen;
      mergedKinds.length = compactLen;
      mergedStarts.length = compactLen;
      const compacted = mergeGlueConnectedTextRuns({
        len: compactLen,
        texts: mergedTexts,
        isWordLike: mergedWordLike,
        kinds: mergedKinds,
        starts: mergedStarts
      });
      const mergedRuns = mergeNoSpaceWordChains(mergeNumericRuns(mergeUrlRuns(compacted, normalized, profile), normalized, profile), normalized, profile);
      carryTrailingForwardStickyAcrossCJKBoundary(mergedRuns);
      for (let i = 0; i < mergedRuns.len - 1; i++) {
        const split = splitLeadingSpaceAndMarks(mergedRuns.texts[i]);
        if (split === null)
          continue;
        if (mergedRuns.kinds[i] !== "space" && mergedRuns.kinds[i] !== "preserved-space" || mergedRuns.kinds[i + 1] !== "text" || !containsArabicScript(mergedRuns.texts[i + 1])) {
          continue;
        }
        mergedRuns.texts[i] = split.space;
        mergedRuns.isWordLike[i] = false;
        mergedRuns.kinds[i] = mergedRuns.kinds[i] === "preserved-space" ? "preserved-space" : "space";
        mergedRuns.texts[i + 1] = split.marks + mergedRuns.texts[i + 1];
        mergedRuns.starts[i + 1] = mergedRuns.starts[i] + split.space.length;
      }
      return mergedRuns;
    }
    function mergeKeepAllTextSegments(normalized, segmentation, profile) {
      if (segmentation.len <= 1)
        return segmentation;
      const texts = [];
      const isWordLike = [];
      const kinds = [];
      const starts = [];
      let groupStart = -1;
      let groupContainsCJK = false;
      function pushOriginalText(index) {
        texts.push(segmentation.texts[index]);
        isWordLike.push(segmentation.isWordLike[index]);
        kinds.push("text");
        starts.push(segmentation.starts[index]);
      }
      function pushMergedText(start, end) {
        let wordLike = false;
        for (let i = start; i < end; i++) {
          wordLike = wordLike || segmentation.isWordLike[i];
        }
        const sourceStart = segmentation.starts[start];
        const sourceEnd = end < segmentation.len ? segmentation.starts[end] : normalized.length;
        texts.push(normalized.slice(sourceStart, sourceEnd));
        isWordLike.push(wordLike);
        kinds.push("text");
        starts.push(sourceStart);
      }
      function flushGroup(end) {
        if (groupStart < 0)
          return;
        if (groupContainsCJK) {
          if (groupStart + 1 === end) {
            pushOriginalText(groupStart);
          } else {
            pushMergedText(groupStart, end);
          }
        } else {
          for (let i = groupStart; i < end; i++)
            pushOriginalText(i);
        }
        groupStart = -1;
        groupContainsCJK = false;
      }
      for (let i = 0; i < segmentation.len; i++) {
        const text = segmentation.texts[i];
        const kind = segmentation.kinds[i];
        if (kind === "text") {
          if (groupStart >= 0 && (!canContinueKeepAllTextRun(segmentation.texts[i - 1], profile.breakKeepAllAfterPunctuation) || numericAffixBoundary(normalized, segmentation.starts[i], profile) === false)) {
            flushGroup(i);
          }
          if (groupStart < 0)
            groupStart = i;
          groupContainsCJK = groupContainsCJK || isCJK(text);
          continue;
        }
        flushGroup(i);
        texts.push(text);
        isWordLike.push(segmentation.isWordLike[i]);
        kinds.push(kind);
        starts.push(segmentation.starts[i]);
      }
      flushGroup(segmentation.len);
      return {
        len: texts.length,
        texts,
        isWordLike,
        kinds,
        starts
      };
    }
    function isNumericHyphen(text, index) {
      const next = text.charCodeAt(index + 1);
      if (next < 128) {
        if (next < 48 || next > 57)
          return false;
      } else {
        const codePoint = text.codePointAt(index + 1);
        if (codePoint === void 0 || !decimalDigitRe.test(String.fromCodePoint(codePoint)))
          return false;
      }
      for (let end = index; end > 0; ) {
        const start = previousCodePointStart(text, end);
        const previous = text.slice(start, end);
        if (!combiningMarkRe.test(previous))
          return isCJK(previous) || !/[\p{L}\p{N}]/u.test(previous);
        end = start;
      }
      return true;
    }
    function buildBaseCjkUnits(segText, profile) {
      const units = [];
      let unitStart = 0;
      let unitEnd = 0;
      let unitContainsCJK = false;
      let unitEndsWithClosingQuote = false;
      let unitIsSingleKinsokuEnd = false;
      let unitHasHyphen = false;
      let unitHasNumericHyphen = false;
      function pushUnit() {
        if (unitEnd === unitStart)
          return;
        units.push({
          text: segText.slice(unitStart, unitEnd),
          start: unitStart,
          overflow: unitContainsCJK ? unitHasHyphen ? "grapheme" : "none" : "word-like"
        });
        unitStart = unitEnd;
        unitContainsCJK = false;
        unitEndsWithClosingQuote = false;
        unitIsSingleKinsokuEnd = false;
        unitHasHyphen = false;
        unitHasNumericHyphen = false;
      }
      function startUnit(grapheme, start, graphemeContainsCJK) {
        unitStart = start;
        unitEnd = start + grapheme.length;
        unitContainsCJK = graphemeContainsCJK;
        unitHasHyphen = grapheme === "-";
        unitEndsWithClosingQuote = endsWithClosingQuote(grapheme);
        unitIsSingleKinsokuEnd = kinsokuEnd.has(grapheme);
      }
      function appendToUnit(grapheme, graphemeContainsCJK) {
        unitEnd += grapheme.length;
        unitContainsCJK = unitContainsCJK || graphemeContainsCJK;
        unitHasHyphen = unitHasHyphen || grapheme === "-";
        const graphemeEndsWithClosingQuote = endsWithClosingQuote(grapheme);
        if (grapheme.length === 1 && leftStickyPunctuation.has(grapheme)) {
          unitEndsWithClosingQuote = unitEndsWithClosingQuote || graphemeEndsWithClosingQuote;
        } else {
          unitEndsWithClosingQuote = graphemeEndsWithClosingQuote;
        }
        unitIsSingleKinsokuEnd = false;
      }
      for (const gs of getSharedGraphemeSegmenter().segment(segText)) {
        const grapheme = gs.segment;
        const graphemeContainsCJK = isCJK(grapheme);
        if (unitEnd === unitStart) {
          startUnit(grapheme, gs.index, graphemeContainsCJK);
          continue;
        }
        const attachHyphen = grapheme === "-" && unitContainsCJK;
        if (attachHyphen && isNumericHyphen(segText, gs.index))
          unitHasNumericHyphen = true;
        if (unitIsSingleKinsokuEnd || kinsokuStart.has(grapheme) || leftStickyPunctuation.has(grapheme) || attachHyphen || unitHasNumericHyphen && !graphemeContainsCJK || profile.carryCJKAfterClosingQuote && graphemeContainsCJK && unitEndsWithClosingQuote) {
          appendToUnit(grapheme, graphemeContainsCJK);
          continue;
        }
        if (!unitContainsCJK && !graphemeContainsCJK) {
          appendToUnit(grapheme, graphemeContainsCJK);
          continue;
        }
        pushUnit();
        startUnit(grapheme, gs.index, graphemeContainsCJK);
      }
      pushUnit();
      return units;
    }
    function mergeKeepAllTextUnits(segText, units, profile) {
      if (units.length <= 1)
        return units;
      const merged = [];
      let groupStart = -1;
      let groupContainsCJK = false;
      function pushMergedUnit(start, end) {
        const sourceStart = units[start].start;
        const sourceEnd = end < units.length ? units[end].start : segText.length;
        merged.push({
          text: segText.slice(sourceStart, sourceEnd),
          start: sourceStart,
          overflow: "word-like"
        });
      }
      function flushGroup(end) {
        if (groupStart < 0)
          return;
        if (groupContainsCJK) {
          if (groupStart + 1 === end) {
            merged.push(units[groupStart]);
          } else {
            pushMergedUnit(groupStart, end);
          }
        } else {
          for (let i = groupStart; i < end; i++)
            merged.push(units[i]);
        }
        groupStart = -1;
        groupContainsCJK = false;
      }
      for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (groupStart >= 0 && (!canContinueKeepAllTextRun(units[i - 1].text, profile.breakKeepAllAfterPunctuation) || numericAffixBoundary(segText, unit.start, profile) === false)) {
          flushGroup(i);
        }
        if (groupStart < 0)
          groupStart = i;
        groupContainsCJK = groupContainsCJK || isCJK(unit.text);
      }
      flushGroup(units.length);
      return merged;
    }
    function getCjkTextUnits(text, profile, wordBreak) {
      const units = buildBaseCjkUnits(text, profile);
      return wordBreak === "keep-all" ? mergeKeepAllTextUnits(text, units, profile) : units;
    }
    function isPreferredBreakGrapheme(grapheme) {
      return grapheme === "-" || grapheme === "\u058A" || grapheme === "\u2010" || grapheme === "\u2012" || grapheme === "\u2013" || grapheme === "\u2014";
    }
    function isIndependentSymbolRun(text) {
      if (text.length === 0 || new RegExp("\\p{Cf}", "u").test(text))
        return false;
      for (const { segment } of getSharedGraphemeSegmenter().segment(text)) {
        const base = String.fromCodePoint(segment.codePointAt(0));
        if (!/[\p{P}\p{S}]/u.test(base) || emojiPresentationRe.test(base) || segment.includes("\uFE0F") || new RegExp("\\p{Emoji_Modifier}", "u").test(base))
          return false;
      }
      return true;
    }
    function getBreakablePreferredBreaks(text) {
      if (!/[-\u058A\u2010\u2012\u2013\u2014]/u.test(text))
        return null;
      const breaks = [];
      let graphemeIndex = 0;
      for (const gs of getSharedGraphemeSegmenter().segment(text)) {
        graphemeIndex++;
        const numericSign = gs.segment === "-" && isNumericHyphen(text, gs.index);
        if (isPreferredBreakGrapheme(gs.segment) && !numericSign)
          breaks.push(graphemeIndex);
      }
      return breaks.length === 0 ? null : breaks;
    }
    function analyzeText(text, profile, whiteSpace = "normal", wordBreak = "normal") {
      const normalized = whiteSpace === "pre-wrap" ? normalizeWhitespacePreWrap(text) : normalizeWhitespaceNormal(text);
      if (normalized.length === 0) {
        return {
          normalized,
          len: 0,
          texts: [],
          isWordLike: [],
          kinds: [],
          starts: []
        };
      }
      const mergedSegmentation = buildMergedSegmentation(normalized, profile, whiteSpace);
      const segmentation = wordBreak === "keep-all" ? mergeKeepAllTextSegments(normalized, mergedSegmentation, profile) : mergedSegmentation;
      return {
        normalized,
        ...segmentation
      };
    }
  
    // src/render/folia/vendor/pretext/dist/measurement.js
    var measureContext = null;
    var segmentMetricCaches = /* @__PURE__ */ new Map();
    var cachedEngineProfile = null;
    var MAX_PREFIX_FIT_GRAPHEMES = 96;
    var emojiPresentationRe2 = new RegExp("\\p{Emoji_Presentation}", "u");
    var maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
    var emojiCorrectionCache = /* @__PURE__ */ new Map();
    function getMeasureContext() {
      if (measureContext !== null)
        return measureContext;
      if (typeof OffscreenCanvas !== "undefined") {
        measureContext = new OffscreenCanvas(1, 1).getContext("2d");
        return measureContext;
      }
      if (typeof document !== "undefined") {
        measureContext = document.createElement("canvas").getContext("2d");
        return measureContext;
      }
      throw new Error("Text measurement requires OffscreenCanvas or a DOM canvas context.");
    }
    function getSegmentMetricCache(font) {
      let cache = segmentMetricCaches.get(font);
      if (!cache) {
        cache = /* @__PURE__ */ new Map();
        segmentMetricCaches.set(font, cache);
      }
      return cache;
    }
    function getSegmentMetrics(seg, cache) {
      let metrics = cache.get(seg);
      if (metrics === void 0) {
        const ctx = getMeasureContext();
        metrics = {
          width: ctx.measureText(seg).width
        };
        cache.set(seg, metrics);
      }
      return metrics;
    }
    function getEngineProfile() {
      if (cachedEngineProfile !== null)
        return cachedEngineProfile;
      if (typeof navigator === "undefined") {
        cachedEngineProfile = {
          geckoAsciiLineBreaks: false,
          lineFitEpsilon: 5e-3,
          carryCJKAfterClosingQuote: false,
          breakKeepAllAfterPunctuation: true,
          preferPrefixWidthsForBreakableRuns: false
        };
        return cachedEngineProfile;
      }
      const ua = navigator.userAgent;
      const vendor = navigator.vendor;
      const isSafari = vendor === "Apple Computer, Inc." && ua.includes("Safari/") && !ua.includes("Chrome/") && !ua.includes("Chromium/") && !ua.includes("CriOS/") && !ua.includes("FxiOS/") && !ua.includes("EdgiOS/");
      const isChromium = ua.includes("Chrome/") || ua.includes("Chromium/") || ua.includes("CriOS/") || ua.includes("Edg/");
      const isGecko = ua.includes("Firefox/") && !ua.includes("FxiOS/");
      cachedEngineProfile = {
        geckoAsciiLineBreaks: isGecko,
        lineFitEpsilon: isSafari ? 1 / 64 : 5e-3,
        carryCJKAfterClosingQuote: isChromium,
        breakKeepAllAfterPunctuation: !isSafari,
        preferPrefixWidthsForBreakableRuns: isSafari
      };
      return cachedEngineProfile;
    }
    function parseFontSize(font) {
      const m = font.match(/(?:^|\D)(\d+(?:\.\d+)?)\s*px/);
      return m ? parseFloat(m[1]) : 16;
    }
    function isEmojiGrapheme(g) {
      return emojiPresentationRe2.test(g) || g.includes("\uFE0F");
    }
    function textMayContainEmoji(text) {
      return maybeEmojiRe.test(text);
    }
    function getEmojiCorrection(font) {
      let correction = emojiCorrectionCache.get(font);
      if (correction !== void 0)
        return correction;
      const fontSize = parseFontSize(font);
      const ctx = getMeasureContext();
      ctx.font = font;
      const canvasW = ctx.measureText("\u{1F600}").width;
      correction = 0;
      if (canvasW > fontSize + 0.5 && typeof document !== "undefined" && document.body !== null) {
        const span = document.createElement("span");
        span.style.font = font;
        span.style.display = "inline-block";
        span.style.visibility = "hidden";
        span.style.position = "absolute";
        span.textContent = "\u{1F600}";
        document.body.appendChild(span);
        const domW = span.getBoundingClientRect().width;
        document.body.removeChild(span);
        if (canvasW - domW > 0.5) {
          correction = canvasW - domW;
        }
      }
      emojiCorrectionCache.set(font, correction);
      return correction;
    }
    function countEmojiGraphemes(text) {
      let count = 0;
      const graphemeSegmenter3 = getSharedGraphemeSegmenter();
      for (const g of graphemeSegmenter3.segment(text)) {
        if (isEmojiGrapheme(g.segment))
          count++;
      }
      return count;
    }
    function getEmojiCount(seg, metrics) {
      if (metrics.emojiCount === void 0) {
        metrics.emojiCount = countEmojiGraphemes(seg);
      }
      return metrics.emojiCount;
    }
    function getCorrectedSegmentWidth(seg, metrics, emojiCorrection) {
      if (emojiCorrection === 0)
        return metrics.width;
      return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
    }
    function getSegmentBreakableFitAdvances(seg, metrics, cache, emojiCorrection, mode) {
      if (metrics.breakableFitAdvances !== void 0 && metrics.breakableFitMode === mode) {
        return metrics.breakableFitAdvances;
      }
      metrics.breakableFitMode = mode;
      const graphemeSegmenter3 = getSharedGraphemeSegmenter();
      const graphemes = [];
      for (const gs of graphemeSegmenter3.segment(seg)) {
        graphemes.push(gs.segment);
      }
      if (graphemes.length <= 1) {
        metrics.breakableFitAdvances = null;
        return metrics.breakableFitAdvances;
      }
      if (mode === "sum-graphemes") {
        const advances2 = [];
        for (const grapheme of graphemes) {
          const graphemeMetrics = getSegmentMetrics(grapheme, cache);
          advances2.push(getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection));
        }
        metrics.breakableFitAdvances = advances2;
        return metrics.breakableFitAdvances;
      }
      if (mode === "pair-context" || graphemes.length > MAX_PREFIX_FIT_GRAPHEMES) {
        const advances2 = [];
        let previousGrapheme = null;
        let previousWidth = 0;
        for (const grapheme of graphemes) {
          const graphemeMetrics = getSegmentMetrics(grapheme, cache);
          const currentWidth = getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection);
          if (previousGrapheme === null) {
            advances2.push(currentWidth);
          } else {
            const pair = previousGrapheme + grapheme;
            const pairMetrics = getSegmentMetrics(pair, cache);
            advances2.push(getCorrectedSegmentWidth(pair, pairMetrics, emojiCorrection) - previousWidth);
          }
          previousGrapheme = grapheme;
          previousWidth = currentWidth;
        }
        metrics.breakableFitAdvances = advances2;
        return metrics.breakableFitAdvances;
      }
      const advances = [];
      let prefix = "";
      let prefixWidth = 0;
      for (const grapheme of graphemes) {
        prefix += grapheme;
        const prefixMetrics = getSegmentMetrics(prefix, cache);
        const nextPrefixWidth = getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection);
        advances.push(nextPrefixWidth - prefixWidth);
        prefixWidth = nextPrefixWidth;
      }
      metrics.breakableFitAdvances = advances;
      return metrics.breakableFitAdvances;
    }
    function getFontMeasurementState(font, needsEmojiCorrection) {
      const ctx = getMeasureContext();
      ctx.font = font;
      const cache = getSegmentMetricCache(font);
      const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font) : 0;
      return { cache, emojiCorrection };
    }
  
    // src/render/folia/vendor/pretext/dist/line-break.js
    function isDiscretionaryLineEnd(kinds, endSegmentIndex, endGraphemeIndex) {
      return endGraphemeIndex === 0 && endSegmentIndex > 0 && endSegmentIndex < kinds.length && kinds[endSegmentIndex - 1] === "soft-hyphen";
    }
    function consumesAtLineStart(kind) {
      return kind === "space" || kind === "zero-width-break" || kind === "soft-hyphen";
    }
    function breaksAfter(kind) {
      return kind === "space" || kind === "preserved-space" || kind === "tab" || kind === "zero-width-break" || kind === "soft-hyphen";
    }
    function normalizeLineStartSegmentIndex(prepared, segmentIndex, endSegmentIndex = prepared.widths.length) {
      while (segmentIndex < endSegmentIndex) {
        const kind = prepared.kinds[segmentIndex];
        if (!consumesAtLineStart(kind))
          break;
        segmentIndex++;
      }
      return segmentIndex;
    }
    function getTabAdvance(lineWidth, tabStopAdvance) {
      if (tabStopAdvance <= 0)
        return 0;
      const remainder = lineWidth % tabStopAdvance;
      if (Math.abs(remainder) <= 1e-6)
        return tabStopAdvance;
      return tabStopAdvance - remainder;
    }
    function getLeadingLetterSpacing(prepared, hasContent, segmentIndex) {
      return prepared.letterSpacing !== 0 && hasContent && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
    }
    function getLineEndContribution(leadingSpacing, segmentContribution) {
      return segmentContribution === 0 ? 0 : leadingSpacing + segmentContribution;
    }
    function getTabTrailingLetterSpacing(prepared, segmentIndex) {
      return prepared.letterSpacing !== 0 && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
    }
    function getWholeSegmentFitContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
      const segmentContribution = kind === "tab" ? segmentWidth + getTabTrailingLetterSpacing(prepared, segmentIndex) : prepared.lineEndFitAdvances[segmentIndex];
      return getLineEndContribution(leadingSpacing, segmentContribution);
    }
    function getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing) {
      const segmentContribution = kind === "tab" ? 0 : prepared.lineEndFitAdvances[segmentIndex];
      return getLineEndContribution(leadingSpacing, segmentContribution);
    }
    function getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
      const segmentContribution = kind === "tab" ? segmentWidth : prepared.lineEndPaintAdvances[segmentIndex];
      return getLineEndContribution(leadingSpacing, segmentContribution);
    }
    function getBreakableGraphemeAdvance(prepared, hasContent, baseAdvance) {
      return prepared.letterSpacing !== 0 && hasContent ? baseAdvance + prepared.letterSpacing : baseAdvance;
    }
    function getBreakableCandidateFitWidth(prepared, candidatePaintWidth) {
      return prepared.letterSpacing === 0 ? candidatePaintWidth : candidatePaintWidth + prepared.letterSpacing;
    }
    function getNextPreferredBreakIndex(preferredBreaks, preferredBreakIndex, graphemeEnd) {
      let lo = preferredBreakIndex;
      if (lo >= preferredBreaks.length || preferredBreaks[lo] >= graphemeEnd)
        return lo;
      let hi = preferredBreaks.length;
      lo++;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (preferredBreaks[mid] < graphemeEnd)
          lo = mid + 1;
        else
          hi = mid;
      }
      return lo;
    }
    function getTerminalLetterSpacing(prepared, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
      if (prepared.letterSpacing === 0)
        return 0;
      if (endGraphemeIndex > 0) {
        return prepared.spacingGraphemeCounts[endSegmentIndex] > 0 ? prepared.letterSpacing : 0;
      }
      if (isDiscretionaryLineEnd(prepared.kinds, endSegmentIndex, endGraphemeIndex))
        return 0;
      for (let i = endSegmentIndex - 1; i >= startSegmentIndex; i--) {
        const kind = prepared.kinds[i];
        if (kind === "space" || kind === "zero-width-break" || kind === "hard-break" || kind === "soft-hyphen")
          continue;
        if (i === startSegmentIndex && startGraphemeIndex > 0) {
          return prepared.letterSpacing;
        }
        return prepared.spacingGraphemeCounts[i] > 0 ? prepared.letterSpacing : 0;
      }
      return 0;
    }
    function finalizeLinePaintWidth(prepared, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
      return width + getTerminalLetterSpacing(prepared, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex);
    }
    function findChunkIndexForStart(prepared, segmentIndex) {
      let lo = 0;
      let hi = prepared.chunks.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (segmentIndex < prepared.chunks[mid].consumedEndSegmentIndex) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      return lo < prepared.chunks.length ? lo : -1;
    }
    function normalizeLineStartInChunk(prepared, chunkIndex, cursor) {
      let segmentIndex = cursor.segmentIndex;
      if (cursor.graphemeIndex > 0)
        return chunkIndex;
      for (let currentChunkIndex = chunkIndex; currentChunkIndex < prepared.chunks.length; currentChunkIndex++) {
        const chunk = prepared.chunks[currentChunkIndex];
        if (chunk.startSegmentIndex === chunk.endSegmentIndex && segmentIndex === chunk.startSegmentIndex) {
          cursor.segmentIndex = segmentIndex;
          cursor.graphemeIndex = 0;
          return currentChunkIndex;
        }
        if (segmentIndex < chunk.startSegmentIndex)
          segmentIndex = chunk.startSegmentIndex;
        segmentIndex = normalizeLineStartSegmentIndex(prepared, segmentIndex, chunk.endSegmentIndex);
        if (segmentIndex < chunk.endSegmentIndex) {
          cursor.segmentIndex = segmentIndex;
          cursor.graphemeIndex = 0;
          return currentChunkIndex;
        }
        if (chunk.consumedEndSegmentIndex >= prepared.widths.length)
          return -1;
        segmentIndex = chunk.consumedEndSegmentIndex;
        cursor.segmentIndex = segmentIndex;
        cursor.graphemeIndex = 0;
      }
      return -1;
    }
    function normalizePreparedLineStart(prepared, cursor) {
      if (cursor.segmentIndex >= prepared.widths.length)
        return -1;
      const chunkIndex = findChunkIndexForStart(prepared, cursor.segmentIndex);
      if (chunkIndex < 0)
        return -1;
      return normalizeLineStartInChunk(prepared, chunkIndex, cursor);
    }
    function normalizeLineStartChunkIndexFromHint(prepared, chunkIndex, cursor) {
      if (cursor.segmentIndex >= prepared.widths.length)
        return -1;
      let nextChunkIndex = chunkIndex;
      while (nextChunkIndex < prepared.chunks.length && cursor.segmentIndex >= prepared.chunks[nextChunkIndex].consumedEndSegmentIndex) {
        nextChunkIndex++;
      }
      if (nextChunkIndex >= prepared.chunks.length)
        return -1;
      return normalizeLineStartInChunk(prepared, nextChunkIndex, cursor);
    }
    function walkPreparedLinesSimple(prepared, maxWidth, onLine) {
      const { widths, kinds, breakableFitAdvances, breakablePreferredBreaks } = prepared;
      if (widths.length === 0)
        return 0;
      const engineProfile = getEngineProfile();
      const lineFitEpsilon = engineProfile.lineFitEpsilon;
      const fitLimit = maxWidth + lineFitEpsilon;
      let lineCount = 0;
      let lineW = 0;
      let hasContent = false;
      let lineStartSegmentIndex = 0;
      let lineStartGraphemeIndex = 0;
      let lineEndSegmentIndex = 0;
      let lineEndGraphemeIndex = 0;
      let pendingBreakSegmentIndex = -1;
      let pendingBreakPaintWidth = 0;
      function clearPendingBreak() {
        pendingBreakSegmentIndex = -1;
        pendingBreakPaintWidth = 0;
      }
      function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
        lineCount++;
        onLine?.(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
        lineW = 0;
        hasContent = false;
        clearPendingBreak();
      }
      function startLineAtSegment(segmentIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = 0;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
        lineW = width;
      }
      function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
        hasContent = true;
        lineStartSegmentIndex = segmentIndex;
        lineStartGraphemeIndex = graphemeIndex;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = graphemeIndex + 1;
        lineW = width;
      }
      function appendWholeSegment(segmentIndex, width) {
        if (!hasContent) {
          startLineAtSegment(segmentIndex, width);
          return;
        }
        lineW += width;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
      }
      function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
        const fitAdvances = breakableFitAdvances[segmentIndex];
        const preferredBreaks = breakablePreferredBreaks[segmentIndex] ?? null;
        let preferredBreakIndex = preferredBreaks === null ? -1 : getNextPreferredBreakIndex(preferredBreaks, 0, startGraphemeIndex + 1);
        let lastPreferredBreakEnd = -1;
        let lastPreferredBreakWidth = 0;
        let g = startGraphemeIndex;
        while (g < fitAdvances.length) {
          const gw = fitAdvances[g];
          if (!hasContent) {
            startLineAtGrapheme(segmentIndex, g, gw);
          } else if (lineW + gw > fitLimit) {
            if (preferredBreaks !== null && lastPreferredBreakEnd > startGraphemeIndex) {
              emitCurrentLine(segmentIndex, lastPreferredBreakEnd, lastPreferredBreakWidth);
              g = lastPreferredBreakEnd;
              preferredBreakIndex = getNextPreferredBreakIndex(preferredBreaks, preferredBreakIndex, g + 1);
              lastPreferredBreakEnd = -1;
              lastPreferredBreakWidth = 0;
              continue;
            }
            emitCurrentLine();
            startLineAtGrapheme(segmentIndex, g, gw);
          } else {
            lineW += gw;
            lineEndSegmentIndex = segmentIndex;
            lineEndGraphemeIndex = g + 1;
          }
          const graphemeEnd = g + 1;
          if (preferredBreaks !== null && preferredBreaks[preferredBreakIndex] === graphemeEnd) {
            lastPreferredBreakEnd = graphemeEnd;
            lastPreferredBreakWidth = lineW;
            preferredBreakIndex++;
          }
          g++;
        }
        if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
          lineEndSegmentIndex = segmentIndex + 1;
          lineEndGraphemeIndex = 0;
        }
      }
      let i = 0;
      while (i < widths.length) {
        if (!hasContent) {
          i = normalizeLineStartSegmentIndex(prepared, i);
          if (i >= widths.length)
            break;
        }
        const w = widths[i];
        const kind = kinds[i];
        const breakAfter = breaksAfter(kind);
        if (!hasContent) {
          if (w > fitLimit && breakableFitAdvances[i] !== null) {
            appendBreakableSegmentFrom(i, 0);
          } else {
            startLineAtSegment(i, w);
          }
          if (breakAfter) {
            pendingBreakSegmentIndex = i + 1;
            pendingBreakPaintWidth = lineW - w;
          }
          i++;
          continue;
        }
        const newW = lineW + w;
        if (newW > fitLimit) {
          if (breakAfter) {
            appendWholeSegment(i, w);
            emitCurrentLine(i + 1, 0, lineW - w);
            i++;
            continue;
          }
          if (pendingBreakSegmentIndex >= 0) {
            if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
              emitCurrentLine();
              continue;
            }
            emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
            continue;
          }
          if (w > fitLimit && breakableFitAdvances[i] !== null) {
            emitCurrentLine();
            appendBreakableSegmentFrom(i, 0);
            i++;
            continue;
          }
          emitCurrentLine();
          continue;
        }
        appendWholeSegment(i, w);
        if (breakAfter) {
          pendingBreakSegmentIndex = i + 1;
          pendingBreakPaintWidth = lineW - w;
        }
        i++;
      }
      if (hasContent)
        emitCurrentLine();
      return lineCount;
    }
    function walkPreparedLinesRaw(prepared, maxWidth, onLine) {
      if (prepared.simpleLineWalkFastPath)
        return walkPreparedLinesSimple(prepared, maxWidth, onLine);
      const cursor = { segmentIndex: 0, graphemeIndex: 0 };
      const chunkIndex = normalizePreparedLineStart(prepared, cursor);
      return walkPreparedComplexLines(prepared, cursor, chunkIndex, maxWidth, onLine).lineCount;
    }
    function walkPreparedComplexLines(prepared, cursor, chunkIndex, maxWidth, onLine, lineLimit = Number.POSITIVE_INFINITY) {
      const { widths, kinds, breakableFitAdvances, breakablePreferredBreaks, discretionaryHyphenWidth } = prepared;
      const engineProfile = getEngineProfile();
      const lineFitEpsilon = engineProfile.lineFitEpsilon;
      const fitLimit = maxWidth + lineFitEpsilon;
      let lineStartSegmentIndex;
      let lineStartGraphemeIndex;
      let lineW;
      let hasContent;
      let lineEndSegmentIndex;
      let lineEndGraphemeIndex;
      let pendingBreakSegmentIndex;
      let pendingBreakFitWidth;
      let pendingBreakPaintWidth;
      let pendingBreakKind;
      function getCurrentLinePaintWidth() {
        return pendingBreakKind === "soft-hyphen" && pendingBreakSegmentIndex === lineEndSegmentIndex && lineEndGraphemeIndex === 0 ? pendingBreakPaintWidth : lineW;
      }
      function finishLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = getCurrentLinePaintWidth()) {
        if (!hasContent)
          return null;
        cursor.segmentIndex = endSegmentIndex;
        cursor.graphemeIndex = endGraphemeIndex;
        return finalizeLinePaintWidth(prepared, width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
      }
      function startLineAtSegment(segmentIndex, width) {
        hasContent = true;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
        lineW = width;
      }
      function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
        hasContent = true;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = graphemeIndex + 1;
        lineW = width;
      }
      function appendWholeSegment(segmentIndex, advance) {
        if (!hasContent) {
          startLineAtSegment(segmentIndex, advance);
          return;
        }
        lineW += advance;
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
      }
      function updatePendingBreakForWholeSegment(kind, breakAfter, segmentIndex, segmentWidth, leadingSpacing, advance) {
        if (!breakAfter)
          return;
        const fitAdvance = getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing);
        const paintAdvance = getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth);
        pendingBreakSegmentIndex = segmentIndex + 1;
        pendingBreakFitWidth = lineW - advance + fitAdvance;
        pendingBreakPaintWidth = lineW - advance + paintAdvance;
        pendingBreakKind = kind;
      }
      function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
        const fitAdvances = breakableFitAdvances[segmentIndex];
        const preferredBreaks = breakablePreferredBreaks[segmentIndex] ?? null;
        let preferredBreakIndex = preferredBreaks === null ? -1 : getNextPreferredBreakIndex(preferredBreaks, 0, startGraphemeIndex + 1);
        let lastPreferredBreakEnd = -1;
        let lastPreferredBreakWidth = 0;
        for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
          const baseGw = fitAdvances[g];
          if (!hasContent) {
            startLineAtGrapheme(segmentIndex, g, baseGw);
          } else {
            const gw = getBreakableGraphemeAdvance(prepared, true, baseGw);
            const candidatePaintWidth = lineW + gw;
            if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
              if (preferredBreaks !== null && lastPreferredBreakEnd > startGraphemeIndex) {
                return finishLine(segmentIndex, lastPreferredBreakEnd, lastPreferredBreakWidth);
              }
              return finishLine();
            }
            lineW = candidatePaintWidth;
            lineEndSegmentIndex = segmentIndex;
            lineEndGraphemeIndex = g + 1;
          }
          const graphemeEnd = g + 1;
          if (preferredBreaks !== null && preferredBreaks[preferredBreakIndex] === graphemeEnd) {
            lastPreferredBreakEnd = graphemeEnd;
            lastPreferredBreakWidth = lineW;
            preferredBreakIndex++;
          }
        }
        if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
          lineEndSegmentIndex = segmentIndex + 1;
          lineEndGraphemeIndex = 0;
        }
        return null;
      }
      let lineCount = 0;
      let lastLineWidth = null;
      while (chunkIndex >= 0 && lineCount < lineLimit) {
        lineStartSegmentIndex = cursor.segmentIndex;
        lineStartGraphemeIndex = cursor.graphemeIndex;
        lineW = 0;
        hasContent = false;
        lineEndSegmentIndex = cursor.segmentIndex;
        lineEndGraphemeIndex = cursor.graphemeIndex;
        pendingBreakSegmentIndex = -1;
        pendingBreakFitWidth = 0;
        pendingBreakPaintWidth = 0;
        pendingBreakKind = null;
        const chunk = prepared.chunks[chunkIndex];
        let lineWidth = null;
        if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
          cursor.segmentIndex = chunk.consumedEndSegmentIndex;
          cursor.graphemeIndex = 0;
          lineWidth = 0;
        } else {
          lineLoop: for (let i = cursor.segmentIndex; i < chunk.endSegmentIndex; i++) {
            const kind = kinds[i];
            const breakAfter = breaksAfter(kind);
            const startGraphemeIndex = i === cursor.segmentIndex ? cursor.graphemeIndex : 0;
            const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i);
            const w = kind === "tab" ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance) : widths[i];
            const advance = leadingSpacing + w;
            const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w);
            if (kind === "soft-hyphen" && startGraphemeIndex === 0) {
              if (hasContent) {
                lineEndSegmentIndex = i + 1;
                lineEndGraphemeIndex = 0;
                if (i + 1 < chunk.endSegmentIndex) {
                  pendingBreakSegmentIndex = i + 1;
                  pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
                  pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
                  pendingBreakKind = kind;
                }
              }
              continue;
            }
            if (!hasContent) {
              if (startGraphemeIndex > 0) {
                const line = appendBreakableSegmentFrom(i, startGraphemeIndex);
                if (line !== null) {
                  lineWidth = line;
                  break lineLoop;
                }
              } else if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
                const line = appendBreakableSegmentFrom(i, 0);
                if (line !== null) {
                  lineWidth = line;
                  break lineLoop;
                }
              } else {
                startLineAtSegment(i, w);
              }
              updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
              continue;
            }
            const newFitW = lineW + fitAdvance;
            if (newFitW > fitLimit) {
              const currentBreakFitWidth = lineW + getBreakOpportunityFitContribution(prepared, kind, i, leadingSpacing);
              const currentBreakPaintWidth = lineW + getLineEndPaintContribution(prepared, kind, i, leadingSpacing, w);
              if (breakAfter && currentBreakFitWidth <= fitLimit) {
                appendWholeSegment(i, advance);
                lineWidth = finishLine(i + 1, 0, currentBreakPaintWidth);
                break lineLoop;
              }
              if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
                if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
                  lineWidth = finishLine();
                  break lineLoop;
                }
                lineWidth = finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
                break lineLoop;
              }
              lineWidth = finishLine();
              break lineLoop;
            }
            appendWholeSegment(i, advance);
            updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
          }
          if (lineWidth === null) {
            lineWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex && lineEndGraphemeIndex === 0 ? finishLine(chunk.consumedEndSegmentIndex, 0, pendingBreakPaintWidth) : finishLine(chunk.consumedEndSegmentIndex, 0, lineW);
          }
        }
        if (lineWidth === null)
          break;
        lastLineWidth = lineWidth;
        lineCount++;
        onLine?.(lineWidth, lineStartSegmentIndex, lineStartGraphemeIndex, cursor.segmentIndex, cursor.graphemeIndex);
        if (lineCount < lineLimit)
          chunkIndex = normalizeLineStartChunkIndexFromHint(prepared, chunkIndex, cursor);
      }
      return { lineCount, lastLineWidth };
    }
  
    // src/render/folia/vendor/pretext/dist/line-text.js
    var sharedLineTextCaches = /* @__PURE__ */ new WeakMap();
    function getSegmentGraphemeOffsets(segmentIndex, segments, cache) {
      let offsets = cache.get(segmentIndex);
      if (offsets !== void 0)
        return offsets;
      offsets = [0];
      const graphemeSegmenter3 = getSharedGraphemeSegmenter();
      for (const gs of graphemeSegmenter3.segment(segments[segmentIndex])) {
        offsets.push(gs.index + gs.segment.length);
      }
      cache.set(segmentIndex, offsets);
      return offsets;
    }
    function getLineTextCache(prepared) {
      let cache = sharedLineTextCaches.get(prepared);
      if (cache !== void 0)
        return cache;
      cache = /* @__PURE__ */ new Map();
      sharedLineTextCaches.set(prepared, cache);
      return cache;
    }
    function buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
      let text = "";
      for (let i = startSegmentIndex; i < endSegmentIndex; i++) {
        if (prepared.kinds[i] === "soft-hyphen" || prepared.kinds[i] === "hard-break")
          continue;
        if (i === startSegmentIndex && startGraphemeIndex > 0) {
          const offsets = getSegmentGraphemeOffsets(i, prepared.segments, cache);
          text += prepared.segments[i].slice(offsets[startGraphemeIndex]);
        } else {
          text += prepared.segments[i];
        }
      }
      if (endGraphemeIndex > 0) {
        const offsets = getSegmentGraphemeOffsets(endSegmentIndex, prepared.segments, cache);
        text += prepared.segments[endSegmentIndex].slice(offsets[startSegmentIndex === endSegmentIndex ? startGraphemeIndex : 0], offsets[endGraphemeIndex]);
      }
      return isDiscretionaryLineEnd(prepared.kinds, endSegmentIndex, endGraphemeIndex) ? text + "-" : text;
    }
  
    // src/render/folia/vendor/pretext/dist/layout.js
    function createEmptyPrepared(includeSegments) {
      if (includeSegments) {
        return {
          widths: [],
          lineEndFitAdvances: [],
          lineEndPaintAdvances: [],
          kinds: [],
          simpleLineWalkFastPath: true,
          segLevels: null,
          breakableFitAdvances: [],
          breakablePreferredBreaks: [],
          letterSpacing: 0,
          spacingGraphemeCounts: [],
          discretionaryHyphenWidth: 0,
          tabStopAdvance: 0,
          chunks: [],
          segments: []
        };
      }
      return {
        widths: [],
        lineEndFitAdvances: [],
        lineEndPaintAdvances: [],
        kinds: [],
        simpleLineWalkFastPath: true,
        segLevels: null,
        breakableFitAdvances: [],
        breakablePreferredBreaks: [],
        letterSpacing: 0,
        spacingGraphemeCounts: [],
        discretionaryHyphenWidth: 0,
        tabStopAdvance: 0,
        chunks: []
      };
    }
    function countRenderedSpacingGraphemes(text, kind) {
      if (kind === "zero-width-break" || kind === "soft-hyphen" || kind === "hard-break") {
        return 0;
      }
      if (kind === "tab")
        return 1;
      let count = 0;
      const graphemeSegmenter3 = getSharedGraphemeSegmenter();
      for (const _ of graphemeSegmenter3.segment(text))
        count++;
      return count;
    }
    function addInternalLetterSpacing(width, graphemeCount, letterSpacing) {
      return graphemeCount > 1 ? width + (graphemeCount - 1) * letterSpacing : width;
    }
    function measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing) {
      const engineProfile = getEngineProfile();
      const { cache, emojiCorrection } = getFontMeasurementState(font, textMayContainEmoji(analysis.normalized));
      const discretionaryHyphenWidth = getCorrectedSegmentWidth("-", getSegmentMetrics("-", cache), emojiCorrection) + (letterSpacing === 0 ? 0 : letterSpacing * 2);
      const spaceWidth = getCorrectedSegmentWidth(" ", getSegmentMetrics(" ", cache), emojiCorrection);
      const tabStopAdvance = spaceWidth * 8;
      const hasLetterSpacing = letterSpacing !== 0;
      if (analysis.len === 0)
        return createEmptyPrepared(includeSegments);
      const widths = [];
      const lineEndFitAdvances = [];
      const lineEndPaintAdvances = [];
      const kinds = [];
      let simpleLineWalkFastPath = !hasLetterSpacing;
      const segStarts = includeSegments ? [] : null;
      const breakableFitAdvances = [];
      const breakablePreferredBreaks = [];
      const spacingGraphemeCounts = [];
      const segments = includeSegments ? [] : null;
      const chunks = [];
      let chunkStartSegmentIndex = 0;
      function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, breakableFitAdvance, breakablePreferredBreak, spacingGraphemeCount) {
        if (kind !== "text" && kind !== "space" && kind !== "zero-width-break") {
          simpleLineWalkFastPath = false;
        }
        widths.push(width);
        lineEndFitAdvances.push(lineEndFitAdvance);
        lineEndPaintAdvances.push(lineEndPaintAdvance);
        kinds.push(kind);
        segStarts?.push(start);
        breakableFitAdvances.push(breakableFitAdvance);
        breakablePreferredBreaks.push(breakablePreferredBreak);
        if (hasLetterSpacing)
          spacingGraphemeCounts.push(spacingGraphemeCount);
        if (segments !== null)
          segments.push(text);
      }
      function pushMeasuredTextSegment(text, textMetrics, kind, start, allowOverflowBreaks) {
        const spacingGraphemeCount = hasLetterSpacing ? countRenderedSpacingGraphemes(text, kind) : 0;
        const width = addInternalLetterSpacing(getCorrectedSegmentWidth(text, textMetrics, emojiCorrection), spacingGraphemeCount, letterSpacing);
        const baseLineEndFitAdvance = kind === "space" || kind === "preserved-space" || kind === "zero-width-break" ? 0 : width;
        const lineEndFitAdvance = baseLineEndFitAdvance === 0 ? 0 : baseLineEndFitAdvance + (spacingGraphemeCount > 0 ? letterSpacing : 0);
        const lineEndPaintAdvance = kind === "space" || kind === "zero-width-break" ? 0 : width;
        if (allowOverflowBreaks && text.length > 1) {
          let fitMode = "sum-graphemes";
          if (letterSpacing !== 0) {
            fitMode = "segment-prefixes";
          } else if (isNumericRunSegment(text)) {
            fitMode = "pair-context";
          } else if (engineProfile.preferPrefixWidthsForBreakableRuns) {
            fitMode = "segment-prefixes";
          }
          const fitAdvances = getSegmentBreakableFitAdvances(text, textMetrics, cache, emojiCorrection, fitMode);
          const preferredBreaks = fitAdvances === null || wordBreak === "keep-all" ? null : getBreakablePreferredBreaks(text);
          pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, fitAdvances, preferredBreaks, spacingGraphemeCount);
          return;
        }
        pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, null, null, spacingGraphemeCount);
      }
      for (let mi = 0; mi < analysis.len; mi++) {
        const segText = analysis.texts[mi];
        const segKind = analysis.kinds[mi];
        const segStart = analysis.starts[mi];
        if (segKind === "soft-hyphen") {
          pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, segStart, null, null, 0);
          continue;
        }
        if (segKind === "hard-break") {
          const endSegmentIndex = widths.length;
          pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, null, 0);
          chunks.push({
            startSegmentIndex: chunkStartSegmentIndex,
            endSegmentIndex,
            consumedEndSegmentIndex: widths.length
          });
          chunkStartSegmentIndex = widths.length;
          continue;
        }
        if (segKind === "tab") {
          pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, null, hasLetterSpacing ? countRenderedSpacingGraphemes(segText, segKind) : 0);
          continue;
        }
        if (segKind === "text" && isCJK(segText)) {
          const measuredUnits = getCjkTextUnits(segText, engineProfile, wordBreak);
          for (let i = 0; i < measuredUnits.length; i++) {
            const unit = measuredUnits[i];
            const unitMetrics = getSegmentMetrics(unit.text, cache);
            pushMeasuredTextSegment(unit.text, unitMetrics, "text", segStart + unit.start, unit.overflow === "grapheme" || analysis.isWordLike[mi] && (wordBreak === "keep-all" || unit.overflow === "word-like"));
          }
          continue;
        }
        pushMeasuredTextSegment(segText, getSegmentMetrics(segText, cache), segKind, segStart, segKind === "text" && (analysis.isWordLike[mi] || isIndependentSymbolRun(segText)));
      }
      if (chunkStartSegmentIndex < widths.length) {
        chunks.push({
          startSegmentIndex: chunkStartSegmentIndex,
          endSegmentIndex: widths.length,
          consumedEndSegmentIndex: widths.length
        });
      }
      const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
      if (segments !== null) {
        return {
          widths,
          lineEndFitAdvances,
          lineEndPaintAdvances,
          kinds,
          simpleLineWalkFastPath,
          segLevels,
          breakableFitAdvances,
          breakablePreferredBreaks,
          letterSpacing,
          spacingGraphemeCounts,
          discretionaryHyphenWidth,
          tabStopAdvance,
          chunks,
          segments
        };
      }
      return {
        widths,
        lineEndFitAdvances,
        lineEndPaintAdvances,
        kinds,
        simpleLineWalkFastPath,
        segLevels,
        breakableFitAdvances,
        breakablePreferredBreaks,
        letterSpacing,
        spacingGraphemeCounts,
        discretionaryHyphenWidth,
        tabStopAdvance,
        chunks
      };
    }
    function prepareInternal(text, font, includeSegments, options) {
      const wordBreak = options?.wordBreak ?? "normal";
      const letterSpacing = options?.letterSpacing ?? 0;
      const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace, wordBreak);
      return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing);
    }
    function prepareWithSegments(text, font, options) {
      return prepareInternal(text, font, true, options);
    }
    function getInternalPrepared(prepared) {
      return prepared;
    }
    function createLayoutLine(prepared, cache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
      return {
        text: buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex),
        width,
        start: {
          segmentIndex: startSegmentIndex,
          graphemeIndex: startGraphemeIndex
        },
        end: {
          segmentIndex: endSegmentIndex,
          graphemeIndex: endGraphemeIndex
        }
      };
    }
    function layoutWithLines(prepared, maxWidth, lineHeight) {
      const lines = [];
      if (prepared.widths.length === 0)
        return { lineCount: 0, height: 0, lines };
      const graphemeCache = getLineTextCache(prepared);
      const lineCount = walkPreparedLinesRaw(getInternalPrepared(prepared), maxWidth, (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
        lines.push(createLayoutLine(prepared, graphemeCache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex));
      });
      return { lineCount, height: lineCount * lineHeight, lines };
    }
  
    // src/render/folia/components/visualizer/pendolo/pendoloGeometry.ts
    var resolvePendoloWheelCenterX = (viewportWidth, tuning) => tuning.mirrorLayout === true ? viewportWidth * (1 - tuning.wheelCenterX) : viewportWidth * tuning.wheelCenterX;
    function calculatePendoloWheelLayout(lines, targetLineIndex, escapementAngleOffsetRad, viewportWidth, viewportHeight, tuning, radiusOffsetPx = 0, lineBlockHeights) {
      const mirrored = tuning.mirrorLayout === true;
      const centerX = resolvePendoloWheelCenterX(viewportWidth, tuning);
      const sideSign = mirrored ? -1 : 1;
      const centerY = viewportHeight * tuning.wheelCenterY;
      const baseRadius = Math.min(viewportWidth, viewportHeight) * tuning.arcRadius + radiusOffsetPx;
      const totalArcRad = tuning.arcAngleDeg * Math.PI / 180;
      const visibleWindowCount = 9;
      const angleStepRad = totalArcRad / Math.max(1, visibleWindowCount - 1);
      const isIntegerTarget = Number.isInteger(targetLineIndex);
      const activeIndex = isIntegerTarget && targetLineIndex >= 0 && targetLineIndex < lines.length ? targetLineIndex : -1;
      const hasActive = activeIndex >= 0;
      const items = [];
      const centerRef = Math.max(0, Math.min(lines.length - 1, Math.floor(targetLineIndex >= 0 ? targetLineIndex : 0)));
      const windowStart = Math.max(0, centerRef - 8);
      const windowEnd = Math.min(lines.length - 1, centerRef + 8);
      const visualAngles = /* @__PURE__ */ new Map();
      if (Number.isInteger(targetLineIndex) && targetLineIndex >= windowStart && targetLineIndex <= windowEnd) {
        const activeIndex2 = targetLineIndex;
        visualAngles.set(activeIndex2, 0);
        for (let index = activeIndex2 + 1; index <= windowEnd; index += 1) {
          const previousHeight = lineBlockHeights?.[index - 1] ?? 0;
          const currentHeight = lineBlockHeights?.[index] ?? 0;
          const spacing = Math.max(angleStepRad, (previousHeight + currentHeight + 24) / (2 * baseRadius));
          visualAngles.set(index, (visualAngles.get(index - 1) ?? 0) + spacing);
        }
        for (let index = activeIndex2 - 1; index >= windowStart; index -= 1) {
          const nextHeight = lineBlockHeights?.[index + 1] ?? 0;
          const currentHeight = lineBlockHeights?.[index] ?? 0;
          const spacing = Math.max(angleStepRad, (nextHeight + currentHeight + 24) / (2 * baseRadius));
          visualAngles.set(index, (visualAngles.get(index + 1) ?? 0) - spacing);
        }
      }
      for (let i = windowStart; i <= windowEnd; i++) {
        const line = lines[i];
        if (!line) continue;
        const distanceIndex = i - targetLineIndex;
        const rawAngleRad = (visualAngles.get(i) ?? distanceIndex * angleStepRad) + escapementAngleOffsetRad;
        if (Math.abs(rawAngleRad) >= Math.PI / 2) continue;
        const x = centerX + sideSign * baseRadius * Math.cos(rawAngleRad);
        const y = centerY + baseRadius * Math.sin(rawAngleRad);
        const isActive = hasActive && i === activeIndex;
        const absDistance = Math.abs(distanceIndex);
        const alpha = Math.max(0.12, Math.pow(Math.cos(rawAngleRad * 0.75), 2.5) * (1 - absDistance * 0.18));
        const scale = isActive ? tuning.activeScale : Math.max(0.7, 1 - absDistance * 0.08);
        items.push({
          line,
          index: i,
          angleRad: rawAngleRad,
          angleDeg: rawAngleRad * 180 / Math.PI,
          x,
          y,
          isActive,
          distanceFromActive: absDistance,
          alpha,
          scale
        });
      }
      return items;
    }
  
    // src/render/folia/utils/lyrics/graphemeTiming.ts
    var graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
    var splitLyricGraphemes = (text) => {
      if (!text) {
        return [];
      }
      if (graphemeSegmenter) {
        return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
      }
      return Array.from(text);
    };
    var buildEvenGraphemeTimings = (text, startTime, endTime, wordIndex) => {
      const graphemes = splitLyricGraphemes(text);
      if (graphemes.length === 0) {
        return [];
      }
      const duration = Math.max(endTime - startTime, 0);
      const unitDuration = duration / graphemes.length;
      return graphemes.map((char, index) => ({
        char,
        startTime: startTime + unitDuration * index,
        endTime: index === graphemes.length - 1 ? endTime : startTime + unitDuration * (index + 1),
        ...typeof wordIndex === "number" ? { wordIndex } : {}
      }));
    };
    var buildWordGraphemeTimings = (word, wordIndex) => {
      if (!word.syllables?.length) {
        return buildEvenGraphemeTimings(word.text, word.startTime, word.endTime, wordIndex);
      }
      return word.syllables.flatMap(
        (syllable) => buildEvenGraphemeTimings(syllable.text, syllable.startTime, syllable.endTime, wordIndex)
      );
    };
    var findGraphemeSequence = (source, target, fromIndex) => {
      if (target.length === 0) {
        return fromIndex;
      }
      for (let index = fromIndex; index <= source.length - target.length; index += 1) {
        let matched = true;
        for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
          if (source[index + targetIndex] !== target[targetIndex]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          return index;
        }
      }
      return -1;
    };
    var buildLineGraphemeTimeline = (line) => {
      const lineGraphemes = splitLyricGraphemes(line.fullText);
      if (lineGraphemes.length === 0) {
        return [];
      }
      if (line.words.length === 0) {
        return buildEvenGraphemeTimings(line.fullText, line.startTime, line.endTime);
      }
      const timeline = [];
      let cursor = 0;
      let lastResolvedTime = line.startTime;
      line.words.forEach((word, wordIndex) => {
        const wordGraphemes = splitLyricGraphemes(word.text);
        if (wordGraphemes.length === 0) {
          return;
        }
        const matchedStart = findGraphemeSequence(lineGraphemes, wordGraphemes, cursor);
        const start = matchedStart >= 0 ? matchedStart : cursor;
        const end = Math.min(start + wordGraphemes.length, lineGraphemes.length);
        for (let gapIndex = cursor; gapIndex < start; gapIndex += 1) {
          timeline[gapIndex] = {
            char: lineGraphemes[gapIndex],
            startTime: word.startTime,
            endTime: word.startTime
          };
        }
        const wordTimings = buildWordGraphemeTimings(word, wordIndex);
        for (let localIndex = 0; localIndex < end - start; localIndex += 1) {
          const timing = wordTimings[localIndex] ?? buildEvenGraphemeTimings(
            wordGraphemes[localIndex] ?? "",
            word.startTime,
            word.endTime,
            wordIndex
          )[0];
          if (!timing) {
            continue;
          }
          timeline[start + localIndex] = {
            ...timing,
            char: lineGraphemes[start + localIndex]
          };
          lastResolvedTime = Math.max(lastResolvedTime, timing.endTime);
        }
        cursor = Math.max(cursor, end);
      });
      for (let index = 0; index < lineGraphemes.length; index += 1) {
        if (timeline[index]) {
          continue;
        }
        timeline[index] = {
          char: lineGraphemes[index],
          startTime: lastResolvedTime,
          endTime: lastResolvedTime
        };
      }
      return timeline;
    };
  
    // src/render/folia/utils/lyrics/subtitleTrackStyle.ts
    var SECONDARY_TRACK_SIZE_FACTOR = 0.88;
    var SECONDARY_TRACK_OPACITY = 0.82;
    var SECONDARY_TRACK_FONT_WEIGHT_FALLBACK = 400;
    var SECONDARY_TRACK_GAP_EM = 0.25;
  
    // src/render/folia/utils/lyrics/estimatedLineTiming.ts
    var buildTimedWords = (text, startTime, endTime) => {
      const duration = Math.max(endTime - startTime, 0.1);
      const rawTokens = text.split(/\s+/).filter((token) => token);
      const words = [];
      const tokens = [];
      let totalWeight = 0;
      for (const token of rawTokens) {
        if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(token)) {
          splitLyricGraphemes(token).forEach((char) => {
            const isPunctuation = /[，。！？、：；"'）]/.test(char);
            const weight = isPunctuation ? 0 : 1;
            tokens.push({ text: char, weight });
            totalWeight += weight;
          });
        } else {
          const weight = 1 + token.length * 0.15;
          tokens.push({ text: token, weight });
          totalWeight += weight;
        }
      }
      if (totalWeight === 0) {
        totalWeight = 1;
      }
      const activeDuration = duration * 0.9;
      const timePerWeight = activeDuration / totalWeight;
      let currentWordStart = startTime;
      tokens.forEach((token) => {
        const wordDuration = token.weight * timePerWeight;
        const finalDuration = Math.max(wordDuration, 0.05);
        words.push({
          text: token.text,
          startTime: currentWordStart,
          endTime: currentWordStart + finalDuration
        });
        if (token.weight > 0) {
          currentWordStart += wordDuration;
        } else {
          currentWordStart += 0.05;
        }
      });
      if (words.length > 0) {
        const lastWord = words[words.length - 1];
        if (lastWord.endTime > endTime) {
          const scale = (endTime - startTime) / (lastWord.endTime - startTime);
          words.forEach((word) => {
            word.startTime = startTime + (word.startTime - startTime) * scale;
            word.endTime = startTime + (word.endTime - startTime) * scale;
          });
        }
      }
      return words;
    };
    var estimateLrcLineEndTime = (text, startTime, nextStartTime) => {
      let duration = nextStartTime !== void 0 ? nextStartTime - startTime : 5;
      const estimatedReadingTime = text.length * 0.5;
      if (duration > estimatedReadingTime + 2 && duration > 5) {
        duration = Math.min(duration, estimatedReadingTime + 2);
      }
      return startTime + duration;
    };
  
    // src/render/folia/components/visualizer/wordColoring.ts
    var CJK_REGEX = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/;
    var isCJK2 = (text) => CJK_REGEX.test(text);
    var normalizeWordColorToken = (text) => text.toLowerCase().replace(/[^\w]/g, "");
    var resolveWordColorEntryText = (entry) => {
      if (!entry || typeof entry !== "object" || !("word" in entry)) {
        return "";
      }
      const word = entry.word;
      return typeof word === "string" ? word.trim() : "";
    };
    var resolveWordColorEntryColor = (entry) => {
      if (!entry || typeof entry !== "object" || !("color" in entry)) {
        return "";
      }
      const color = entry.color;
      return typeof color === "string" ? color : "";
    };
    var rangesOverlap = (a, b) => a.startOffset < b.endOffset && b.startOffset < a.endOffset;
    var selectNonOverlappingRanges = (ranges) => {
      const selected = [];
      const prioritySorted = [...ranges].sort((a, b) => b.priority - a.priority || a.startOffset - b.startOffset || a.endOffset - b.endOffset);
      prioritySorted.forEach((range) => {
        if (!selected.some((current) => rangesOverlap(current, range))) {
          selected.push(range);
        }
      });
      return selected.sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
    };
    var prepareWordColorMatchers = (wordColors, keywordColoringEnabled = true) => {
      if (!keywordColoringEnabled || !wordColors || wordColors.length === 0) {
        return [];
      }
      return wordColors.flatMap((entry) => {
        const target = resolveWordColorEntryText(entry);
        if (!target) {
          return [];
        }
        const color = resolveWordColorEntryColor(entry);
        if (!color) {
          return [];
        }
        if (isCJK2(target)) {
          return [{
            color,
            cjkPhrases: [target],
            englishWords: [],
            priority: target.length
          }];
        }
        const englishWords = target.split(/\s+/).map(normalizeWordColorToken).filter(Boolean);
        if (englishWords.length === 0) {
          return [];
        }
        return [{
          color,
          cjkPhrases: [],
          englishWords,
          priority: Math.max(...englishWords.map((word) => word.length))
        }];
      });
    };
    var buildWordColorRangesFromMatchers = (lineText, matchers) => {
      if (!lineText || matchers.length === 0) {
        return [];
      }
      const ranges = [];
      const englishColorByWord = /* @__PURE__ */ new Map();
      matchers.forEach((matcher) => {
        matcher.cjkPhrases.forEach((target) => {
          let cursor = 0;
          while (cursor < lineText.length) {
            const startOffset = lineText.indexOf(target, cursor);
            if (startOffset < 0) {
              break;
            }
            ranges.push({
              startOffset,
              endOffset: startOffset + target.length,
              color: matcher.color,
              priority: matcher.priority
            });
            cursor = startOffset + Math.max(target.length, 1);
          }
        });
        matcher.englishWords.forEach((word) => {
          const current = englishColorByWord.get(word);
          if (!current || matcher.priority > current.priority) {
            englishColorByWord.set(word, { color: matcher.color, priority: matcher.priority });
          }
        });
      });
      if (englishColorByWord.size > 0) {
        const wordRegex = /\w+/g;
        let match;
        while ((match = wordRegex.exec(lineText)) !== null) {
          const wordColor = englishColorByWord.get(normalizeWordColorToken(match[0]));
          if (wordColor) {
            ranges.push({
              startOffset: match.index,
              endOffset: match.index + match[0].length,
              color: wordColor.color,
              priority: wordColor.priority
            });
          }
        }
      }
      return selectNonOverlappingRanges(ranges);
    };
    var resolveTokenColorMap = (tokens, ranges) => {
      const colors = /* @__PURE__ */ new Map();
      let rangeIndex = 0;
      tokens.forEach((token) => {
        if (!token.timed) {
          return;
        }
        while (rangeIndex < ranges.length && ranges[rangeIndex].endOffset <= token.startOffset) {
          rangeIndex += 1;
        }
        const range = ranges[rangeIndex];
        if (range && rangesOverlap(range, token)) {
          colors.set(token.key, range.color);
        }
      });
      return colors;
    };
  
    // src/render/folia/components/visualizer/monet/monetLyricsModel.ts
    var MONET_GRAPHEME_OFFSETS_CACHE_LIMIT = 420;
    var monetGraphemeOffsetsCache = /* @__PURE__ */ new Map();
    var graphemeSegmenter2 = typeof Intl !== "undefined" ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
    var splitMonetGraphemes = (text) => {
      if (!text) {
        return [];
      }
      if (graphemeSegmenter2) {
        return Array.from(graphemeSegmenter2.segment(text), ({ segment }) => segment);
      }
      return Array.from(text);
    };
    var measureTextWidthAtPx = (text, fontPx, fontSpec) => {
      const prepared = prepareWithSegments(text || " ", fontSpec);
      const layout = layoutWithLines(prepared, 99999, fontPx * 1.2);
      return layout.lines[0]?.width ?? Math.max(text.length, 1) * fontPx * 0.6;
    };
    var buildGraphemeOffsetsCacheKey = (text, fontPx, fontSpec) => `${fontPx}|${fontSpec}|${text}`;
    var measureMonetGraphemeOffsets = (text, fontPx, fontSpec) => {
      const cacheKey = buildGraphemeOffsetsCacheKey(text, fontPx, fontSpec);
      const cached = monetGraphemeOffsetsCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const offsets = measurePrefixOffsets(
        splitMonetGraphemes(text),
        (prefix) => measureTextWidthAtPx(prefix, fontPx, fontSpec)
      );
      return rememberBounded(monetGraphemeOffsetsCache, cacheKey, offsets, MONET_GRAPHEME_OFFSETS_CACHE_LIMIT);
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloTextLayout.ts
    var buildPendoloTextLayout = (text, fontSpec, maxWidth, lineHeight) => {
      const prepared = prepareWithSegments(text || " ", fontSpec, {
        whiteSpace: "pre-wrap"
      });
      const layout = layoutWithLines(prepared, Math.max(1, maxWidth), lineHeight);
      let graphemeCursor = 0;
      const lines = layout.lines.map((line) => {
        const graphemeCount = splitLyricGraphemes(line.text).length;
        const result = {
          text: line.text,
          width: line.width,
          graphemeStart: graphemeCursor,
          graphemeEnd: graphemeCursor + graphemeCount
        };
        graphemeCursor += graphemeCount;
        return result;
      });
      return {
        lines,
        lineHeight,
        height: Math.max(lines.length, 1) * lineHeight
      };
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloColorRuns.ts
    var buildPendoloColorRuns = (text, graphemeStart, tokenColors, fallbackColor) => {
      const runs = [];
      splitLyricGraphemes(text).forEach((grapheme, localIndex) => {
        const color = tokenColors.get(String(graphemeStart + localIndex)) ?? fallbackColor;
        const previous = runs[runs.length - 1];
        if (previous?.color === color) {
          previous.text += grapheme;
          return;
        }
        runs.push({ key: `${graphemeStart + localIndex}-${color}`, text: grapheme, color });
      });
      return runs;
    };
  
    // src/render/folia/components/visualizer/pendolo/PendoloActiveLyricSweep.tsx
    var PendoloSweepLine = ({
      layoutLine,
      timings,
      currentTime,
      fontPx,
      fontSpec,
      lineHeight,
      lineEndTime,
      primaryTextColor,
      colorRuns,
      glowFilter,
      glowPaddingPx
    }) => {
      const graphemeOffsets = useMemo(
        () => measureMonetGraphemeOffsets(layoutLine.text, fontPx, fontSpec),
        [fontPx, fontSpec, layoutLine.text]
      );
      const fillWidth = useTransform(currentTime, (latest) => {
        const fullWidth = graphemeOffsets[graphemeOffsets.length - 1] ?? layoutLine.width;
        if (timings.length === 0) return latest >= lineEndTime ? fullWidth : 0;
        if (latest <= timings[0].startTime) return 0;
        for (let index = 0; index < timings.length; index += 1) {
          const timing = timings[index];
          const startWidth = graphemeOffsets[index] ?? 0;
          const endWidth = graphemeOffsets[index + 1] ?? startWidth;
          if (latest < timing.startTime) return startWidth;
          if (latest <= timing.endTime) {
            return startWidth + (endWidth - startWidth) * ((latest - timing.startTime) / Math.max(1e-3, timing.endTime - timing.startTime));
          }
        }
        return fullWidth;
      });
      const maskImage = useTransform(fillWidth, (width) => {
        const edgeSoftness = Math.min(Math.max(fontPx * 0.42, 8), 16);
        const paddedFillWidth = glowPaddingPx + width;
        return `linear-gradient(90deg, #000 0px, #000 ${Math.max(paddedFillWidth - edgeSoftness, 0)}px, rgba(0, 0, 0, 0.84) ${paddedFillWidth}px, transparent ${paddedFillWidth + edgeSoftness}px)`;
      });
      const fillOpacity = useTransform(currentTime, (latest) => latest < (timings[0]?.startTime ?? lineEndTime) ? 0 : 1);
      return /* @__PURE__ */ jsxs("span", { className: "relative block whitespace-pre overflow-visible", style: { width: `${layoutLine.width}px`, height: `${lineHeight}px` }, children: [
        /* @__PURE__ */ jsx("span", { style: { color: colorWithAlpha(primaryTextColor, 0.52) }, children: colorRuns.map((run) => /* @__PURE__ */ jsx("span", { children: run.text }, run.key)) }),
        /* @__PURE__ */ jsx(
          "span",
          {
            "aria-hidden": true,
            className: "pointer-events-none absolute inset-0 block whitespace-pre overflow-visible",
            children: /* @__PURE__ */ jsx(
              "span",
              {
                className: "absolute block whitespace-pre overflow-visible",
                style: {
                  inset: `${-glowPaddingPx}px`,
                  filter: glowFilter
                },
                children: /* @__PURE__ */ jsx(
                  motion.span,
                  {
                    className: "absolute inset-0 block whitespace-pre",
                    style: {
                      boxSizing: "border-box",
                      padding: `${glowPaddingPx}px`,
                      opacity: fillOpacity,
                      WebkitMaskImage: maskImage,
                      maskImage,
                      WebkitMaskSize: "100% 100%",
                      maskSize: "100% 100%",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat"
                    },
                    children: colorRuns.map((run) => /* @__PURE__ */ jsx("span", { style: { color: run.color }, children: run.text }, run.key))
                  }
                )
              }
            )
          }
        )
      ] });
    };
    var PendoloActiveLyricSweep = ({
      line,
      currentTime,
      fontFamily,
      fontWeight,
      maxWidth,
      primaryTextColor,
      accentTextColor,
      fontPx = 28,
      wordColors,
      isChorus = false,
      accentMix = 0.32,
      chorusGlowMultiplier = 0,
      alignRight = false,
      alignCenter = false
    }) => {
      const text = line.fullText;
      const fontSpec = `${fontWeight} ${fontPx}px ${fontFamily}`;
      const graphemeTimings = useMemo(() => buildLineGraphemeTimeline(line), [line]);
      const matchers = useMemo(() => prepareWordColorMatchers(wordColors ?? [], true), [wordColors]);
      const wordColorRanges = useMemo(
        () => buildWordColorRangesFromMatchers(text, matchers),
        [text, matchers]
      );
      const charTokens = useMemo(() => {
        let cursor = 0;
        return splitLyricGraphemes(text).map((char, index) => {
          const startOffset = cursor;
          cursor += char.length;
          return {
            key: String(index),
            timed: true,
            startOffset,
            endOffset: cursor
          };
        });
      }, [text]);
      const tokenColors = useMemo(
        () => resolveTokenColorMap(charTokens, wordColorRanges),
        [charTokens, wordColorRanges]
      );
      const lineHeight = Math.round(fontPx * 1.2);
      const textLayout = useMemo(
        () => buildPendoloTextLayout(text, fontSpec, maxWidth, lineHeight),
        [fontSpec, lineHeight, maxWidth, text]
      );
      const fillColor = mixColors(primaryTextColor, accentTextColor, accentMix);
      const colorRunsByLine = useMemo(
        () => textLayout.lines.map((layoutLine) => buildPendoloColorRuns(
          layoutLine.text,
          layoutLine.graphemeStart,
          tokenColors,
          fillColor
        )),
        [fillColor, textLayout.lines, tokenColors]
      );
      const glowFilter = isChorus ? `drop-shadow(0 0 ${Math.round(fontPx * 0.3 * chorusGlowMultiplier)}px ${colorWithAlpha(fillColor, 0.72)}) drop-shadow(0 0 ${Math.round(fontPx * 0.62 * chorusGlowMultiplier)}px ${colorWithAlpha(accentTextColor, 0.28)})` : void 0;
      const glowPaddingPx = isChorus ? Math.ceil(fontPx * 0.7 * chorusGlowMultiplier + 10) : 0;
      const textLayoutStyle = {
        fontSize: `${fontPx}px`,
        lineHeight: `${lineHeight}px`,
        width: `${maxWidth}px`,
        ...alignCenter || alignRight ? { display: "flex", flexDirection: "column", alignItems: alignCenter ? "center" : "flex-end" } : null
      };
      return /* @__PURE__ */ jsx("span", { className: "block", style: textLayoutStyle, children: textLayout.lines.map((layoutLine, index) => /* @__PURE__ */ jsx(
        PendoloSweepLine,
        {
          layoutLine,
          timings: graphemeTimings.slice(layoutLine.graphemeStart, layoutLine.graphemeEnd),
          currentTime,
          fontPx,
          fontSpec,
          lineHeight: textLayout.lineHeight,
          lineEndTime: line.endTime,
          primaryTextColor,
          colorRuns: colorRunsByLine[index] ?? [],
          glowFilter,
          glowPaddingPx
        },
        `${layoutLine.graphemeStart}-${layoutLine.graphemeEnd}`
      )) });
    };
    var PendoloActiveLyricSweep_default = PendoloActiveLyricSweep;
  
    // src/render/folia/components/visualizer/pendolo/pendoloSubtitleTracks.ts
    var FOCAL_SUBTITLE_PX = 16;
    var IDLE_SUBTITLE_PX = 12;
    var LEAD_TRACK_GAP_EM = 0.25;
    var LEAD_TRACK_FONT_WEIGHT_FALLBACK = 500;
    var SUBTITLE_LINE_HEIGHT_RATIO = 1.5;
    var READABLE_TEXT_PATTERN = /[\p{L}\p{N}]/u;
    var isPendoloReadableSubtitle = (text) => READABLE_TEXT_PATTERN.test(text);
    var resolvePendoloSubtitleTracks = (line, { mode, hidden, focal, subtitleFontScale }) => {
      if (hidden) {
        return [];
      }
      const basePx = (focal ? FOCAL_SUBTITLE_PX : IDLE_SUBTITLE_PX) * subtitleFontScale;
      return resolveLyricSubtitleTracks(line, mode, isPendoloReadableSubtitle).map((track, index) => {
        const isSecondary = index > 0;
        const fontPx = Math.round(isSecondary ? basePx * SECONDARY_TRACK_SIZE_FACTOR : basePx);
        return {
          role: track.role,
          text: track.text,
          fontPx,
          lineHeightPx: fontPx * SUBTITLE_LINE_HEIGHT_RATIO,
          fontWeightFallback: isSecondary ? SECONDARY_TRACK_FONT_WEIGHT_FALLBACK : LEAD_TRACK_FONT_WEIGHT_FALLBACK,
          gapEm: isSecondary ? SECONDARY_TRACK_GAP_EM : LEAD_TRACK_GAP_EM,
          opacityFactor: isSecondary ? SECONDARY_TRACK_OPACITY : 1
        };
      });
    };
    var buildPendoloSubtitleFontSpec = (track, fontWeight, fontFamily) => `${fontWeight} ${track.fontPx}px ${fontFamily}`;
    var sumPendoloSubtitleTrackHeights = (tracks, measureText) => {
      let total = 0;
      for (const track of tracks) {
        total += measureText(track) + track.gapEm * track.fontPx;
      }
      return total;
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloMotionProfile.ts
    var PENDOLO_MOTION_PROFILES = {
      calm: {
        balanceSpeedMultiplier: 0.72,
        balanceAmplitudeMultiplier: 0.58,
        bassResponseMultiplier: 0.62,
        escapementSpringMultiplier: 0.72,
        escapementDampingMultiplier: 1.2,
        chorusHaloOpacity: 0.22,
        chorusHaloScale: 1.012,
        chorusGlowMultiplier: 0.72,
        chorusTransitionDuration: 0.52
      },
      normal: {
        balanceSpeedMultiplier: 1,
        balanceAmplitudeMultiplier: 1,
        bassResponseMultiplier: 1,
        escapementSpringMultiplier: 1,
        escapementDampingMultiplier: 1,
        chorusHaloOpacity: 0.34,
        chorusHaloScale: 1.026,
        chorusGlowMultiplier: 1,
        chorusTransitionDuration: 0.42
      },
      chaotic: {
        balanceSpeedMultiplier: 1.3,
        balanceAmplitudeMultiplier: 1.42,
        bassResponseMultiplier: 1.38,
        escapementSpringMultiplier: 1.3,
        escapementDampingMultiplier: 0.84,
        chorusHaloOpacity: 0.5,
        chorusHaloScale: 1.045,
        chorusGlowMultiplier: 1.42,
        chorusTransitionDuration: 0.3
      }
    };
    var resolvePendoloMotionProfile = (intensity) => intensity === "calm" || intensity === "chaotic" ? PENDOLO_MOTION_PROFILES[intensity] : PENDOLO_MOTION_PROFILES.normal;
    var resolvePendoloChorusPresentation = (isChorus, isPlaybackActive, profile) => {
      const isActive = Boolean(isChorus && isPlaybackActive);
      return {
        isActive,
        accentMix: isActive ? 0.58 : 0.32,
        haloOpacity: isActive ? profile.chorusHaloOpacity : 0,
        haloScale: isActive ? profile.chorusHaloScale : 1,
        glowMultiplier: isActive ? profile.chorusGlowMultiplier : 0,
        transitionDuration: profile.chorusTransitionDuration
      };
    };
  
    // src/render/folia/components/visualizer/pendolo/pendoloTimeline.ts
    var resolvePendoloFallbackAnchorIndex = (lines, currentLineIndex, lastValidLineIndex, hasObservedLine, currentTime) => {
      if (currentLineIndex >= 0 && currentLineIndex < lines.length) {
        return currentLineIndex;
      }
      if (!hasObservedLine) {
        return -1;
      }
      const finalLine = lines.at(-1);
      const finalRenderEndTime = finalLine?.renderHints?.renderEndTime ?? finalLine?.endTime;
      if (finalRenderEndTime !== void 0 && currentTime > finalRenderEndTime) {
        return lines.length;
      }
      return lastValidLineIndex + 0.5;
    };
    var PENDOLO_VISIBLE_ARC_DEG = 110;
    var PENDOLO_EDGE_FADE_DEG = 28;
    var resolvePendoloRotatingLineOpacity = (baseAngleDeg, wheelRotationDeg, baseOpacity) => {
      const visibleAngleDeg = Math.abs(baseAngleDeg + wheelRotationDeg);
      if (visibleAngleDeg >= PENDOLO_VISIBLE_ARC_DEG) return 0;
      const edgeProgress = Math.min(1, (PENDOLO_VISIBLE_ARC_DEG - visibleAngleDeg) / PENDOLO_EDGE_FADE_DEG);
      return baseOpacity * edgeProgress;
    };
  
    // src/render/folia/components/visualizer/pendolo/PendoloRotatingLine.tsx
    var PENDOLO_STAND_FADE_DEG = 65;
    var PENDOLO_STAND_HIDE_DEG = 75;
    var resolvePendoloStandEdgeFade = (angleDeg) => Math.max(
      0,
      Math.min(1, (PENDOLO_STAND_HIDE_DEG - Math.abs(angleDeg)) / (PENDOLO_STAND_HIDE_DEG - PENDOLO_STAND_FADE_DEG))
    );
    var PendoloRotatingLine = ({
      wheelRotationDeg,
      mirrored = false,
      railWidth = 0,
      baseAngleDeg,
      baseOpacity,
      left,
      top,
      hubX = 0,
      hubY = 0,
      waveRadius,
      waveBand,
      waveStrength,
      waveX,
      waveY,
      standUp,
      fontFamily,
      fontWeight,
      canSeek,
      onClick,
      children
    }) => {
      const lensInputs = waveRadius && waveBand && waveStrength ? waveX && waveY ? [waveRadius, waveBand, waveStrength, waveX, waveY, wheelRotationDeg] : [waveRadius, waveBand, waveStrength] : null;
      const resolveLens = (values) => {
        let originX = 0;
        let originY = 0;
        if (values.length > 3 && (values[3] !== 0 || values[4] !== 0)) {
          const turn = -values[5] * Math.PI / 180;
          originX = values[3] * Math.cos(turn) - values[4] * Math.sin(turn);
          originY = values[3] * Math.sin(turn) + values[4] * Math.cos(turn);
        }
        return resolvePendoloLineWave(left - hubX - originX, top - hubY - originY, values[0], values[1], values[2]);
      };
      const opacity = useTransform(
        lensInputs ? [wheelRotationDeg, ...lensInputs] : [wheelRotationDeg],
        ([rotationDeg, ...lens]) => {
          const unmirrored = mirrored ? -rotationDeg : rotationDeg;
          let base = resolvePendoloRotatingLineOpacity(baseAngleDeg, unmirrored, baseOpacity);
          if (standUp) base *= resolvePendoloStandEdgeFade(baseAngleDeg + unmirrored);
          return lens.length ? resolvePendoloLitOpacity(base, resolveLens(lens).light) : base;
        }
      );
      const standPointerEvents = useTransform(opacity, (value) => value < 0.01 ? "none" : "auto");
      const x = useTransform(lensInputs ?? [wheelRotationDeg], (values) => lensInputs ? resolveLens(values).x : 0);
      const y = useTransform(lensInputs ?? [wheelRotationDeg], (values) => lensInputs ? resolveLens(values).y : 0);
      return /* @__PURE__ */ jsx(
        motion.div,
        {
          className: `absolute pointer-events-auto ${canSeek ? "cursor-pointer" : ""}`,
          style: {
            ...mirrored ? { right: railWidth - left } : { left },
            top,
            // 立起来时绕锚点那条线转（盒子顶边就是锚点所在的高度），句子才正对刻度针，不往一侧偏半行字高
            transformOrigin: `${mirrored ? "right" : "left"} ${standUp ? "top" : "center"}`,
            x,
            y,
            // 先绕 X 轴立起来（字的上方朝离开表盘、略向后仰到正对相机），再在平面内转向相机
            ...standUp ? { rotate: standUp.rotationDeg, rotateX: standUp.tiltDeg } : null,
            // 总是写这一项：从轮心视角切回平放时 motion 不会清掉去掉的样式键，留着 none 就点不到了
            pointerEvents: standUp ? standPointerEvents : "auto",
            opacity,
            fontFamily,
            fontWeight
          },
          onClick,
          children
        }
      );
    };
    var PendoloRotatingLine_default = react_shim_default.memo(PendoloRotatingLine);
  
    // src/render/folia/services/analysis/drumHits.ts
    var DRUM_KICK = 1;
    var DRUM_SNARE = 2;
    var DRUM_HAT = 3;
    var getDrumHits = (_key) => null;
  
    // src/render/folia/components/visualizer/pendolo/usePendoloBeatFx.ts
    var resolvePendoloWaveReach = (layout) => Math.hypot(
      Math.max(layout.centerX, layout.viewportWidth - layout.centerX),
      Math.max(layout.centerY, layout.viewportHeight - layout.centerY)
    ) * 1.05;
    var PENDOLO_BEAT_LIST_FX = false;
    var DRUM_MAX_STEP_SECONDS = 0.25;
    var DRUM_TILT_SHARE = 0.4;
    var DRUM_TILT_PX = 10;
    var DRUM_TILT_DECAY = 9;
    var DRUM_TILT_HZ = 8;
    var DRUM_BREATH = 0.035;
    var DRUM_BREATH_HZ = 6;
    var DRUM_BREATH_SECONDS = 0.15;
    var DRUM_SHAKE_SHARE = 0.6;
    var DRUM_GLOW_FALL_SECONDS = 0.15;
    var DRUM_GLOW_SCALE = 0.55;
    var DRUM_HAT_LIGHT = 0.7;
    var readDrumFrame = (hits, key, time, cursor, out) => {
      out.kick = 0;
      out.snare = 0;
      out.hat = 0;
      if (time === null) {
        cursor.time = null;
        return;
      }
      const seek = cursor.key !== key || cursor.time === null || time < cursor.time || time - cursor.time > DRUM_MAX_STEP_SECONDS;
      if (seek) {
        let next = 0;
        while (next < hits.times.length && hits.times[next] <= time) next += 1;
        cursor.key = key;
        cursor.time = time;
        cursor.next = next;
        cursor.list = hits;
        return;
      }
      if (cursor.list !== hits) {
        let next = 0;
        while (next < hits.times.length && hits.times[next] <= (cursor.time ?? time)) next += 1;
        cursor.next = next;
        cursor.list = hits;
      }
      while (cursor.next < hits.times.length && hits.times[cursor.next] <= time) {
        const strength = hits.strengths[cursor.next];
        const kind = hits.kinds[cursor.next];
        if (kind === DRUM_KICK) out.kick = Math.max(out.kick, strength);
        else if (kind === DRUM_SNARE) out.snare = Math.max(out.snare, strength);
        else if (kind === DRUM_HAT) out.hat = Math.max(out.hat, strength);
        cursor.next += 1;
      }
      cursor.time = time;
    };
    var usePendoloBeatFx = (enabled, layout, accentColor) => {
      const shared = useRef({
        active: false,
        state: createPendoloBeatFxState(),
        now: 0,
        wave: null,
        color: resolvePendoloBeatFxColor(accentColor)
      });
      const waveRadius = useMotionValue(0);
      const waveBand = useMotionValue(0);
      const waveStrength = useMotionValue(0);
      const shakeX = useMotionValue(0);
      const shakeY = useMotionValue(0);
      const haloScale = useMotionValue(0);
      const haloOpacity = useMotionValue(0);
      const waveX = useMotionValue(0);
      const waveY = useMotionValue(0);
      const haloX = useMotionValue(0);
      const haloY = useMotionValue(0);
      const breath = useMotionValue(1);
      const color = useMemo(() => resolvePendoloBeatFxColor(accentColor), [accentColor]);
      useEffect(() => {
        shared.current.color = color;
      }, [color]);
      const meshPoints = useMemo(
        () => resolvePendoloMeshPoints(layout),
        [layout.baseRadius, layout.centerX, layout.centerY, layout.lyricRingRadius]
      );
      const layoutRef = useRef({ layout, meshPoints });
      layoutRef.current = { layout, meshPoints };
      useEffect(() => {
        const rest = () => {
          shared.current.active = false;
          shared.current.wave = null;
          shared.current.state = createPendoloBeatFxState();
          for (const value of [waveRadius, waveBand, waveStrength, shakeX, shakeY, haloScale, haloOpacity, waveX, waveY, haloX, haloY]) {
            if (value.get() !== 0) value.set(0);
          }
          if (breath.get() !== 1) breath.set(1);
        };
        if (!enabled) {
          rest();
          return void 0;
        }
        const counter = createPendoloBeatCounter();
        const triggers = readPendoloBeatTriggers(counter);
        let last = null;
        let frame = 0;
        const drumCursor = { key: null, time: null, next: 0, list: null };
        const drumFrame = { kick: 0, snare: 0, hat: 0 };
        const drumScaled = { kick: 0, snare: 0, hat: 0 };
        let glow = 0;
        const tilt = { x: 0, y: 0, amount: 0, at: 0 };
        const swell = { amount: 0, at: 0 };
        const step = (timestamp) => {
          frame = window.requestAnimationFrame(step);
          const now = timestamp / 1e3;
          const dt = last === null ? 0 : Math.min(0.05, now - last);
          last = now;
          const drumStrength = getBeatEffectStrength(BEAT_EFFECT_IDS.pendoloDrumhead);
          const heard = getBeatFxHeard();
          const known = drumStrength > 0 ? getDrumHits(heard.key) : null;
          const hits = known && (known.until === void 0 || heard.time === null || heard.time < known.until) ? known : null;
          const drumHits = hits !== null;
          if (!drumHits && (!PENDOLO_BEAT_LIST_FX || !isBeatFxReady())) {
            counter.synced = false;
            glow = 0;
            if (shared.current.active) rest();
            return;
          }
          const { layout: current, meshPoints: points } = layoutRef.current;
          readPendoloBeatTriggers(counter, triggers);
          if (hits) {
            readDrumFrame(hits, heard.key, heard.time, drumCursor, drumFrame);
            drumScaled.kick = drumFrame.kick * drumStrength;
            drumScaled.snare = drumFrame.snare * drumStrength;
            drumScaled.hat = drumFrame.hat * drumStrength;
            triggers.beats = 0;
            triggers.downbeats = 0;
            triggers.beatAccentGain = 0;
            triggers.downbeatAccentGain = 0;
          }
          const snareStrike = drumHits && drumFrame.snare > drumFrame.kick;
          const state = stepPendoloBeatFx(shared.current.state, triggers, {
            now,
            dt,
            beatPeriod: getBeatFxBeatPeriod(),
            // No sparks off the drum hits: they are the downbeat's, and there are no downbeats here.
            meshPoints: drumHits ? [] : points,
            random: Math.random
          });
          if (drumHits) {
            glow *= Math.exp(-dt / DRUM_GLOW_FALL_SECONDS);
            const hit = Math.max(drumFrame.kick, drumFrame.snare);
            if (hit > 0) {
              const punch = resolvePendoloWavePunch(hit, drumStrength);
              glow = Math.max(glow, punch);
              state.jewelFlare = Math.max(state.jewelFlare, punch);
              state.smallJewelFlare = Math.max(state.smallJewelFlare, punch);
              state.tickDialLight = Math.max(state.tickDialLight, punch);
              state.outerDialLight = Math.max(state.outerDialLight, punch);
            }
            if (snareStrike) {
              const angle = Math.random() * Math.PI * 2;
              if (drumFrame.snare >= DRUM_TILT_SHARE) Object.assign(tilt, { x: Math.cos(angle), y: Math.sin(angle), amount: drumScaled.snare, at: now });
            } else if (drumFrame.kick > 0) {
              Object.assign(swell, { amount: drumScaled.kick, at: now });
              if (drumFrame.kick >= DRUM_SHAKE_SHARE) state.shake = Math.max(state.shake, Math.min(1.5, drumScaled.kick));
            }
            if (drumFrame.hat > 0) state.tickDialLight = Math.max(state.tickDialLight, Math.min(1, DRUM_HAT_LIGHT * drumScaled.hat));
            if (glow < 5e-3) glow = 0;
          }
          const maxRadius = resolvePendoloWaveReach(current);
          const wave = resolvePendoloWave(state, now, current.baseRadius, maxRadius);
          lightPendoloDials(state, wave, current.baseRadius);
          shared.current.active = true;
          shared.current.now = now;
          shared.current.wave = wave;
          waveRadius.set(wave?.radius ?? 0);
          waveBand.set(wave?.band ?? 0);
          waveStrength.set(wave?.strength ?? 0);
          waveX.set(wave?.x ?? 0);
          waveY.set(wave?.y ?? 0);
          haloX.set(drumHits ? 0 : wave?.x ?? 0);
          haloY.set(drumHits ? 0 : wave?.y ?? 0);
          if (drumHits) {
            haloOpacity.set(glow);
            haloScale.set(DRUM_GLOW_SCALE + (1 - DRUM_GLOW_SCALE) * glow);
          } else {
            haloOpacity.set(wave ? resolvePendoloHaloOpacity(state, now) : 0);
            if (wave) haloScale.set(wave.radius / maxRadius);
          }
          const shake = resolvePendoloShake(state, Math.random);
          if (drumHits) {
            const since = now - tilt.at;
            const lean = tilt.amount * Math.exp(-DRUM_TILT_DECAY * since) * Math.cos(2 * Math.PI * DRUM_TILT_HZ * since);
            if (Math.abs(lean) >= 0.01) {
              shake.x += tilt.x * DRUM_TILT_PX * lean;
              shake.y += tilt.y * DRUM_TILT_PX * lean;
            }
            const grown = now - swell.at;
            const swellNow = swell.amount * Math.exp(-grown / DRUM_BREATH_SECONDS) * Math.cos(2 * Math.PI * DRUM_BREATH_HZ * grown);
            breath.set(Math.abs(swellNow) < 0.01 ? 1 : 1 + DRUM_BREATH * swellNow);
          } else if (breath.get() !== 1) {
            breath.set(1);
          }
          shakeX.set(shake.x);
          shakeY.set(shake.y);
        };
        frame = window.requestAnimationFrame(step);
        return () => {
          window.cancelAnimationFrame(frame);
          rest();
        };
      }, [breath, enabled, haloOpacity, haloScale, shakeX, shakeY, waveBand, waveRadius, waveStrength, waveX, waveY, haloX, haloY]);
      return { shared, waveRadius, waveBand, waveStrength, shakeX, shakeY, haloScale, haloOpacity, waveX, waveY, haloX, haloY, breath, color };
    };
  
    // src/render/folia/stores/useVisualizerSettingsStore.ts
    var STATE = {
      smartBeat: { mode: "off", effects: {} }
    };
    var useVisualizerSettingsStore = (selector) => {
      if (typeof selector === "function") return selector(STATE);
      return STATE;
    };
  
    // src/render/folia/components/visualizer/pendolo/VisualizerPendolo.tsx
    var PENDOLO_SCROLL_IDLE_RESET_MS = 2500;
    var PENDOLO_HALO_ALPHA = 0.45;
    var PENDOLO_SCROLL_STEP_PX = 90;
    var PENDOLO_TOUCH_STEP_PX = 60;
    var PENDOLO_SCROLL_EVENT_OPTIONS = { passive: false };
    var READY_GRACE_MS = 3e3;
    var INSTRUMENTAL_COMMIT_SECONDS = 2;
    var INSTRUMENTAL_SECONDS_PER_FRAME = 5;
    var getScrollDirection = (delta) => {
      if (Math.abs(delta) < 1) return 0;
      return delta > 0 ? 1 : -1;
    };
    var clampScrollSteps = (steps) => {
      if (Math.abs(steps) > 5) return steps > 0 ? 5 : -5;
      return steps;
    };
    var PENDOLO_STAND_SIDE_LINE_ALPHA_MIN = 0.18;
    var PENDOLO_STAND_SIDE_LINE_FULL_DISTANCE = 4;
    var resolvePendoloStandSideLineAlpha = (distance) => Math.min(
      1,
      // 间奏时没有焦点句，最近的两句离刻度针只有半档：按紧挨着的一句算，不再往下压
      PENDOLO_STAND_SIDE_LINE_ALPHA_MIN + (1 - PENDOLO_STAND_SIDE_LINE_ALPHA_MIN) * (Math.max(1, distance) - 1) / (PENDOLO_STAND_SIDE_LINE_FULL_DISTANCE - 1)
    );
    var VisualizerPendolo = (props) => {
      const {
        currentTime,
        currentLineIndex,
        lines,
        theme,
        audioBands,
        audioPower,
        showText = true,
        showSubtitleTranslation = true,
        subtitleContentMode = "translation",
        pendoloTuning = DEFAULT_PENDOLO_TUNING,
        onLyricLineSeek,
        lyricsFontScale = 1,
        subtitleTheme,
        subtitleOverlayOpacity,
        subtitleOverlayBackground,
        subtitleFontScale,
        isPlayerChromeHidden = false,
        hideTranslationSubtitle = false,
        isPreviewMode = false
      } = props;
      const renderQuality = useLyricRenderQuality(pendoloTuning.render);
      const clockworkRenderScale = isPreviewMode ? 1 : renderQuality.scale;
      const clockworkAntialias = isPreviewMode ? true : resolveLyricAntialias(renderQuality.antialias, true);
      const [viewportSize, setViewportSize] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 1920,
        height: typeof window !== "undefined" ? window.innerHeight : 1080
      });
      const visualizerRef = useRef(null);
      useEffect(() => {
        const element = visualizerRef.current;
        if (!element) return;
        const updateViewportSize = () => {
          const width = Math.round(element.clientWidth);
          const height = Math.round(element.clientHeight);
          if (width === 0 || height === 0) return;
          setViewportSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
        };
        updateViewportSize();
        const observer = new ResizeObserver(updateViewportSize);
        observer.observe(element);
        return () => {
          observer.disconnect();
        };
      }, []);
      const lastValidLineIndexRef = react_shim_default.useRef(0);
      const hasObservedLineRef = useRef(false);
      if (currentLineIndex >= 0 && currentLineIndex < lines.length) {
        lastValidLineIndexRef.current = currentLineIndex;
        hasObservedLineRef.current = true;
      }
      const wheelRailRef = useRef(null);
      const [manualScrollAnchorIndex, setManualScrollAnchorIndex] = useState(null);
      const manualScrollResetRef = useRef(null);
      const wheelAccumulatorRef = useRef(0);
      const wheelDirectionRef = useRef(0);
      const touchLastYRef = useRef(null);
      const touchAccumulatorRef = useRef(0);
      const touchDirectionRef = useRef(0);
      const pendingSeekIndexRef = useRef(null);
      const getFallbackAnchorIndex = useCallback(() => {
        if (manualScrollAnchorIndex !== null) return manualScrollAnchorIndex;
        return resolvePendoloFallbackAnchorIndex(
          lines,
          currentLineIndex,
          lastValidLineIndexRef.current,
          hasObservedLineRef.current,
          currentTime.get()
        );
      }, [currentLineIndex, currentTime, lines, manualScrollAnchorIndex]);
      const [isInstrumental, setIsInstrumental] = useState(false);
      const lyricsSig = lines.length === 0 ? "" : `${lines.length}|${lines[0]?.fullText ?? ""}`;
      const seedRef = useRef(props.seed);
      useEffect(() => {
        if (lyricsSig !== "") {
          setIsInstrumental(false);
          seedRef.current = props.seed;
          return void 0;
        }
        if (props.seed !== seedRef.current) {
          setIsInstrumental(false);
          seedRef.current = props.seed;
        }
        let raf = 0;
        let sawReset = false;
        const startWall = performance.now();
        const watch = () => {
          const t = currentTime.get();
          const capped = performance.now() - startWall >= READY_GRACE_MS;
          if (!sawReset && t < 1) sawReset = true;
          if (sawReset && t >= INSTRUMENTAL_COMMIT_SECONDS || capped) {
            setIsInstrumental(true);
            return;
          }
          raf = requestAnimationFrame(watch);
        };
        raf = requestAnimationFrame(watch);
        return () => cancelAnimationFrame(raf);
      }, [props.seed, lyricsSig, currentTime]);
      const [instrumentalIndex, setInstrumentalIndex] = useState(0);
      const instrumentalIndexRef = useRef(0);
      useEffect(() => {
        if (!isInstrumental) return void 0;
        let raf = 0;
        const tick = () => {
          const t = currentTime.get();
          const idx = Math.floor(t / INSTRUMENTAL_SECONDS_PER_FRAME);
          if (idx !== instrumentalIndexRef.current) {
            instrumentalIndexRef.current = idx;
            setInstrumentalIndex(idx);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }, [isInstrumental, currentTime]);
      const targetLineIndex = useMemo(() => {
        if (lines.length === 0) {
          return isInstrumental ? instrumentalIndex : 0;
        }
        return getFallbackAnchorIndex();
      }, [getFallbackAnchorIndex, lines.length, isInstrumental, instrumentalIndex]);
      const scheduleManualScrollReset = useCallback(() => {
        if (manualScrollResetRef.current !== null) {
          window.clearTimeout(manualScrollResetRef.current);
        }
        manualScrollResetRef.current = window.setTimeout(() => {
          setManualScrollAnchorIndex(null);
          wheelAccumulatorRef.current = 0;
          wheelDirectionRef.current = 0;
          touchAccumulatorRef.current = 0;
          touchDirectionRef.current = 0;
          manualScrollResetRef.current = null;
        }, PENDOLO_SCROLL_IDLE_RESET_MS);
      }, []);
      useEffect(() => () => {
        if (manualScrollResetRef.current !== null) {
          window.clearTimeout(manualScrollResetRef.current);
        }
      }, []);
      useEffect(() => {
        if (pendingSeekIndexRef.current !== currentLineIndex) return;
        pendingSeekIndexRef.current = null;
        setManualScrollAnchorIndex(null);
      }, [currentLineIndex]);
      const moveManualScrollAnchor = useCallback((steps) => {
        if (lines.length === 0) return;
        setManualScrollAnchorIndex((current) => {
          const baseIndex = current ?? getFallbackAnchorIndex();
          return Math.max(0, Math.min(lines.length - 1, Math.round(baseIndex + steps)));
        });
        scheduleManualScrollReset();
      }, [getFallbackAnchorIndex, lines.length, scheduleManualScrollReset]);
      const handleLineSeek = useCallback((lineIndex, startTime) => {
        if (!onLyricLineSeek) return;
        if (manualScrollResetRef.current !== null) {
          window.clearTimeout(manualScrollResetRef.current);
          manualScrollResetRef.current = null;
        }
        if (lineIndex === currentLineIndex) {
          pendingSeekIndexRef.current = null;
          setManualScrollAnchorIndex(null);
          onLyricLineSeek(startTime);
          return;
        }
        pendingSeekIndexRef.current = lineIndex;
        setManualScrollAnchorIndex(lineIndex);
        wheelAccumulatorRef.current = 0;
        wheelDirectionRef.current = 0;
        touchAccumulatorRef.current = 0;
        touchDirectionRef.current = 0;
        onLyricLineSeek(startTime);
      }, [currentLineIndex, onLyricLineSeek]);
      const handleRailWheel = useCallback((event) => {
        if (lines.length === 0) return;
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        const direction = getScrollDirection(event.deltaY);
        if (direction !== 0 && wheelDirectionRef.current !== 0 && direction !== wheelDirectionRef.current) {
          wheelAccumulatorRef.current = 0;
        }
        wheelDirectionRef.current = direction || wheelDirectionRef.current;
        wheelAccumulatorRef.current += event.deltaY;
        const steps = clampScrollSteps(Math.trunc(wheelAccumulatorRef.current / PENDOLO_SCROLL_STEP_PX));
        if (steps !== 0) {
          wheelAccumulatorRef.current = 0;
          moveManualScrollAnchor(steps);
        } else {
          scheduleManualScrollReset();
        }
      }, [lines.length, moveManualScrollAnchor, scheduleManualScrollReset]);
      const handleRailTouchStart = useCallback((event) => {
        if (lines.length === 0) return;
        event.stopPropagation();
        touchLastYRef.current = event.touches[0]?.clientY ?? null;
        touchAccumulatorRef.current = 0;
        touchDirectionRef.current = 0;
        setManualScrollAnchorIndex(getFallbackAnchorIndex());
        scheduleManualScrollReset();
      }, [getFallbackAnchorIndex, lines.length, scheduleManualScrollReset]);
      const handleRailTouchMove = useCallback((event) => {
        if (lines.length === 0 || touchLastYRef.current === null) return;
        event.stopPropagation();
        const nextY = event.touches[0]?.clientY;
        if (typeof nextY !== "number") return;
        const deltaY = touchLastYRef.current - nextY;
        touchLastYRef.current = nextY;
        const direction = getScrollDirection(deltaY);
        if (direction !== 0 && touchDirectionRef.current !== 0 && direction !== touchDirectionRef.current) {
          touchAccumulatorRef.current = 0;
        }
        touchDirectionRef.current = direction || touchDirectionRef.current;
        touchAccumulatorRef.current += deltaY;
        const steps = clampScrollSteps(Math.trunc(touchAccumulatorRef.current / PENDOLO_TOUCH_STEP_PX));
        if (steps !== 0) {
          touchAccumulatorRef.current = 0;
          moveManualScrollAnchor(steps);
        } else {
          scheduleManualScrollReset();
        }
      }, [lines.length, moveManualScrollAnchor, scheduleManualScrollReset]);
      const handleRailTouchEnd = useCallback(() => {
        touchLastYRef.current = null;
        touchDirectionRef.current = 0;
        touchAccumulatorRef.current = 0;
        scheduleManualScrollReset();
      }, [scheduleManualScrollReset]);
      useEffect(() => {
        const rail = wheelRailRef.current;
        if (!rail) return void 0;
        const wheelListener = (event) => handleRailWheel(event);
        const touchStartListener = (event) => handleRailTouchStart(event);
        const touchMoveListener = (event) => handleRailTouchMove(event);
        const touchEndListener = () => handleRailTouchEnd();
        rail.addEventListener("wheel", wheelListener, PENDOLO_SCROLL_EVENT_OPTIONS);
        rail.addEventListener("touchstart", touchStartListener, PENDOLO_SCROLL_EVENT_OPTIONS);
        rail.addEventListener("touchmove", touchMoveListener, PENDOLO_SCROLL_EVENT_OPTIONS);
        rail.addEventListener("touchend", touchEndListener, PENDOLO_SCROLL_EVENT_OPTIONS);
        rail.addEventListener("touchcancel", touchEndListener, PENDOLO_SCROLL_EVENT_OPTIONS);
        return () => {
          rail.removeEventListener("wheel", wheelListener);
          rail.removeEventListener("touchstart", touchStartListener);
          rail.removeEventListener("touchmove", touchMoveListener);
          rail.removeEventListener("touchend", touchEndListener);
          rail.removeEventListener("touchcancel", touchEndListener);
        };
      }, [handleRailTouchEnd, handleRailTouchMove, handleRailTouchStart, handleRailWheel]);
      const springSnappiness = pendoloTuning.tickSnappiness;
      const motionProfile = useMemo(
        () => resolvePendoloMotionProfile(theme.animationIntensity),
        [theme.animationIntensity]
      );
      const tickSpring = useSpring(targetLineIndex, {
        stiffness: 180 * springSnappiness * motionProfile.escapementSpringMultiplier,
        damping: (18 + 4 / Math.max(0.5, springSnappiness)) * motionProfile.escapementDampingMultiplier,
        mass: 0.8
      });
      useEffect(() => {
        tickSpring.set(targetLineIndex);
      }, [targetLineIndex, tickSpring]);
      const fontFamily = useMemo(() => resolveThemeFontStack(theme), [theme]);
      const fontWeight = useMemo(() => resolveThemeFontWeight(theme, 400), [theme]);
      const mirrored = pendoloTuning.mirrorLayout === true;
      const sideSign = mirrored ? -1 : 1;
      const centerX = resolvePendoloWheelCenterX(viewportSize.width, pendoloTuning);
      const centerY = viewportSize.height * pendoloTuning.wheelCenterY;
      const baseRadius = Math.min(viewportSize.width, viewportSize.height) * pendoloTuning.arcRadius;
      const lyricRadiusOffset = Math.min(viewportSize.width, viewportSize.height) * 0.06;
      const lyricRingRadius = baseRadius + lyricRadiusOffset;
      const maxItemX = centerX + baseRadius;
      const availableTextWidth = Math.max(
        140,
        Math.min(viewportSize.width * 0.46, mirrored ? centerX - baseRadius - 48 : viewportSize.width - maxItemX - 48)
      );
      const [clockworkWebgl, setClockworkWebgl] = useState(true);
      const requestedTiltDeg = pendoloTuning.tiltDeg ?? 0;
      const tiltDeg = clockworkWebgl ? requestedTiltDeg : 0;
      const tiltAxisDeg = pendoloTuning.tiltAxisDeg ?? 0;
      const requestedHubView = pendoloTuning.hubView === true;
      const hubView = clockworkWebgl && requestedHubView;
      const hubCameraHeightPx = baseRadius * Math.max(
        pendoloTuning.hubViewHeight ?? DEFAULT_PENDOLO_TUNING.hubViewHeight ?? 1.4,
        PENDOLO_BALANCE_ICON_HEIGHT * (pendoloTuning.parallaxDepth ?? 1) + 0.15
      );
      const hubCameraBackPx = baseRadius * (pendoloTuning.hubViewBack ?? 1.2);
      const tiltProjection = useMemo(
        () => hubView ? buildPendoloHubViewProjection(
          hubCameraHeightPx,
          hubCameraBackPx,
          lyricRingRadius,
          sideSign,
          centerX,
          centerY,
          viewportSize.width,
          viewportSize.height
        ) : buildPendoloTiltProjection(tiltDeg, tiltAxisDeg, viewportSize.width, viewportSize.height),
        [centerX, centerY, hubCameraBackPx, hubCameraHeightPx, hubView, lyricRingRadius, sideSign, tiltAxisDeg, tiltDeg, viewportSize.height, viewportSize.width]
      );
      const dialProjection = useMemo(
        () => buildPendoloDialProjection(tiltProjection, mirrored),
        [mirrored, tiltProjection]
      );
      const totalArcRad = pendoloTuning.arcAngleDeg * Math.PI / 180;
      const visibleWindowCount = 9;
      const angleStepRad = totalArcRad / Math.max(1, visibleWindowCount - 1);
      const smartBeatEnabled = useVisualizerSettingsStore((state) => smartBeatActive(state.smartBeat));
      const beatFx = usePendoloBeatFx(
        smartBeatEnabled,
        {
          centerX,
          centerY,
          baseRadius,
          lyricRingRadius,
          viewportWidth: viewportSize.width,
          viewportHeight: viewportSize.height
        },
        theme.accentColor || "#3B82F6"
      );
      const wheelRotationDeg = useTransform(
        tickSpring,
        (value) => -(value - targetLineIndex) * angleStepRad * (180 / Math.PI)
      );
      const railRotationDeg = useTransform(wheelRotationDeg, (value) => value * sideSign);
      const textRotationCorrectionDeg = useTransform(railRotationDeg, (value) => -value * 0.65);
      const standUpRotationDeg = useTransform(railRotationDeg, (value) => sideSign * 90 - value);
      const gearRotationAngleRad = useTransform(tickSpring, (value) => value * angleStepRad);
      const resolvedMode = useMemo(() => resolveSubtitleContentMode(subtitleContentMode, showSubtitleTranslation), [subtitleContentMode, showSubtitleTranslation]);
      const subtitleFontFamily = useMemo(() => resolveThemeTranslationFontStack(subtitleTheme ?? theme), [subtitleTheme, theme]);
      const lineBlockHeights = useMemo(() => {
        const measureWidth = availableTextWidth / pendoloTuning.activeScale;
        return lines.map((line, index) => {
          if (Math.abs(index - targetLineIndex) > 10) {
            return 0;
          }
          const fontPx = Math.round(28 * lyricsFontScale);
          const mainHeight = buildPendoloTextLayout(
            line.fullText,
            `${fontWeight} ${fontPx}px ${fontFamily}`,
            measureWidth,
            Math.round(fontPx * 1.2)
          ).height;
          const subtitleTracks = resolvePendoloSubtitleTracks(line, {
            mode: resolvedMode,
            hidden: hideTranslationSubtitle,
            focal: true,
            subtitleFontScale: subtitleFontScale ?? 1
          });
          const translationHeight = sumPendoloSubtitleTrackHeights(subtitleTracks, (track) => buildPendoloTextLayout(
            track.text,
            buildPendoloSubtitleFontSpec(track, resolveThemeFontWeight(subtitleTheme ?? theme, track.fontWeightFallback), subtitleFontFamily),
            measureWidth,
            track.lineHeightPx
          ).height);
          return (mainHeight + translationHeight) * pendoloTuning.activeScale;
        });
      }, [availableTextWidth, fontFamily, fontWeight, hideTranslationSubtitle, lines, lyricsFontScale, pendoloTuning.activeScale, resolvedMode, subtitleFontFamily, subtitleFontScale, subtitleTheme, targetLineIndex, theme]);
      const lineItems = useMemo(() => {
        return calculatePendoloWheelLayout(
          lines,
          targetLineIndex,
          0,
          viewportSize.width,
          viewportSize.height,
          pendoloTuning,
          lyricRadiusOffset,
          lineBlockHeights
        );
      }, [lineBlockHeights, lines, targetLineIndex, viewportSize, pendoloTuning]);
      const primaryTextColor = theme.primaryColor || "#FFFFFF";
      const accentTextColor = theme.accentColor || "#3B82F6";
      const secondaryTextColor = theme.secondaryColor || "#9CA3AF";
      const balanceIconName = theme.lyricsIcons?.[0];
      const lucideIconRevision = useLucideIcons(balanceIconName ? [balanceIconName] : void 0);
      const BalanceIcon = useMemo(
        () => resolveLucideIcon(balanceIconName) ?? Star,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [balanceIconName, lucideIconRevision]
      );
      const haloReach = resolvePendoloWaveReach({
        centerX,
        centerY,
        baseRadius,
        lyricRingRadius: 0,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height
      });
      const haloBackground = useMemo(() => {
        const [r, g, b] = beatFx.color;
        const at = (alpha) => `rgba(${r},${g},${b},${alpha})`;
        return `radial-gradient(circle closest-side, ${at(0)} 0%, ${at(0)} 45%, ${at(PENDOLO_HALO_ALPHA * 0.15)} 65%, ${at(PENDOLO_HALO_ALPHA)} 88%, ${at(0)} 100%)`;
      }, [beatFx.color]);
      const balanceGearX = centerX + sideSign * baseRadius * 0.2;
      const balanceGearY = centerY - baseRadius * 0.75;
      const planeCssTransform = tiltProjection.flat ? null : resolvePendoloPlaneCssTransform(tiltProjection);
      const haloTransformTemplate = useCallback(
        (_, generated) => `${planeCssTransform} ${generated === "none" ? "" : generated}`,
        [planeCssTransform]
      );
      const parallaxScalePx = tiltProjection.flat ? 0 : (pendoloTuning.parallaxDepth ?? 1) * baseRadius;
      const resolveLayerStyle = (heightRatio, zIndex, standUp = false) => {
        if (tiltProjection.flat) return void 0;
        const layer = buildPendoloLayerProjection(tiltProjection, heightRatio * parallaxScalePx);
        return {
          transform: standUp ? resolvePendoloSpaceCssTransform(layer) : resolvePendoloPlaneCssTransform(layer),
          transformOrigin: `${centerX}px ${centerY}px`,
          transformStyle: standUp ? "preserve-3d" : void 0,
          zIndex
        };
      };
      const iconLayerStyle = resolveLayerStyle(PENDOLO_BALANCE_ICON_HEIGHT, 1);
      const standLyrics = hubView;
      const standUpTiltDeg = -Math.atan2(lyricRingRadius + hubCameraBackPx, hubCameraHeightPx) * 180 / Math.PI;
      const lyricStandUp = useMemo(
        () => standLyrics ? { rotationDeg: standUpRotationDeg, tiltDeg: standUpTiltDeg } : void 0,
        [standLyrics, standUpRotationDeg, standUpTiltDeg]
      );
      const lyricLayerStyle = resolveLayerStyle(PENDOLO_LYRIC_LAYER_HEIGHT, 2, standLyrics);
      const textOrigin = standLyrics ? "center center" : mirrored ? "right center" : "left center";
      const balanceLensInputs = [beatFx.waveRadius, beatFx.waveBand, beatFx.waveStrength, beatFx.waveX, beatFx.waveY];
      const balanceIconX = useTransform(balanceLensInputs, ([radius, band, strength, x, y]) => resolvePendoloPointWave(balanceGearX - centerX - x, balanceGearY - centerY - y, radius, band, strength).x);
      const balanceIconY = useTransform(balanceLensInputs, ([radius, band, strength, x, y]) => resolvePendoloPointWave(balanceGearX - centerX - x, balanceGearY - centerY - y, radius, band, strength).y);
      return /* @__PURE__ */ jsx(
        VisualizerShell_default,
        {
          theme,
          audioPower,
          audioBands,
          sharedProps: props,
          children: /* @__PURE__ */ jsxs("div", { ref: visualizerRef, className: "relative w-full h-full overflow-hidden select-none pointer-events-none", children: [
            smartBeatEnabled && /* @__PURE__ */ jsx(
              motion.div,
              {
                "aria-hidden": true,
                className: "absolute pointer-events-none",
                transformTemplate: planeCssTransform ? haloTransformTemplate : void 0,
                style: {
                  left: centerX - haloReach,
                  top: centerY - haloReach,
                  width: haloReach * 2,
                  height: haloReach * 2,
                  zIndex: 0,
                  background: haloBackground,
                  mixBlendMode: "plus-lighter",
                  willChange: "transform",
                  x: beatFx.haloX,
                  y: beatFx.haloY,
                  scale: beatFx.haloScale,
                  opacity: beatFx.haloOpacity
                }
              }
            ),
            /* @__PURE__ */ jsxs(
              motion.div,
              {
                className: "absolute inset-0 pointer-events-none",
                style: { x: beatFx.shakeX, y: beatFx.shakeY, scale: beatFx.breath, transformOrigin: `${centerX}px ${centerY}px` },
                children: [
                  /* @__PURE__ */ jsx(
                    PendoloClockworkCanvas_default,
                    {
                      centerX,
                      centerY,
                      viewportWidth: viewportSize.width,
                      viewportHeight: viewportSize.height,
                      baseRadius,
                      lyricRingRadius,
                      escapementAngleMotionValue: gearRotationAngleRad,
                      audioBassMotionValue: audioBands.bass,
                      primaryTextColor,
                      accentTextColor,
                      backgroundColor: theme.backgroundColor,
                      showGearDecor: pendoloTuning.showGearDecor,
                      showCenterGradient: pendoloTuning.showCenterGradient ?? true,
                      showCover: pendoloTuning.showCoverOnWatchFace ?? false,
                      coverUrl: props.coverUrl,
                      enableLineGlow: pendoloTuning.enableLineGlow ?? false,
                      paused: props.paused,
                      motionProfile,
                      beatFxRef: beatFx.shared,
                      renderScale: clockworkRenderScale,
                      antialias: clockworkAntialias,
                      mirrored,
                      projection: dialProjection,
                      parallaxScalePx,
                      depthStencil: (requestedTiltDeg !== 0 || requestedHubView) && (pendoloTuning.parallaxDepth ?? 1) > 0,
                      onBackendChange: setClockworkWebgl
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 pointer-events-none", style: iconLayerStyle, children: pendoloTuning.showGearDecor !== "none" && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "absolute pointer-events-none",
                      style: {
                        left: `${balanceGearX}px`,
                        top: `${balanceGearY}px`,
                        zIndex: 1,
                        transform: "translate(-50%, -50%)"
                      },
                      children: /* @__PURE__ */ jsx(motion.div, { style: { x: balanceIconX, y: balanceIconY }, children: /* @__PURE__ */ jsx(
                        BalanceIcon,
                        {
                          size: Math.max(14, baseRadius * 0.13),
                          strokeWidth: 1.2,
                          absoluteStrokeWidth: true,
                          color: colorWithAlpha(accentTextColor, 0.62)
                        }
                      ) })
                    }
                  ) }),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 pointer-events-none", style: lyricLayerStyle, children: showText && /* @__PURE__ */ jsx(
                    motion.div,
                    {
                      ref: wheelRailRef,
                      className: "absolute inset-0 w-full h-full pointer-events-auto",
                      style: {
                        zIndex: 2,
                        rotate: railRotationDeg,
                        transformOrigin: `${centerX}px ${centerY}px`,
                        WebkitTransform: "translateZ(0)",
                        transformStyle: standLyrics ? "preserve-3d" : void 0
                      },
                      children: lineItems.map((item) => {
                        const isFocal = item.isActive;
                        const showChorusMarker = manualScrollAnchorIndex !== null && item.line.isChorus;
                        const chorusPresentation = resolvePendoloChorusPresentation(
                          item.line.isChorus,
                          isFocal && item.index === currentLineIndex,
                          motionProfile
                        );
                        const maxTextWidth = availableTextWidth / item.scale;
                        const fontPx = Math.round((isFocal ? 28 : 22) * lyricsFontScale);
                        const subtitleTracks = resolvePendoloSubtitleTracks(item.line, {
                          mode: resolvedMode,
                          hidden: hideTranslationSubtitle,
                          focal: isFocal,
                          subtitleFontScale: subtitleFontScale ?? 1
                        });
                        return /* @__PURE__ */ jsx(
                          PendoloRotatingLine_default,
                          {
                            wheelRotationDeg: railRotationDeg,
                            mirrored,
                            railWidth: viewportSize.width,
                            baseAngleDeg: item.angleDeg,
                            baseOpacity: standLyrics && !isFocal ? item.alpha * resolvePendoloStandSideLineAlpha(item.distanceFromActive) : item.alpha,
                            left: item.x,
                            top: item.y,
                            hubX: centerX,
                            hubY: centerY,
                            waveRadius: beatFx.waveRadius,
                            waveBand: beatFx.waveBand,
                            waveStrength: beatFx.waveStrength,
                            waveX: beatFx.waveX,
                            waveY: beatFx.waveY,
                            standUp: lyricStandUp,
                            fontFamily,
                            fontWeight,
                            canSeek: Boolean(onLyricLineSeek),
                            onClick: (e) => {
                              e.stopPropagation();
                              handleLineSeek(item.index, item.line.startTime);
                            },
                            children: /* @__PURE__ */ jsx(
                              motion.div,
                              {
                                className: "inline-block",
                                style: {
                                  rotate: standLyrics ? 0 : textRotationCorrectionDeg,
                                  // 立起来时句子的中点对准锚点（刻度针的方向），不再从锚点往一侧排开
                                  x: standLyrics ? mirrored ? "50%" : "-50%" : 0,
                                  transformOrigin: textOrigin,
                                  WebkitTransform: "translateZ(0)"
                                },
                                children: /* @__PURE__ */ jsx(
                                  "div",
                                  {
                                    className: "relative inline-block",
                                    style: {
                                      transform: `rotate(${standLyrics ? 0 : sideSign * item.angleDeg * 0.35}deg) scale(${item.scale}) translateZ(0)`,
                                      transformOrigin: textOrigin,
                                      textAlign: standLyrics ? "center" : mirrored ? "right" : void 0,
                                      isolation: "isolate"
                                    },
                                    children: /* @__PURE__ */ jsxs(
                                      motion.div,
                                      {
                                        initial: false,
                                        animate: { scale: chorusPresentation.haloScale },
                                        transition: { duration: chorusPresentation.transitionDuration, ease: "easeOut" },
                                        style: { transformOrigin: textOrigin },
                                        children: [
                                          chorusPresentation.isActive && /* @__PURE__ */ jsx(
                                            motion.div,
                                            {
                                              "aria-hidden": true,
                                              className: "absolute pointer-events-none -z-10 rounded-2xl",
                                              initial: { opacity: 0, scale: 0.96 },
                                              animate: { opacity: chorusPresentation.haloOpacity, scale: 1 },
                                              transition: { duration: chorusPresentation.transitionDuration, ease: "easeOut" },
                                              style: {
                                                inset: "-0.7em -1.1em",
                                                background: `radial-gradient(circle at ${mirrored ? 58 : 42}% 50%, ${colorWithAlpha(accentTextColor, 0.14 * chorusPresentation.haloOpacity)} 0%, ${colorWithAlpha(accentTextColor, 0.035 * chorusPresentation.haloOpacity)} 55%, transparent 82%)`,
                                                filter: `blur(${Math.round(10 * motionProfile.chorusGlowMultiplier)}px)`
                                              }
                                            }
                                          ),
                                          /* @__PURE__ */ jsxs("div", { style: { transform: standLyrics ? "translateY(-100%)" : "translateY(-50%)" }, children: [
                                            showChorusMarker && /* @__PURE__ */ jsx(
                                              "span",
                                              {
                                                "aria-hidden": true,
                                                className: "absolute pointer-events-none rounded-full",
                                                style: {
                                                  width: "0.42em",
                                                  height: "0.42em",
                                                  ...mirrored ? { right: "-0.95em" } : { left: "-0.95em" },
                                                  top: "0.52em",
                                                  backgroundColor: accentTextColor,
                                                  boxShadow: `0 0 7px ${colorWithAlpha(accentTextColor, 0.58)}`
                                                }
                                              }
                                            ),
                                            /* @__PURE__ */ jsx("div", { children: isFocal ? /* @__PURE__ */ jsx(
                                              PendoloActiveLyricSweep_default,
                                              {
                                                line: item.line,
                                                currentTime,
                                                fontFamily,
                                                fontWeight,
                                                maxWidth: maxTextWidth,
                                                primaryTextColor,
                                                accentTextColor,
                                                fontPx,
                                                wordColors: theme.wordColors,
                                                isChorus: chorusPresentation.isActive,
                                                accentMix: chorusPresentation.accentMix,
                                                chorusGlowMultiplier: chorusPresentation.glowMultiplier,
                                                alignRight: mirrored,
                                                alignCenter: standLyrics
                                              }
                                            ) : /* @__PURE__ */ jsx(
                                              "div",
                                              {
                                                className: "transition-all duration-200 whitespace-pre-wrap",
                                                style: {
                                                  fontSize: `${fontPx}px`,
                                                  maxWidth: `${maxTextWidth}px`,
                                                  color: colorWithAlpha(primaryTextColor, 0.75),
                                                  letterSpacing: "0.01em",
                                                  whiteSpace: "pre-wrap",
                                                  overflowWrap: "anywhere",
                                                  wordBreak: "break-word"
                                                },
                                                children: item.line.fullText
                                              }
                                            ) }),
                                            subtitleTracks.map((track) => /* @__PURE__ */ jsx(
                                              "div",
                                              {
                                                "data-pendolo-subtitle-track": track.role,
                                                className: "whitespace-pre-wrap transition-opacity duration-200",
                                                style: {
                                                  fontFamily: subtitleFontFamily,
                                                  fontWeight: resolveThemeFontWeight(subtitleTheme ?? theme, track.fontWeightFallback),
                                                  fontSize: `${track.fontPx}px`,
                                                  maxWidth: `${maxTextWidth}px`,
                                                  color: isFocal ? secondaryTextColor : colorWithAlpha(secondaryTextColor, 0.6),
                                                  opacity: track.opacityFactor === 1 ? void 0 : track.opacityFactor,
                                                  letterSpacing: "0.01em",
                                                  whiteSpace: "pre-wrap",
                                                  overflowWrap: "anywhere",
                                                  wordBreak: "break-word",
                                                  marginTop: `${track.gapEm}em`
                                                },
                                                children: track.text
                                              },
                                              track.role
                                            ))
                                          ] })
                                        ]
                                      }
                                    )
                                  }
                                )
                              }
                            )
                          },
                          item.line.id ?? `pendolo-line-${item.index}`
                        );
                      })
                    }
                  ) })
                ]
              }
            )
          ] })
        }
      );
    };
    var VisualizerPendolo_default = react_shim_default.memo(VisualizerPendolo);
  
    // src/render/folia/entry.tsx
    var hasMotion = Boolean(react_shim_default) && true;
    return __toCommonJS(entry_exports);
  })();
  
  return typeof MPFoliaPendolo === "undefined" ? null : MPFoliaPendolo
}
