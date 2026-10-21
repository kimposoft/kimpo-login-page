/**
 * 官方标准登录页插件前端 UMD 入口。
 *
 * 宿主通过 window.KimpoPlugins.loginpage.createSurface(input) 挂载 surface；
 * 仅支持 page-slot（slot === "auth.login"），其余 surface 请求显式抛错快速失败——
 * 手册 §4：初始化抛错要快，让容器（apps/web-next 登录容器）及时切换到兜底态（内置极简密码表单），
 * 比 hang 住好。
 */
import { definePluginLoginSurface } from '@kimposoft/plugin-sdk';
import LoginPage from './LoginPage.vue';

export const createSurface = definePluginLoginSurface(input => {
  // definePluginLoginSurface 只在类型层面把 input 断言为 LoginSurfaceCreateInput
  // （宿主实际调用签名仍是通用 SurfaceCreateInput，surfaceType/slot 并未在运行时被强制收窄），
  // 这里先把两个判别字段拓宽回 unknown/string 再比较，保证运行时校验真实生效，
  // 而不是被 TS 的字面量类型窄化成一条恒真判断。
  const surfaceType = input.surfaceType as unknown as string;
  const slot = input.slot as unknown as string | undefined;
  if (surfaceType !== 'page-slot' || slot !== 'auth.login') {
    throw new Error(`[login-page] unsupported surface: ${surfaceType}/${slot ?? ''}`);
  }
  // 把完整 input（props/hostBridge/hostCaps 等）整体透传给组件，组件内部按需取用
  // （与 kimpo-records-view 的 { component, props: { input } } 约定一致）。
  return { component: LoginPage, props: { input } };
});
