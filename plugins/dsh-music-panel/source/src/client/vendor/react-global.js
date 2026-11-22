/**
 * Hand the host's React instance to the bundled vendor code.
 *
 * Must run before `framer.bundle.js`: the vendor shims read this global when they
 * are evaluated, and they must use the host's React rather than a second copy.
 */
globalThis.__MP_REACT__ = React
