# 本仓库的 dsh-im 已与上游分叉

## 中文

自 `6.0.0` 起，本仓库维护的 `@lanxiake/dsh-im` **不再同步** `xmanrui/dsh-im`，也不再跟踪 `lanxiake/dsh-vyra-plugins` 上游中 `plugins/dsh-im` 的提交。

- 最后一次同步的上游提交：`lanxiake/dsh-vyra-plugins@c0c8950`（`plugins/dsh-im` 与上游逐字节一致，版本 `5.13.0`）。
- 上游修复不会自动进入本仓库。确有必要时**手动 cherry-pick 单个补丁**，不做版本跟踪，也不整目录覆盖。
- 从 `6.0.0` 开始的破坏性变更：
  - `ctx.dshIm` 的 `contractVersion` 升为 `2`（新增 `updateTarget` / `deleteTarget`，v1 字段全部保留）。
  - 默认把 `$DSH_HOME/im` 注册为 `DSH-IM` 会话分组，可用 Host 配置 `sessionGroup: off` 关闭。
- 新增的 `dsh-im` 命令（`accounts`、`targets`、`send`、`target`、`settings`、`login-hint`）中，读取类命令在 DSH 未运行时也可用；写入类命令仍走既有的 HTTP 投递接口。

## English

Starting with `6.0.0`, the `@lanxiake/dsh-im` package maintained in this repository **no longer tracks** `xmanrui/dsh-im`, nor upstream commits to `plugins/dsh-im` in `lanxiake/dsh-vyra-plugins`.

- Last synced upstream commit: `lanxiake/dsh-vyra-plugins@c0c8950` (byte-identical to `5.13.0`).
- Upstream fixes do not flow in automatically. Cherry-pick individual patches by hand when genuinely needed; do not track versions or overwrite the directory.
- Breaking changes from `6.0.0`:
  - `ctx.dshIm` moves to `contractVersion: 2` (adds `updateTarget` / `deleteTarget`; every v1 field is preserved).
  - `$DSH_HOME/im` is registered as the `DSH-IM` session group by default; disable with the Host option `sessionGroup: off`.
- Of the new `dsh-im` commands (`accounts`, `targets`, `send`, `target`, `settings`, `login-hint`), the read-side commands work while DSH is not running; writes still go through the existing HTTP delivery route.
