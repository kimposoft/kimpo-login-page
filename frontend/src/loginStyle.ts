// 登录页外观配置解析。
//
// 宿主把本插件 config.schema.json 里标记 x-public 的字段原样放进 LoginPageProps.pageConfig
// （含义由本插件自己解释，宿主不认识样式枚举）；标语 slogan 另由宿主映射为 brand.slogan。
// 本文件只做「原始值 → 已知样式」的收敛，不触碰任何认证逻辑。

/** 四种登录页样式；split 为默认（契约：未设置或值不认识时按 split）。 */
export const LOGIN_STYLES = ['split', 'aurora', 'ring', 'glass'] as const;
export type LoginStyle = (typeof LOGIN_STYLES)[number];
export const DEFAULT_LOGIN_STYLE: LoginStyle = 'split';

export interface ResolvedLoginStyle {
  style: LoginStyle;
  /** 收到了值但不认识（用于调用方记一条 warn 日志）；缺省/空值不算未知。 */
  unknownRaw?: string;
}

/**
 * 读取 pageConfig.login_style。
 * pageConfig 是 SDK 的可选字段（旧版 SDK 类型里没有），这里按 unknown 本地断言读取，
 * 不依赖插件内 SDK 拷贝是否已刷新。
 */
export function resolveLoginStyle(pageConfig: unknown): ResolvedLoginStyle {
  const raw =
    pageConfig && typeof pageConfig === 'object' ? (pageConfig as Record<string, unknown>).login_style : undefined;
  if (raw === undefined || raw === null || raw === '') return { style: DEFAULT_LOGIN_STYLE };
  const text = String(raw).trim();
  if ((LOGIN_STYLES as readonly string[]).includes(text)) return { style: text as LoginStyle };
  return { style: DEFAULT_LOGIN_STYLE, unknownRaw: text.slice(0, 64) };
}

/**
 * 表单区默认高度（不含图形验证码行）：主体 192 + 有 Tab 时 56 + 有底部行时 52。
 * 各样式外壳据此算出卡片「顶部固定位置」（按默认态居中后不再随状态变化），
 * 出现验证码时卡片只向下生长，顶部不动。
 */
export function baseFormHeight(hasTabs: boolean, hasFooter: boolean): number {
  return 192 + (hasTabs ? 56 : 0) + (hasFooter ? 52 : 0);
}
