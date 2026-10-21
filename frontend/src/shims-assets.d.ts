// SVG 资产类型声明（视觉重构新增）。
// 本插件仅用两种 SVG 导入方式：默认导入拿到构建后 URL（用于 <img src> ，如 kimpo-logo.svg，
// 避免其内含 paint*/filter* 等渐变 id 被多次内联进 DOM 造成 id 冲突）；`?raw` 后缀导入拿到
// 原始 SVG 源码字符串（用于 v-html 内联渲染，让 stroke="currentColor" 能继承文字色以适配深色主题）。
// Vite 对两者均有内置支持，无需额外插件依赖；此文件只是补齐 TS 类型，不影响运行时行为。
declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
