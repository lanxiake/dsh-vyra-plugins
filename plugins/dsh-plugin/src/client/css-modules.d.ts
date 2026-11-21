/** 浏览器客户端使用的 CSS Modules 类型声明。 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
