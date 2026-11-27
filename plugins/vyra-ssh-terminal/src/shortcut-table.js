/**
 * 快捷键表：纯数据。
 *
 * 单独一个文件的理由：它是**给用户看的说明**与**我们实际接的键**之间唯一的事实来源，
 * 所以既要能被「快捷键一览」面板渲染，也要能被测试直接断言。挂在 overlays.js 上会
 * 连带把 sessions / xterm 拖进来，纯 node 里跑不了。
 *
 * 分两组的意义不同：
 *  - APP_KEYS：我们自己接的；
 *  - SHELL_KEYS：交给远端 shell 的，**我们不拦**。写出来是为了让用户知道
 *    「Ctrl+R 没反应是正常的，那是 bash 的历史搜索」，而不是以为插件坏了。
 */

export const APP_KEYS = [
  ['Ctrl + T', '新建连接'],
  ['Ctrl + B', '收起 / 展开连接列表'],
  ['Ctrl + F', '搜索连接'],
  ['Ctrl + K', '命令面板'],
  ['Ctrl + /', '快捷键一览'],
  ['Ctrl + Tab / Ctrl + Shift + Tab', '切换标签'],
  ['Ctrl + 1 … 9', '跳到第 N 个标签'],
  ['Ctrl + Shift + W', '关闭当前标签'],
  ['Ctrl + Shift + F', '终端内查找'],
  ['Ctrl + Shift + B', '文件面板'],
  ['Ctrl + Shift + M', '资源监控'],
  ['Ctrl + Shift + A', 'AI 助手'],
  ['Ctrl + Shift + H', '历史命令'],
  ['Ctrl + Shift + K', '清屏'],
  ['Ctrl + Shift + L', '日志'],
  ['Ctrl + S', '编辑器：存回服务器'],
  ['Esc', '关闭弹窗'],
]

export const SHELL_KEYS = [
  ['Tab', '补全命令或路径'],
  ['Ctrl + R', '搜索 shell 历史'],
  ['Ctrl + C', '中断当前命令（有选中内容时复制）'],
  ['Ctrl + D', '结束输入 / 退出登录'],
  ['Ctrl + L', '清屏（保留历史）'],
  ['Ctrl + A / Ctrl + E', '光标到行首 / 行尾'],
  ['Ctrl + U / Ctrl + K', '删到行首 / 行尾'],
  ['Ctrl + W', '删掉前一个词'],
  ['↑ / ↓', 'shell 自己的历史'],
]
