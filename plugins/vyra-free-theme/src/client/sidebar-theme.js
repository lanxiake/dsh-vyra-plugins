/**
 * Sidebar element tagging (runtime, DOM).
 *
 * The sidebar pack's rules target `[data-vft-sb-item]`, so something has to put
 * that attribute on the sidebar's interactive elements. Doing it here — from
 * the DOM, by role — means a host upgrade that re-hashes every css-module class
 * does not break the theme; the premise is "the sidebar column contains links,
 * buttons and tabbable rows", which is far more stable than any class name.
 *
 * Scoped deliberately: body is observed only until the sidebar column appears,
 * then only the column is observed. Tagging is undone on dispose.
 */
const INTERACTIVE = 'a,button,[role="button"],[role="treeitem"],[role="option"],[tabindex]:not([tabindex="-1"])';
const COLUMN = '[class*="_sidebarCol"]';

export function installSidebarTagging() {
  if (typeof document === "undefined" || !document.body) return null;
  const tagged = new Set();
  let observer = null;
  let frame = 0;
  let attached = false;

  const tagWithin = (column) => {
    for (const element of column.querySelectorAll(INTERACTIVE)) {
      if (!element.hasAttribute("data-vft-sb-item")) {
        element.setAttribute("data-vft-sb-item", "");
        tagged.add(element);
      }
    }
  };

  const attach = () => {
    const column = document.querySelector(COLUMN);
    if (column === null) return false;
    tagWithin(column);
    if (!attached) {
      attached = true;
      observer.disconnect();
      observer.observe(column, { childList: true, subtree: true });
    }
    return true;
  };

  const schedule = () => {
    if (frame !== 0) return;
    const run = () => {
      frame = 0;
      try {
        attach();
      } catch {}
    };
    frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : (setTimeout(run, 16), 1);
  };

  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  attach();

  return () => {
    observer.disconnect();
    if (frame !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    for (const element of tagged) {
      try { element.removeAttribute("data-vft-sb-item"); } catch {}
    }
    tagged.clear();
  };
}