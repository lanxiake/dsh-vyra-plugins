export function bytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return `${Math.round(n)} B`;
  const u = ["KB", "MB", "GB", "TB", "PB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${u[i]}`;
}
export const rate = (n) => `${bytes(n)}/s`;
export function uptime(sec) {
  sec = Math.floor(Number(sec) || 0);
  const d = Math.floor(sec / 86400);
  const hh = Math.floor(sec % 86400 / 3600);
  const m = Math.floor(sec % 3600 / 60);
  return d ? `${d} \u5929 ${hh} \u5C0F\u65F6` : hh ? `${hh} \u5C0F\u65F6 ${m} \u5206` : `${m} \u5206`;
}
export const level = (pct2) => pct2 >= 90 ? "err" : pct2 >= 75 ? "warn" : "";
