export function popupPosition({ x, y, width, height, viewWidth, viewHeight, gap = 2, margin = 4 }) {
  const maxLeft = viewWidth - margin - width;
  const left = Math.max(margin, Math.min(x, maxLeft));
  const below = y + gap;
  const above = below + height > viewHeight - margin;
  const top = Math.max(margin, above ? y - height - gap * 2 : below);
  return { left, top, above };
}

