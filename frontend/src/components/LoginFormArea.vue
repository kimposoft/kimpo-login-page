<script setup lang="ts">
/**
 * 表单区（四种样式共用同一份）：顶部 Tab + 主体 + 底部「其他方式」一行。
 *
 * 链路：kimpo 登录页插件内部组件，纯登录 UI——方式分组与 challenge 状态由
 * LoginPage 持有并传入，本组件只负责「哪种方式放哪个 Tab、各块怎么排」，认证调用仍在各表单组件里。
 *
 * 规则：
 *   - Tab：账号登录 / 短信登录（有 otp 时）/ 扫码登录（有 qr 时）；只有一种主方式时不显示 Tab。
 *     aurora 用分段 Tab，其余用居中下划线 Tab。多个同类方式（如两个扫码源）各占一个 Tab，标签用展示名。
 *   - 跳转类（redirect）只在底部一行以 32px 小图标出现；没有任何主方式时退回整行大按钮兜底。
 *   - 高度：Tab 56 / 主体 192 / 底部 52；切 Tab、红字、业务错误都不改变高度，唯一例外是图形验证码行。
 *     账号与短信表单用 v-show 保留输入与倒计时状态；扫码用 v-if，离开 Tab 即停轮询。
 *   - 改密续步（challenge）整块替换为 ChallengeForm（自带同高的头部与「返回登录」）。
 */
import { computed, ref, watch } from 'vue';
import type { AuthLoginHostBridge, LoginMethod } from '@kimposoft/plugin-sdk';
import type { LoginStyle } from '../loginStyle';
import { safeLog } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';
import PasswordForm from './PasswordForm.vue';
import OtpForm from './OtpForm.vue';
import QrPanel from './QrPanel.vue';
import RedirectButtons from './RedirectButtons.vue';
import ChallengeForm from './ChallengeForm.vue';

defineOptions({ name: 'KimpoLoginFormArea' });

const props = defineProps<{
  bridge?: AuthLoginHostBridge;
  variant: LoginStyle;
  passwordMethod?: LoginMethod;
  /** 全部 password 方式；多于一个时账号表单内出「登录方式」下拉。 */
  passwordMethods?: LoginMethod[];
  otpMethods: LoginMethod[];
  qrMethods: LoginMethod[];
  redirectMethods: LoginMethod[];
  captchaRequired: boolean;
  /** 宿主记住的登录名（记住用户名开关开时），交给账号表单预填。 */
  rememberedUsername?: string;
  passwordRuleHint?: { minLength?: number; requireClasses?: number };
  challenge: { type: string; challengeToken: string } | null;
}>();

const emit = defineEmits<{
  (e: 'challenge', challenge: { type: string; challengeToken: string }): void;
  (e: 'challenge-done', ok: boolean): void;
}>();

const { t } = useLoginI18n();

/** ring 样式按视觉规范不显示输入框内嵌图标。 */
const showIcons = computed(() => props.variant !== 'ring');
const tabsKind = computed(() => (props.variant === 'aurora' ? 'seg' : 'line'));

interface TabDef {
  /** password / otp:<id> / qr:<id> */
  key: string;
  label: string;
}

/** Tab 列表：账号 → 短信 → 扫码；同类多个时标签用展示名区分。 */
const tabs = computed<TabDef[]>(() => {
  const list: TabDef[] = [];
  if (props.passwordMethod) {
    list.push({
      key: 'password',
      label: props.variant === 'aurora' ? t('login.tab.password') : t('login.tab.account')
    });
  }
  for (const m of props.otpMethods) {
    list.push({ key: `otp:${m.id}`, label: props.otpMethods.length > 1 ? m.displayName : t('login.tab.otp') });
  }
  for (const m of props.qrMethods) {
    list.push({ key: `qr:${m.id}`, label: props.qrMethods.length > 1 ? m.displayName : t('login.tab.qr') });
  }
  return list;
});

const hasPrimary = computed(() => tabs.value.length > 0);
const showTabs = computed(() => tabs.value.length > 1);
const showRedirectRow = computed(() => hasPrimary.value && props.redirectMethods.length > 0);

const activeTab = ref<string>(tabs.value[0]?.key ?? '');
// 方式目录变化（宿主重新下发）后当前 Tab 不存在时回到第一个。
watch(tabs, list => {
  if (!list.some(tab => tab.key === activeTab.value)) activeTab.value = list[0]?.key ?? '';
});

const activeQr = computed(() =>
  activeTab.value.startsWith('qr:') ? props.qrMethods.find(m => `qr:${m.id}` === activeTab.value) : undefined
);

function selectTab(key: string) {
  if (key === activeTab.value) return;
  activeTab.value = key;
  safeLog(props.bridge, 'info', 'login tab switched', { tab: key.split(':')[0] });
}

/** 左右方向键在 Tab 间移动（tablist 键盘约定）。 */
function handleTabKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const next = tabs.value[(index + step + tabs.value.length) % tabs.value.length];
  if (next) selectTab(next.key);
}
</script>

<template>
  <div class="klp-form-area" :class="`klp-form-area--${variant}`">
    <ChallengeForm
      v-if="challenge"
      :bridge="bridge"
      :challenge-token="challenge.challengeToken"
      :password-rule-hint="passwordRuleHint"
      :show-icons="showIcons"
      @done="ok => emit('challenge-done', ok)"
      @back="emit('challenge-done', false)"
    />

    <template v-else-if="hasPrimary">
      <div
        v-if="showTabs"
        role="tablist"
        :aria-label="t('login.tab.ariaLabel')"
        class="klp-tabs"
        :class="`klp-tabs--${tabsKind}`"
      >
        <button
          v-for="(tab, index) in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="klp-tab"
          :aria-selected="tab.key === activeTab ? 'true' : 'false'"
          :tabindex="tab.key === activeTab ? 0 : -1"
          :title="tab.label"
          @click="selectTab(tab.key)"
          @keydown="handleTabKeydown($event, index)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="klp-form-body">
        <PasswordForm
          v-if="passwordMethod"
          v-show="activeTab === 'password'"
          :bridge="bridge"
          :captcha-required="captchaRequired"
          :show-icons="showIcons"
          :methods="passwordMethods ?? []"
          :remembered-username="rememberedUsername"
          @challenge="next => emit('challenge', next)"
        />
        <OtpForm
          v-for="m in otpMethods"
          v-show="activeTab === `otp:${m.id}`"
          :key="m.id"
          :bridge="bridge"
          :method="m"
          :show-icons="showIcons"
          @challenge="next => emit('challenge', next)"
        />
        <QrPanel v-if="activeQr" :key="activeQr.id" :bridge="bridge" :method="activeQr" />
      </div>

      <RedirectButtons v-if="showRedirectRow" :bridge="bridge" :methods="redirectMethods" mode="icons" />
    </template>

    <!-- 只有跳转类方式：整行大按钮兜底。 -->
    <RedirectButtons v-else :bridge="bridge" :methods="redirectMethods" mode="buttons" />
  </div>
</template>
