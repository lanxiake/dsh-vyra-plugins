// Host half: nothing to do.
//
// The whole feature is a browser-side view of the plugin market: the index
// documents are ordinary JSON served with `Access-Control-Allow-Origin`, so the
// client fetches them directly, and every plugin change goes through the Host's
// own `remote.pluginManager` / `remote.pluginMarket` namespaces. No Host route,
// service, or storage belongs here; this file exists only because a bundle row
// needs a Host entry point for the client half to be loaded.
export const name = 'dsh-plugin-market'
export const inject = []
export function apply() {}
