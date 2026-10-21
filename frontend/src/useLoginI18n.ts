// 登录页插件共享 i18n 单例：LoginPage.vue 创建一次，经 Vue provide/inject
// 下发给各子组件（PasswordForm/RedirectButtons/QrPanel/ChallengeForm），避免每个组件各自
// createPluginI18n 造成的多份 locale 状态不同步。四级查找链见 SDK i18n.ts 头部注释。
import { inject, provide, reactive, type InjectionKey } from 'vue';
import { createPluginI18n, type HostI18n, type PluginI18n } from '@kimposoft/plugin-sdk';
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';
import jaJP from '../locales/ja-JP.json';
import zhTW from '../locales/zh-TW.json';

const LOGIN_I18N_KEY: InjectionKey<{ t: (key: string, params?: Record<string, unknown>) => string }> =
  Symbol('klp-i18n');

/**
 * 顶层调用（仅 LoginPage.vue）：创建 PluginI18n 实例并 provide 一个响应式 `t` 供子组件 inject。
 *
 * 踩坑记录（2026-07-09 真机对照发现）：Vue 的 provide()/inject() 在**同一组件内部无法自闭环**——
 * inject() 只会沿 `instance.parent` 向上查找祖先的 provides，不包含当前实例自己刚 provide 的值。
 * 若 LoginPage.vue 在 provide 之后紧接着自己再 inject 一次（旧写法），会拿到 useLoginI18n() 的
 * 兜底 `(key) => key`，导致 LoginPage.vue 自身模板里所有 t() 调用（tab 标签、空态文案等）原样显示
 * key 而不是译文——子组件（PasswordForm 等，作为 LoginPage 的后代）反而不受影响。
 * 因此这里直接把响应式 boundT 通过返回值交给调用方（LoginPage.vue），不要求它对自己 inject。
 */
export function provideLoginI18n(host?: HostI18n): PluginI18n & { t: (key: string, params?: Record<string, unknown>) => string } {
  const i18n = createPluginI18n({
    messages: { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': jaJP, 'zh-TW': zhTW },
    defaultLocale: 'zh-CN',
    namespace: 'com.kimpo.login-page',
    host
  });

  // reactive 包一层 t，locale 切换时子组件的模板引用能感知刷新（PluginI18n.t 本身不是响应式的）。
  const state = reactive({ tick: 0 });
  const unsubscribe = i18n.onChange(() => {
    state.tick++;
  });

  const boundT = (key: string, params?: Record<string, unknown>): string => {
    // 读一次 state.tick 建立响应式依赖收集；值本身无意义，只为触发重渲染。
    void state.tick;
    return i18n.t(key, params);
  };

  provide(LOGIN_I18N_KEY, { t: boundT });

  // 供 LoginPage.vue 在 onBeforeUnmount 里统一释放（i18n.dispose 内部会调用 unsubscribe，
  // 这里的 unsubscribe 仅用于 state.tick 订阅，一并交给调用方管理）。
  (i18n as PluginI18n & { __disposeTick?: () => void }).__disposeTick = unsubscribe;

  // 把 boundT 一并挂在返回对象上（覆盖 i18n.t 的非响应式版本），LoginPage.vue 用它替代自我 inject。
  return { ...i18n, t: boundT };
}

/** 子组件调用：拿到 provide 的 t()；找不到 provider（理论上不会发生）时兜底原样返回 key。
 *  注意：LoginPage.vue 自身不要调用本函数——见 provideLoginI18n 顶部注释，自注入拿不到值。 */
export function useLoginI18n(): { t: (key: string, params?: Record<string, unknown>) => string } {
  return inject(LOGIN_I18N_KEY, { t: (key: string) => key });
}
