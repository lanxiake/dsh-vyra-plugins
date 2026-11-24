/**
 * Active-theme selection sync (client).
 *
 * The selection lives on the Host so an agent can move it (`vft theme apply`).
 * This module keeps both directions honest:
 *
 *   read  — at boot, after file-backed themes are registered, adopt the host
 *           selection if it differs from what the runtime mounted.
 *   write — whenever the runtime announces a new active skin (the switcher, a
 *           `?skin=` deep link), persist it back so the Host does not "revert"
 *           the user's choice on the next load.
 */
const SELECTION_ROUTE = "/dsh-vyra-free-theme/selection";
const ACTIVE_EVENT = "dsh-vyra-free-theme:active-changed";

export async function adoptHostSelection({ runtime, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(SELECTION_ROUTE, { cache: "no-store" });
    if (!response.ok) return { adopted: null };
    const body = await response.json();
    if (typeof body?.skinId !== "string") return { adopted: null };
    if (runtime.active() === body.skinId) return { adopted: body.skinId, changed: false };
    runtime.select(body.skinId);
    return { adopted: body.skinId, changed: true };
  } catch {
    return { adopted: null };
  }
}

export function publishSelection({ fetchImpl = fetch, target = window } = {}) {
  if (typeof target?.addEventListener !== "function") return () => {};
  const listener = (event) => {
    const skinId = event?.detail;
    if (typeof skinId !== "string" || skinId.length === 0) return;
    try {
      fetchImpl(SELECTION_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skinId }),
      }).catch(() => {});
    } catch {}
  };
  target.addEventListener(ACTIVE_EVENT, listener);
  return () => target.removeEventListener(ACTIVE_EVENT, listener);
}