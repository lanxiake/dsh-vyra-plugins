/**
 * 宿主的 React 实例，在模块工厂里导入进来。
 *
 * ## 为什么要绕这么一圈
 *
 * 这个包自己 import 了 `react`（用来做类型与测试替身）。一旦宿主注入的实例在
 * **模块作用域**里有一个名字，esbuild 就会把另一个 React 重命名成 `React2`/`React3`，
 * 或者把它自己压缩成一个字母（`H`）——两种情况下组件都会读到错的那一个，界面报
 * `createElement is not a function`，而**所有单测照样全绿**。
 *
 * 让它活在 `globalThis` 上的一个属性里，就没有第二个名字能冒充它：读写都只经过
 * `globalThis[KEY]` 这一条路径，打包器改名改不到它。
 *
 * （这条注释本身也是记录：2026-11 在无头浏览器里第一次真正渲染时踩到这个坑，
 * 单测与 `apply()` 检查都放过它了。）
 */
const KEY = '__dshSshTerminalReact'

export function setReact(react) {
  globalThis[KEY] = react
}

/** 取宿主的 React；没注入时返回空壳（渲染期一定已经注入）。 */
export function hostReact() {
  return globalThis[KEY] ?? {}
}
