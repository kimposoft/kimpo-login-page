<script setup lang="ts">
/**
 * 官方标准登录页插件主组件——page-slot（slot=auth.login）渲染器。
 *
 * 职责边界（手册 §1.1 红线，务必牢记）：不持凭证 / 不知协议 / 不调第三方 / 不建会话 /
 * 不接触敏感配置。本组件只按 LoginPageProps.methods 的 kind 分组渲染对应 UI、调用
 * hostBridge 方法，全部认证逻辑、会话种植、协议细节都在宿主与 auth 插件一侧完成。
 *
 * 2026-07-09 Figma 定稿视觉重构：根布局改为“左右分栏（左侧动态极光品牌区 + 右侧毛玻璃卡片）”。
 *
 * 外壳拆成四种样式（layouts/：split 默认 / aurora /
 * ring / glass），由本插件公开配置 login_style 选择（宿主经 LoginPageProps.pageConfig 原样下发，
 * 含义由本插件解释）；标语沿用 brand.slogan。四种外壳共用同一个表单区 LoginFormArea（Tab + 主体 +
 * 「其他方式」一行，新增短信 Tab）。以下认证状态机 / props / hostBridge 调用 / challenge 续步 /
 * 空态 / 语言切换 / logo 回退逻辑保持不变，只是换到新的外壳与表单区里渲染。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { NDropdown, NEmpty } from 'naive-ui';
import type { LoginMethod, LoginSurfaceCreateInput } from '@kimposoft/plugin-sdk';
import { provideLoginI18n } from './useLoginI18n';
import { safeLog, safeMessage } from './hostUtils';
import { baseFormHeight, resolveLoginStyle, type LoginStyle } from './loginStyle';
import LoginFormArea from './components/LoginFormArea.vue';
import SplitLayout from './layouts/SplitLayout.vue';
import AuroraLayout from './layouts/AuroraLayout.vue';
import RingLayout from './layouts/RingLayout.vue';
import GlassLayout from './layouts/GlassLayout.vue';
// 共享 token 与表单控件样式（四种外壳 + 四个表单组件共用，见文件头注释）。
import './styles/login-form.css';
// 资产（规则 3/9）：
// - kimpo-logo.svg / kimpo-mark.svg 用默认导入拿构建后 URL，走 <img src> 渲染——避免内含的
//   渐变 id 被 v-html 内联进 DOM 造成 id 冲突。kimpo-mark 是无字标的图形标（ring 样式用）。
// - icon-lang.svg 用 `?raw` 拿原始源码字符串，走 v-html 内联渲染——stroke="currentColor"
//   才能继承文字颜色，深色主题下图标跟着变色。
import kimpoLogoUrl from './assets/brand/kimpo-logo.svg';
import kimpoMarkUrl from './assets/brand/kimpo-mark.svg';
import iconLangRaw from './assets/brand/icon-lang.svg?raw';

defineOptions({ name: 'KimpoLoginPage' });

const props = defineProps<{
  /** 宿主 createSurface 输入整体透传（与 kimpo-records-view 约定一致）；宿主同时以响应式 :input 覆盖。 */
  input?: LoginSurfaceCreateInput;
}>();

const bridge = computed(() => props.input?.hostBridge);
const pageProps = computed(() => props.input?.props ?? ({} as LoginSurfaceCreateInput['props']));
const methods = computed<LoginMethod[]>(() => pageProps.value?.methods ?? []);
const brand = computed(() => pageProps.value?.brand);
const passwordRuleHint = computed(() => pageProps.value?.passwordRuleHint);
const initialCaptchaRequired = computed(() => pageProps.value?.captcha?.required ?? false);
/**
 * 宿主记住的登录名（LoginPageProps.rememberedUsername，安全设置「登录行为策略」记住用户名开关开时下发）：
 * 只用于预填用户名框；保存与清除都归宿主。SDK 快照可能尚未声明该字段，按可选字段读取。
 */
const rememberedUsername = computed(() => {
  const value = (pageProps.value as { rememberedUsername?: unknown } | undefined)?.rememberedUsername;
  return typeof value === 'string' ? value : '';
});

/**
 * 页面公开配置：SDK 的 LoginPageProps.pageConfig 由 SDK 提供，这里按本地类型断言读取，
 * 不依赖插件内 SDK 拷贝是否已刷新。目前只解释 login_style（slogan 由宿主映射进 brand.slogan）。
 */
const pageConfig = computed(
  () => (pageProps.value as { pageConfig?: Record<string, unknown> } | undefined)?.pageConfig
);
const resolvedStyle = computed(() => resolveLoginStyle(pageConfig.value));
const loginStyle = computed<LoginStyle>(() => resolvedStyle.value.style);
watch(
  () => resolvedStyle.value.unknownRaw,
  raw => {
    if (raw !== undefined) {
      safeLog(bridge.value, 'warn', 'login page received unknown login_style, fallback to split', {
        loginStyle: raw
      });
    }
  },
  { immediate: true }
);

/** 自定义标语：宿主映射的 brand.slogan；空白视为未设置（用样式默认标题）。 */
const slogan = computed(() => {
  const value = brand.value?.slogan;
  return typeof value === 'string' && value.trim() ? value : undefined;
});

/**
 * 品牌背景：仅在 brand.background 存在时以内联样式覆盖外壳根节点背景；缺省不设置任何内联值，
 * 让各外壳的默认渐变（含 html.dark 覆盖）生效——不硬编码品牌资产（§9）。
 */
const rootStyle = computed(() => {
  const bg = brand.value?.background;
  if (!bg) return {};
  // brand.background 既可能是图片 URL，也可能是纯 CSS 颜色/渐变值；只有明显是"路径/URL"时才包一层 url()。
  const looksLikeCssValue = /^(#|rgb|hsl|linear-gradient|radial-gradient|url\()/i.test(bg.trim());
  return { background: looksLikeCssValue ? bg : `url(${bg}) center / cover no-repeat` };
});

// ── i18n：单例创建 + provide 给子组件，locale 跟随宿主切换（§10） ──────────────────────
// 直接用 provideLoginI18n() 返回的响应式 t，不再自己 useLoginI18n() 自注入
// （Vue provide/inject 无法自闭环，见 useLoginI18n.ts 头部踩坑记录）。
const i18n = provideLoginI18n(bridge.value?.i18n);
const { t } = i18n;
onBeforeUnmount(() => {
  i18n.dispose();
});

safeLog(bridge.value, 'info', 'login page mounted', {
  methodKinds: methods.value.map(m => m.kind),
  loginStyle: loginStyle.value,
  hasSlogan: Boolean(slogan.value)
});

// ── Logo 策略（规则 3）：brand.logo 有值时替换内置标志；加载失败回退内置，绝不裂图 ──────────
const logoLoadFailed = ref(false);
// brand.logo 变化时重置失败态，避免旧 URL 的失败状态把新 URL 也挡在外面。
watch(
  () => brand.value?.logo,
  () => {
    logoLoadFailed.value = false;
  }
);
const brandLogo = computed(() => (brand.value?.logo && !logoLoadFailed.value ? brand.value.logo : undefined));
/** 带字标的完整 logo（split / aurora / glass）。 */
const logoSrc = computed(() => brandLogo.value ?? kimpoLogoUrl);
/** 图形标（ring）：品牌 logo 优先，否则内置无字图形标。 */
const markSrc = computed(() => brandLogo.value ?? kimpoMarkUrl);
function handleLogoError() {
  if (logoLoadFailed.value || !brand.value?.logo) return; // 已在展示内置兜底 svg，避免重复日志
  logoLoadFailed.value = true;
  safeLog(bridge.value, 'warn', 'brand logo image load failed, fallback to builtin', {
    url: brand.value?.logo
  });
}

// ── 语言切换（规则 9）：宿主提供 availableLocales/switchLocale 时为真下拉，否则仅视觉占位 ────────
const langOptions = computed(() => bridge.value?.i18n?.availableLocales ?? []);
const canSwitchLocale = computed(() => langOptions.value.length > 0 && typeof bridge.value?.i18n?.switchLocale === 'function');
const langMenuOptions = computed(() => langOptions.value.map(opt => ({ label: opt.label, key: opt.key })));
const langMenuVisible = ref(false);

function handleLangSelect(key: string) {
  langMenuVisible.value = false;
  const switchLocale = bridge.value?.i18n?.switchLocale;
  if (!switchLocale) return;
  void Promise.resolve(switchLocale(key)).catch(err => {
    // 切换语言失败不阻断登录主流程，只记日志（§11：日志不带敏感信息，这里只有 locale code）。
    safeLog(bridge.value, 'warn', 'login page switchLocale() rejected', { locale: key, error: String(err) });
  });
}

// ── 按 kind 分组渲染（§5）────────────────────────────────────────────────────────────
const SUPPORTED_KINDS = ['password', 'redirect', 'qr', 'otp'];
// 宿主可能下发多个 password 方式（本地 + password 类认证插件），全部交给账号表单，
// 多于一个时表单内出「登录方式」下拉；只有一个时行为与此前一致。
const passwordMethods = computed(() => methods.value.filter(m => m.kind === 'password'));
const passwordMethod = computed(() => passwordMethods.value[0]);
const redirectMethods = computed(() => methods.value.filter(m => m.kind === 'redirect'));
const qrMethods = computed(() => methods.value.filter(m => m.kind === 'qr'));
const otpMethods = computed(() => methods.value.filter(m => m.kind === 'otp'));

// manifest 声明 supported_auth_kinds=[password,redirect,qr,otp]；宿主已按声明与实例启用认证源
// 做交集下发，理论上不会收到其余 kind。防御性识别 + 告警，不静默吞掉配置异常。
const unsupportedMethods = computed(() => methods.value.filter(m => !SUPPORTED_KINDS.includes(m.kind)));
watch(
  unsupportedMethods,
  list => {
    if (list.length > 0) {
      safeLog(bridge.value, 'warn', 'login page received methods of unsupported kind', {
        kinds: list.map(m => m.kind)
      });
    }
  },
  { immediate: true }
);

const hasPassword = computed(() => Boolean(passwordMethod.value));
const hasQr = computed(() => qrMethods.value.length > 0);
const hasOtp = computed(() => otpMethods.value.length > 0);
const hasRedirect = computed(() => redirectMethods.value.length > 0);
const isEmpty = computed(() => !hasPassword.value && !hasQr.value && !hasOtp.value && !hasRedirect.value);

/**
 * 表单区默认高度（外壳据此固定卡片顶部位置）：主方式（账号 / 短信 / 扫码）多于一个时有 Tab，
 * 有主方式且有跳转类方式时有底部一行。只有跳转类时按兜底大按钮的近似高度计。
 */
/** 「登录方式」下拉行高度（与输入框 40 + 字段间距 36 同口径，见 styles/login-form.css）。 */
const METHOD_SELECT_ROW_HEIGHT = 76;
const formHeight = computed(() => {
  const primaryCount = (hasPassword.value ? 1 : 0) + otpMethods.value.length + qrMethods.value.length;
  if (primaryCount === 0) return isEmpty.value ? 120 : Math.max(120, redirectMethods.value.length * 48);
  // 多个 password 方式时账号表单多一行「登录方式」下拉（输入 40 + 间距 36）。
  const methodRow = passwordMethods.value.length > 1 ? METHOD_SELECT_ROW_HEIGHT : 0;
  return baseFormHeight(primaryCount > 1, hasRedirect.value) + methodRow;
});

// ── challenge 续步（§7.5）：login() / verifyOtp() 返回 challenge 时表单区整块替换为 ChallengeForm ──
const challenge = ref<{ type: string; challengeToken: string } | null>(null);

function handleChallenge(next: { type: string; challengeToken: string }) {
  if (next.type === 'password_change') {
    challenge.value = next;
    return;
  }
  // 未识别的 challenge 类型（未来 MFA，本登录页尚未支持）：提示而非静默吞掉（§7.5 末行）。
  safeMessage(bridge.value, 'error', t('login.err.unsupportedChallenge'));
  safeLog(bridge.value, 'warn', 'login page received unsupported challenge type', { type: next.type });
}

function handleChallengeDone(_ok: boolean) {
  // ok:true：ChallengeForm 内部已调 redirectFromLogin，这里只需清空态。
  // ok:false：token 失效/一次性耗尽或用户点「返回登录」，回到登录表单重新登录（§7.5）。
  challenge.value = null;
}

// ── 外壳选择 ────────────────────────────────────────────────────────────────────────
const layoutComponent = computed(() => {
  switch (loginStyle.value) {
    case 'aurora':
      return AuroraLayout;
    case 'ring':
      return RingLayout;
    case 'glass':
      return GlassLayout;
    default:
      return SplitLayout;
  }
});
</script>

<template>
  <component
    :is="layoutComponent"
    :style="rootStyle"
    :slogan="slogan"
    :logo-src="logoSrc"
    :mark-src="markSrc"
    :logo-alt="t('login.brand.logoAlt')"
    :base-form-height="formHeight"
    @logo-error="handleLogoError"
  >
    <template #lang>
      <!--
        语言切换图标（规则 9）：canSwitchLocale 为 false 时（老宿主未升级，或能力被 host_caps 裁剪）
        保持"仅视觉占位、不进 a11y/Tab 焦点序列"的降级路径，不假装一个不可用的按钮存在。
      -->
      <NDropdown
        v-if="canSwitchLocale"
        trigger="click"
        :options="langMenuOptions"
        :show="langMenuVisible"
        @update:show="v => (langMenuVisible = v)"
        @select="handleLangSelect"
      >
        <button
          type="button"
          class="klp-lang-toggle klp-lang-toggle-active"
          :aria-label="t('login.brand.langSwitchAlt')"
          v-html="iconLangRaw"
        ></button>
      </NDropdown>
      <div v-else class="klp-lang-toggle" aria-hidden="true" tabindex="-1" v-html="iconLangRaw"></div>
    </template>

    <NEmpty v-if="isEmpty" :description="t('login.noMethods')" class="klp-empty" />
    <LoginFormArea
      v-else
      :bridge="bridge"
      :variant="loginStyle"
      :password-method="passwordMethod"
      :password-methods="passwordMethods"
      :otp-methods="otpMethods"
      :qr-methods="qrMethods"
      :redirect-methods="redirectMethods"
      :captcha-required="initialCaptchaRequired"
      :remembered-username="rememberedUsername"
      :password-rule-hint="passwordRuleHint"
      :challenge="challenge"
      @challenge="handleChallenge"
      @challenge-done="handleChallengeDone"
    />
  </component>
</template>
