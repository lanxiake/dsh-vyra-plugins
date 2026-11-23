/**
 * 星云 · 代码壁纸
 *
 * 契约（spec §6.3）：必须提供 `art.mount(canvas, env)`；`env` 只有
 * `{ width, height, dpr, mode, reducedMotion }`，拿不到宿主页面与网络。
 * 返回销毁句柄，切主题时由运行时调用。
 *
 * 只依赖 Canvas 2D；无外部资源、无网络请求。
 */
export const art = {
  mount(canvas, env) {
    const context = canvas.getContext("2d");
    if (context === null) return undefined;

    // 固定种子的伪随机：同一主题每次进入星位一致，不会"换个位置重开"。
    let seed = 20261123;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const palette = env.mode === "dark"
      ? { base: "#0E0B1A", haze: "124, 92, 255", star: "#EFE9FF" }
      : { base: "#F4F2FF", haze: "124, 92, 255", star: "#4A3A7A" };

    const stars = Array.from({ length: 220 }, () => ({
      x: random(),
      y: random(),
      radius: 0.4 + random() * 1.5,
      twinkle: 0.35 + random() * 0.65,
      phase: random() * Math.PI * 2,
      drift: 0.006 + random() * 0.018,
    }));

    let width = Math.max(1, Math.floor(env.width * env.dpr));
    let height = Math.max(1, Math.floor(env.height * env.dpr));
    let dpr = env.dpr;
    let frame = 0;
    let raf = 0;
    let disposed = false;

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = palette.base;
      context.fillRect(0, 0, width, height);

      // 一层斜向光雾，替代纯色底，给面板文字一点对比层次。
      const haze = context.createLinearGradient(0, 0, width, height);
      haze.addColorStop(0, `rgba(${palette.haze}, ${env.mode === "dark" ? 0.28 : 0.16})`);
      haze.addColorStop(0.55, `rgba(${palette.haze}, 0)`);
      haze.addColorStop(1, `rgba(${palette.haze}, ${env.mode === "dark" ? 0.10 : 0.06})`);
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);

      context.fillStyle = palette.star;
      for (const star of stars) {
        const x = ((star.x + (frame * star.drift) / 900) % 1) * width;
        const y = star.y * height;
        const alpha = reduced ? star.twinkle : star.twinkle * (0.6 + 0.4 * Math.sin(time / 1400 + star.phase));
        context.globalAlpha = Math.max(0.08, Math.min(1, alpha));
        context.beginPath();
        context.arc(x, y, star.radius * dpr, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const resize = (nextWidth, nextHeight, nextDpr) => {
      dpr = nextDpr;
      width = Math.max(1, Math.floor(nextWidth * dpr));
      height = Math.max(1, Math.floor(nextHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      draw(0);
    };

    const reduced = env.reducedMotion === true;
    resize(env.width, env.height, env.dpr);

    if (!reduced) {
      const tick = (time) => {
        if (disposed) return;
        frame += 1;
        draw(time);
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }

    return {
      destroy() {
        disposed = true;
        if (raf) window.cancelAnimationFrame(raf);
      },
    };
  },
};
