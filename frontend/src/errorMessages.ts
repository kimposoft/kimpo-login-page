// §8 错误码 → UI 行为映射表（冻结契约，见 docs/auth/01-login-page-plugin-dev-guide.md §8）。
// 已知 code 对应固定 i18n key；未列出/未知 code 一律走通用兜底 key（'login.err.unknown'）+
// 上报 log('warn', ...)（调用方负责，见 LoginPage.vue handleLoginFailure）。
import type { AuthErrorCode } from '@kimposoft/plugin-sdk';

/** errorCode -> i18n key；key 规范 login.err.<errorCode 小写驼峰>（手册 §10 建议）。 */
export const ERROR_CODE_I18N_KEY: Partial<Record<AuthErrorCode, string>> = {
  AUTH_INVALID_CREDENTIALS: 'login.err.authInvalidCredentials',
  // SDK v1.1.0-tp.19 按宿主实际对外码核定词表：账户停用宿主对外是 AUTH_USER_DISABLED
  // （AUTH_ACCOUNT_DISABLED 是认证插件报给宿主的内部码，宿主翻译后才交给登录页），沿用原文案键。
  AUTH_USER_DISABLED: 'login.err.authAccountDisabled',
  AUTH_ACCOUNT_LOCKED: 'login.err.authAccountLocked',
  AUTH_ACCOUNT_LOCKED_UPSTREAM: 'login.err.authAccountLockedUpstream',
  AUTH_PASSWORD_EXPIRED: 'login.err.authPasswordExpired',
  AUTH_MUST_CHANGE_PASSWORD: 'login.err.authMustChangePassword',
  AUTH_NEED_CAPTCHA: 'login.err.authNeedCaptcha',
  AUTH_CAPTCHA_INVALID: 'login.err.authCaptchaInvalid',
  AUTH_UPSTREAM_UNAVAILABLE: 'login.err.authUpstreamUnavailable',
  AUTH_NO_ACCOUNT_JIT_DISABLED: 'login.err.authNoAccountJitDisabled',
  AUTH_STATE_MISMATCH: 'login.err.authStateMismatch',
  // 二维码会话不存在或已过期：宿主对外码为 AUTH_QR_SESSION_NOT_FOUND（tp.19 起 SDK 删去宿主从不返回的 AUTH_QR_EXPIRED）。
  AUTH_QR_SESSION_NOT_FOUND: 'login.err.authQrExpired',
  AUTH_RATE_LIMITED: 'login.err.authRateLimited'
  // AUTH_USER_NOT_FOUND：宿主已对外合并进 AUTH_INVALID_CREDENTIALS 防枚举，插件侧一般不会收到，
  // 不出现在本映射表中；若真收到则落入下方 resolveErrorKey 的“未知 code”兜底分支。
};

/** 命中这些错误码时需要（重新）显示 captcha 区并自动刷新验证码（手册 §7.1/§8）。 */
export const CAPTCHA_RETRIGGER_CODES = new Set<string>(['AUTH_NEED_CAPTCHA', 'AUTH_CAPTCHA_INVALID']);

/** 按 §8 表把 errorCode 解析为 i18n key；未知/缺失 code 落通用兜底。 */
export function resolveErrorKey(code?: string | null): string {
  if (!code) return 'login.err.unknown';
  return ERROR_CODE_I18N_KEY[code as AuthErrorCode] ?? 'login.err.unknown';
}

/** 是否是登录页当前已知的标准错误码（用于区分“已知但未列入映射表”与“完全陌生”，仅影响日志措辞）。 */
export function isKnownErrorCode(code?: string | null): boolean {
  if (!code) return false;
  return code in ERROR_CODE_I18N_KEY;
}
