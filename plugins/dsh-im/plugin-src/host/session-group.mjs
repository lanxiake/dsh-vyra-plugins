// Give the shared IM directory its own sidebar group.
//
// Every bot that keeps workspaces.json's default directory runs its Sessions
// in `$DSH_HOME/im`. Without a registered workspace those Sessions fall into
// 「未分组」, which is where all IM conversations used to land.
//
// The Harness call goes through `HarnessWorkspacePort`, a two-method seam, so
// this module owns the policy (when to create, when to adopt, never to rename
// over a user) and the Host owns the transport.
//
// The group is deliberately *never* released: unloading the plugin must not
// make a user's conversations vanish from their sidebar, nor reset a title
// they renamed by hand.

import { mkdir } from 'node:fs/promises';

import { defaultImWorkspace, sameWorkspacePath } from '../../src/channels/shared/default-workspace.mjs';

/**
 * The workspace operations this module needs.
 * @typedef {{ list: () => Promise<Array<{workspaceId: string, path: string, title?: string}>>,
 *   create: (path: string) => Promise<{workspaceId: string, title?: string}> }} HarnessWorkspacePort
 */

function unregistered(path = null) {
  return { registered: false, path, reused: false };
}

/**
 * Register (or adopt) the IM directory as a sidebar group.
 * @param port - `{ list, create }` over the Harness workspace RPC.
 * @param options.dshHome - DSH home; the group lives at `<dshHome>/im`.
 * @param options.title - group title, or `off` to leave conversations ungrouped.
 * @param options.logger - logger with `warn`; this never throws into the caller.
 * @param options.rename - optional `(workspaceId, title) => Promise`; when absent
 *   the group keeps whatever title the Harness gave it.
 * @returns `{ registered, path, reused }`; `reused` means an existing group was adopted.
 */
export async function installSessionGroup(port, {
  dshHome, title, logger = console, rename,
} = {}) {
  const wanted = typeof title === 'string' ? title.trim() : '';
  if (!wanted || wanted.toLowerCase() === 'off') return unregistered();
  if (typeof port?.list !== 'function' || typeof port?.create !== 'function') return unregistered();

  const path = defaultImWorkspace(dshHome === undefined ? {} : { dshHome });
  try {
    await mkdir(path, { recursive: true, mode: 0o700 });
  } catch (error) {
    logger.warn?.('[dsh-im] could not create the IM directory for the session group', error);
    return unregistered(path);
  }

  try {
    const items = await port.list();
    const existing = Array.isArray(items) ? items : [];
    for (const item of existing) {
      if (!(await sameWorkspacePath(item?.path, path))) continue;
      // A group the user renamed keeps their title; adopting it is all we do.
      return { registered: true, path, reused: true };
    }

    const created = await port.create(path);
    // `create` is idempotent by path and reports `created: false` for a
    // directory that is already registered. That is an adoption, not a fresh
    // group, so the existing title is the user's choice and stays.
    if (created?.created === false) return { registered: true, path, reused: true };
    const workspaceId = created?.workspaceId;
    if (!workspaceId) throw new Error('Harness returned an invalid workspace');
    if (typeof rename === 'function' && created.title !== wanted) {
      try {
        await rename(workspaceId, wanted);
      } catch (error) {
        // A title collision is not fatal: the directory is registered either
        // way, so keep it and say so instead of leaving an untitled orphan.
        logger.warn?.(
          `[dsh-im] registered ${path} but could not title it "${wanted}"`
            + ` (${error?.code ?? error?.message ?? 'rename-failed'}); it keeps its current title`,
        );
        return { registered: true, path, reused: false, titled: false };
      }
    }
    return { registered: true, path, reused: false, titled: true };
  } catch (error) {
    logger.warn?.('[dsh-im] could not register the DSH-IM session group', error);
    return unregistered(path);
  }
}
