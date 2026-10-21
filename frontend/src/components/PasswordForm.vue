<script setup lang="ts">
/**
 * password kind 表单（手册 §7.1）：本地账户与 LDAP 账户共用同一个表单。
 *
 * 宿主下发多个 password 方式（宿主本地 + password 类认证插件）时，
 * 表单顶部（密码框上方）出「登录方式」下拉，login() 附带所选方式的 methodId（=LoginMethod.id），
 * 宿主据此定向认证并校验；只有一种 password 方式时界面与请求都保持原样（不带 methodId）。
 * 多出的下拉行与图形验证码行一样是「登录框高度固定」规则的例外（LoginPage.formHeight 已计入）。
 *
 * 2026-07-09 Figma 定稿视觉重构：改为逐字段校验态（规则 5）——必填校验失败不再走顶部统一
 * errorMessage，而是每个字段各自标红描边 + 框下红字；宿主返回的登录失败（errorCode）仍走
 * 统一 errorMessage 位置展示（两者语义不同，不能混用）。
 * login()/refreshCaptcha()/handleOutcome/handleFailure/CAPTCHA_RETRIGGER_CODES 等认证逻辑一律未改动。
 *
 * 2026-10-18 高度对齐：本组件固定为「主体 192」——用户名 40 + 36 + 密码 40 + 40 + 按钮 36。
 * 必填红字与宿主业务错误都改为绝对定位在既有间距内（业务错误不再单独占一块），切换状态不改变高度；
 * 唯一例外是图形验证码行（输入 + 图片 + 刷新），出现时整体向下多一行。样式统一见 styles/login-form.css。
 */
import { computed, reactive, ref, watch, type InputHTMLAttributes } from 'vue';
import { NButton, NInput, NSelect, NSpin } from 'naive-ui';
import type { AuthLoginHostBridge, LoginMethod, LoginOutcome } from '@kimposoft/plugin-sdk';
import { CAPTCHA_RETRIGGER_CODES, isKnownErrorCode, resolveErrorKey } from '../errorMessages';
import { safeLog } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';
// 输入框左侧内嵌图标（规则 5 实现要点）：`?raw` 内联渲染，stroke="currentColor" 部分随
// 外层文字色继承（深色主题自动变色），品牌蓝细节 #0877F4 是源文件写死的强调色，保留不变。
import iconUserRaw from '../assets/brand/icon-user.svg?raw';
import iconPassRaw from '../assets/brand/icon-pass.svg?raw';

defineOptions({ name: 'KimpoPasswordForm' });

const props = withDefaults(defineProps<{
  bridge?: AuthLoginHostBridge;
  /** 初始是否需要验证码（LoginPageProps.captcha.required）；运行中还会由错误码动态触发。 */
  captchaRequired?: boolean;
  /** 输入框左侧是否显示内嵌图标（ring 样式按视觉规范不显示）。 */
  showIcons?: boolean;
  /** 宿主下发的全部 password 方式；多于一个时显示「登录方式」下拉。 */
  methods?: LoginMethod[];
  /**
   * 宿主记住的登录名（LoginPageProps.rememberedUsername）：用于预填用户名框，用户已输入时不覆盖。
   * 本组件不写本地存储——登录名由宿主在 login() 凭证校验通过后保存（安全设置记住用户名开关）。
   */
  rememberedUsername?: string;
}>(), { captchaRequired: false, showIcons: true, methods: () => [], rememberedUsername: '' });

const emit = defineEmits<{
  /** login() 返回 challenge 时上抛给 LoginPage，由其切换到 ChallengeForm（§7.5）。 */
  (e: 'challenge', challenge: { type: string; challengeToken: string }): void;
}>();

const { t } = useLoginI18n();

// Workflow 真机登录只认这三个冻结语义锚点。NInput 的普通 attrs 会落在外层 .n-input
// wrapper，因此输入锚点必须经 NaiveUI 官方 inputProps 透传到原生 <input>；NButton 默认
// 根节点就是原生 <button>，其 data-testid 可直接透传。锚点不参与业务逻辑，也不携带凭证。
type SessionTargetInputProps = InputHTMLAttributes & { 'data-testid': string };

const sessionTargetLoginNameInputProps: Readonly<SessionTargetInputProps> = Object.freeze({
  'data-testid': 'session-target-login-name'
});
const sessionTargetLoginPasswordInputProps: Readonly<SessionTargetInputProps> = Object.freeze({
  'data-testid': 'session-target-login-password'
});

const model = reactive({ loginName: '', password: '', captchaCode: '' });

// 记住用户名预填：宿主下发了记住的登录名且用户尚未输入时填进用户名框（只记录是否预填，日志不带登录名）。
watch(
  () => props.rememberedUsername,
  name => {
    if (name && !model.loginName) {
      model.loginName = name;
      safeLog(props.bridge, 'info', 'password form prefilled remembered username');
    }
  },
  { immediate: true }
);

// ── 登录方式选择 ───────────────────────────────────────────────────────────────
const showMethodSelect = computed(() => props.methods.length > 1);
const methodOptions = computed(() => props.methods.map(m => ({ label: m.displayName, value: m.id })));
const selectedMethodId = ref('');
// 目录变化时所选方式不在目录里就回落第一条（宿主把本地方式排在首位）。
watch(
  () => props.methods,
  list => {
    if (!list.some(m => m.id === selectedMethodId.value)) selectedMethodId.value = list[0]?.id ?? '';
  },
  { immediate: true }
);

/**
 * SDK AuthLoginHostBridge.login 入参尚未声明 methodId（待 SDK 补字段）；宿主 bridge 已按可选字段
 * 接收，这里先用交叉类型构造入参再传入，不改 SDK。
 */
type LoginInputWithMethod = Parameters<AuthLoginHostBridge['login']>[0] & { methodId?: string };
const loading = ref(false);
/** 密码只活在这个组件的响应式状态里，提交瞬间经 bridge.login() 交给宿主后立即清空（红线①）。 */
const errorMessage = ref('');

// 规则 5：逐字段必填校验态——三个字段各自独立的错误文案，非空即代表该字段处于 error 态
// （用于驱动 NInput 的 status="error" 红边 + 框下 .klp-field-error 红字）。
// 与 errorMessage（宿主返回的整体性登录失败）分属两个不同展示位置，不互相覆盖。
const fieldErrors = reactive({ loginName: '', password: '', captcha: '' });

/** 用户在某字段重新输入时清除该字段的必填错误态（规则 5：“重新输入清除”）。 */
function clearFieldError(field: 'loginName' | 'password' | 'captcha') {
  fieldErrors[field] = '';
}

// captcha 区一旦显示就不再隐藏：无论是初始位还是登录失败动态触发，用户已看到过之后
// 继续展示比中途消失更符合直觉，避免"刚输入完又被收起"的抖动体验。
const captchaVisible = ref(Boolean(props.captchaRequired));
const captchaId = ref('');
const captchaImage = ref('');
const captchaLoading = ref(false);

async function loadCaptcha() {
  if (!props.bridge) return;
  captchaLoading.value = true;
  try {
    const result = await props.bridge.refreshCaptcha();
    captchaId.value = result.captchaId;
    captchaImage.value = result.imageBase64;
    model.captchaCode = '';
  } catch (err) {
    safeLog(props.bridge, 'warn', 'password form refreshCaptcha() rejected', { error: String(err) });
  } finally {
    captchaLoading.value = false;
  }
}

// captcha 区首次出现（初始位来自 bootstrap）时自动拉一次图，避免用户看到空白验证码框。
if (captchaVisible.value) {
  void loadCaptcha();
}

// 真机对照发现（2026-07-09）：登录按钮不能因字段为空整体禁用——规则 5 的逐字段校验态
// （ref-1543）恰恰是"点击登录、空字段标红"这个交互本身，按钮若被 canSubmit 禁用，
// 用户根本点不到它，永远走不到这个校验态。按钮只在请求进行中（loading）禁用，
// 空字段由 handleSubmit() 内部校验拦截并展示红字，不靠禁用按钮预防。
const canSubmit = computed(() => !loading.value);

async function handleSubmit() {
  if (loading.value) return; // 防双击

  // 规则 5：逐字段必填校验——替换原先“顶部统一 errorMessage”，改为每个字段各自标红。
  // 三个字段独立判定，互不覆盖：用户名/密码/验证码（仅在可见时）分别给出各自的错误文案。
  fieldErrors.loginName = model.loginName.trim() ? '' : t('login.form.loginNameRequired');
  fieldErrors.password = model.password ? '' : t('login.form.passwordRequired');
  fieldErrors.captcha = captchaVisible.value && !model.captchaCode ? t('login.captcha.required') : '';
  if (fieldErrors.loginName || fieldErrors.password || fieldErrors.captcha) {
    // 任一字段未通过：对应字段下方已展示红字，不再继续提交流程。业务错误与密码必填红字共用
    // 密码框下方同一间距，这里先清掉旧业务错误，避免两行重叠。
    errorMessage.value = '';
    return;
  }

  if (!props.bridge) {
    errorMessage.value = t('login.err.bridgeMissing');
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  const submittedPassword = model.password;
  try {
    const input: LoginInputWithMethod = {
      loginName: model.loginName,
      password: submittedPassword,
      ...(captchaVisible.value ? { captchaId: captchaId.value, captchaCode: model.captchaCode } : {}),
      ...(showMethodSelect.value && selectedMethodId.value ? { methodId: selectedMethodId.value } : {})
    };
    const outcome = await props.bridge.login(input);
    handleOutcome(outcome);
  } catch (err) {
    errorMessage.value = t('login.err.unknown');
    // 日志里绝不带密码/captcha 答案原文（§11 红线）：err 仅记录字符串化的异常本身。
    safeLog(props.bridge, 'warn', 'password form login() rejected', { error: String(err) });
  } finally {
    loading.value = false;
  }
  // 密码失败重试沿用宿主内置登录页既有体验：登录失败（如仅验证码错）不清空密码字段，
  // 避免用户连正确密码也要重打；challenge/成功两条路径会让本组件整体卸载（父级切走视图/页面跳转），
  // 组件状态随卸载自然释放，不构成"密码明文长期驻留"（红线①约束的是落盘持久化，非组件存活期内的内存态）。
}

function handleOutcome(outcome: LoginOutcome) {
  if (outcome.challenge) {
    emit('challenge', outcome.challenge);
    return;
  }
  if (outcome.ok) {
    props.bridge?.redirectFromLogin();
    return;
  }
  handleFailure(outcome.errorCode);
}

function handleFailure(errorCode?: string) {
  if (errorCode && CAPTCHA_RETRIGGER_CODES.has(errorCode)) {
    captchaVisible.value = true;
    void loadCaptcha();
  }
  // 宿主返回的业务性错误（密码错/账户锁定/验证码错等）走统一位置展示，与字段级必填红字分开
  // （规则 5：“字段必填校验=字段级红字；宿主返回的业务错误=整体错误位”，不要混用）。
  errorMessage.value = t(resolveErrorKey(errorCode));
  if (errorCode && !isKnownErrorCode(errorCode)) {
    safeLog(props.bridge, 'warn', 'password form login() returned unknown error code', { errorCode });
  }
}
</script>

<template>
  <form class="klp-form" novalidate @submit.prevent="handleSubmit">
    <div class="klp-fields">
      <!-- 多个 password 方式时的「登录方式」下拉（密码框上方，占一行）。 -->
      <div v-if="showMethodSelect" class="klp-field" data-testid="klp-login-method">
        <label class="klp-label-visually-hidden" for="klp-login-method">
          {{ t('login.form.method') }}
        </label>
        <NSelect
          id="klp-login-method"
          v-model:value="selectedMethodId"
          :options="methodOptions"
          size="large"
          :placeholder="t('login.form.methodPlaceholder')"
          :aria-label="t('login.form.method')"
          :disabled="loading"
          class="klp-input"
          @update:value="(id: string) => safeLog(bridge, 'info', 'password form login method switched', { methodId: id })"
        />
      </div>
      <div class="klp-field">
        <!-- 定稿视觉不展示字段名文案（占位符+左侧图标已足够表意），标签仍保留在 DOM 里做
             a11y for/id 关联与朗读文本，仅视觉隐藏（sr-only），不删除语义结构。 -->
        <label class="klp-label-visually-hidden" for="klp-login-name">
          {{ t('login.form.loginName') }}
        </label>
        <NInput
          id="klp-login-name"
          v-model:value="model.loginName"
          :input-props="sessionTargetLoginNameInputProps"
          size="large"
          :status="fieldErrors.loginName ? 'error' : undefined"
          :placeholder="t('login.form.loginNamePlaceholder')"
          autocomplete="username"
          :aria-label="t('login.form.loginName')"
          :disabled="loading"
          clearable
          class="klp-input"
          @update:value="clearFieldError('loginName')"
          @keyup.enter="handleSubmit"
        >
          <template v-if="showIcons" #prefix>
            <span class="klp-input-icon" v-html="iconUserRaw"></span>
          </template>
        </NInput>
        <!-- 必填红字：绝对定位在下方 36 间距内，不改变高度。 -->
        <p v-if="fieldErrors.loginName" class="klp-field-error" role="alert">{{ fieldErrors.loginName }}</p>
      </div>
      <div class="klp-field">
        <label class="klp-label-visually-hidden" for="klp-password">
          {{ t('login.form.password') }}
        </label>
        <NInput
          id="klp-password"
          v-model:value="model.password"
          :input-props="sessionTargetLoginPasswordInputProps"
          type="password"
          show-password-on="click"
          size="large"
          :status="fieldErrors.password ? 'error' : undefined"
          :placeholder="t('login.form.passwordPlaceholder')"
          autocomplete="current-password"
          :aria-label="t('login.form.password')"
          :disabled="loading"
          class="klp-input"
          @update:value="clearFieldError('password')"
          @keyup.enter="handleSubmit"
        >
          <template v-if="showIcons" #prefix>
            <span class="klp-input-icon" v-html="iconPassRaw"></span>
          </template>
        </NInput>
        <p v-if="fieldErrors.password" class="klp-field-error" role="alert">{{ fieldErrors.password }}</p>
        <!-- 宿主返回的业务错误（密码错 / 账户锁定 / 验证码错等）：密码框下方一行红字，放在既有间距里
             （不再单独占一块）；与字段必填红字互斥（提交校验失败时已清空业务错误）。 -->
        <p
          v-else-if="errorMessage"
          class="klp-biz-error"
          role="alert"
          aria-live="polite"
          :title="errorMessage"
        >
          <svg class="klp-biz-error-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" />
            <path d="M8 4.8v3.8M8 10.6v.6" stroke="currentColor" stroke-linecap="round" />
          </svg>
          <span class="klp-biz-error-text">{{ errorMessage }}</span>
        </p>
      </div>

      <!-- 图形验证码（初始要求或 AUTH_NEED_CAPTCHA 触发后出现，之后不再隐藏）：唯一允许多出的一行。 -->
      <div v-if="captchaVisible" class="klp-field">
        <label class="klp-label-visually-hidden" for="klp-captcha">
          {{ t('login.captcha.label') }}
        </label>
        <div class="klp-captcha-row">
          <NInput
            id="klp-captcha"
            v-model:value="model.captchaCode"
            size="large"
            :status="fieldErrors.captcha ? 'error' : undefined"
            :placeholder="t('login.captcha.placeholder')"
            :aria-label="t('login.captcha.label')"
            :disabled="loading"
            class="klp-input klp-captcha-input"
            @update:value="clearFieldError('captcha')"
            @keyup.enter="handleSubmit"
          />
          <button
            type="button"
            class="klp-captcha-img"
            :title="t('login.captcha.refresh')"
            :aria-label="t('login.captcha.refresh')"
            :disabled="captchaLoading"
            @click="loadCaptcha"
          >
            <NSpin v-if="captchaLoading" size="small" />
            <img v-else-if="captchaImage" :src="captchaImage" :alt="t('login.captcha.imageAlt')" />
          </button>
          <button
            type="button"
            class="klp-icon-refresh"
            :title="t('login.captcha.refreshIcon')"
            :aria-label="t('login.captcha.refreshIcon')"
            :disabled="captchaLoading"
            @click="loadCaptcha"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M13.2 8a5.2 5.2 0 1 1-1.52-3.68M13.2 2.6v2.6h-2.6"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
        <p v-if="fieldErrors.captcha" class="klp-field-error" role="alert">{{ fieldErrors.captcha }}</p>
      </div>
    </div>

    <NButton
      data-testid="session-target-login-submit"
      attr-type="submit"
      type="primary"
      size="large"
      block
      :loading="loading"
      :disabled="!canSubmit"
      class="klp-submit-btn"
    >
      {{ t('login.form.submit') }}
    </NButton>
  </form>
</template>
<!-- 样式统一在 styles/login-form.css（四种样式与四个表单组件共用同一套 token 与控件覆盖）。 -->
