<script setup lang="ts">
/**
 * 外壳：glass 点阵毛玻璃（视觉规范样式 B）。
 * 浅蓝渐变底 + 两枚漂移光斑（色相缓变）+ 明暗呼吸的点阵层；中间 logo 行 + 400 宽半透明毛玻璃卡片，
 * 卡片标题默认「欢迎登录」（随语言，i18n 键 login.brand.welcome）。
 * logo + 卡片整体高度由内容决定、顶部固定（视觉规范 bTop = (900 − 178 − f) / 2）。
 * 本外壳只负责画面，不承载任何认证逻辑。
 */
import { computed } from 'vue';
import { useLoginI18n } from '../useLoginI18n';

defineOptions({ name: 'KimpoLayoutGlass' });

const props = defineProps<{
  slogan?: string;
  logoSrc: string;
  /** 图形标（仅 ring 外壳使用）；声明出来避免作为未知属性透传到根节点。 */
  markSrc?: string;
  logoAlt: string;
  baseFormHeight: number;
}>();

const emit = defineEmits<{ (e: 'logo-error'): void }>();

const { t } = useLoginI18n();

/** 外框：logo 30 + 间距 29 + 卡片上内边距 24 + 标题 29 + 32 + 下内边距 32 + 描边 2。 */
const FRAME_HEIGHT = 178;
const vars = computed(() => ({ '--klp-card-h': `${FRAME_HEIGHT + props.baseFormHeight}px` }));
</script>

<template>
  <div class="klp-root klp-style-glass klp-layout-glass" :style="vars">
    <!-- 背景装饰（纯视觉）：两枚光斑 + 点阵。 -->
    <div class="klp-glass-blob klp-glass-blob--a klp-motion" aria-hidden="true"></div>
    <div class="klp-glass-blob klp-glass-blob--b klp-motion" aria-hidden="true"></div>
    <div class="klp-glass-dots klp-motion" aria-hidden="true"></div>

    <div class="klp-glass-stage">
      <div class="klp-glass-logo-row">
        <img :src="logoSrc" :alt="logoAlt" class="klp-glass-logo" @error="emit('logo-error')" />
      </div>
      <div class="klp-glass-card">
        <div class="klp-lang-slot"><slot name="lang" /></div>
        <h1 class="klp-glass-title">
          <span v-if="slogan" class="klp-slogan">{{ slogan }}</span>
          <template v-else>{{ t('login.brand.welcome') }}</template>
        </h1>
        <main class="klp-glass-main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.klp-layout-glass {
  /* 1440×900 视觉规范单位（按视口短边缩放），用于光斑定位。 */
  --klp-glass-u: calc(min(100vh, 100vw) / 900);
  --klp-page-bg: linear-gradient(122deg, #e6f6ff 33%, #ffffff 65%);
  --klp-glass-blob-a: linear-gradient(217deg, #def2ff 0%, #dce0ff 100%);
  --klp-glass-blob-b: linear-gradient(217deg, #def2ff 0%, #eddfff 38%, #f7e4e4 76%, #fff5dc 100%);
  --klp-glass-dot: rgba(10, 190, 239, 0.4);
  --klp-glass-card-bg: rgba(255, 255, 255, 0.25);
  --klp-glass-card-border: #ffffff;
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--klp-page-bg);
}

html.dark .klp-layout-glass {
  --klp-page-bg: linear-gradient(122deg, #0c1622 33%, #0b0d12 65%);
  --klp-glass-blob-a: linear-gradient(217deg, #1d3a55 0%, #26305c 100%);
  --klp-glass-blob-b: linear-gradient(217deg, #1d3a55 0%, #3a2d5c 38%, #4a2c34 76%, #4a4228 100%);
  --klp-glass-dot: rgba(77, 171, 247, 0.22);
  --klp-glass-card-bg: rgba(20, 26, 36, 0.45);
  --klp-glass-card-border: rgba(255, 255, 255, 0.12);
}

/* 光斑：视觉规范 SVG 内圆 + 50px 高斯模糊；圆心相对视口中心 A(+265.5, −248.5) 直径 255，B(−310, +211) 直径 364。 */
.klp-glass-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(50px);
  pointer-events: none;
}

.klp-glass-blob--a {
  width: calc(var(--klp-glass-u) * 255);
  height: calc(var(--klp-glass-u) * 255);
  left: calc(50% + var(--klp-glass-u) * 138);
  top: calc(50% - var(--klp-glass-u) * 376);
  background: var(--klp-glass-blob-a);
  animation: klp-glass-float-a 16s ease-in-out infinite;
}

.klp-glass-blob--b {
  width: calc(var(--klp-glass-u) * 364);
  height: calc(var(--klp-glass-u) * 364);
  left: calc(50% - var(--klp-glass-u) * 492);
  top: calc(50% + var(--klp-glass-u) * 29);
  background: var(--klp-glass-blob-b);
  animation: klp-glass-float-b 19s ease-in-out infinite;
}

/* 点阵：14px 网格 1px 圆点，斜向遮罩渐隐 + 明暗呼吸。 */
.klp-glass-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--klp-glass-dot) 1px, transparent 1.5px);
  background-size: 14px 14px;
  -webkit-mask-image: linear-gradient(160deg, #000 0%, rgba(0, 0, 0, 0.45) 60%, rgba(0, 0, 0, 0.6) 100%);
  mask-image: linear-gradient(160deg, #000 0%, rgba(0, 0, 0, 0.45) 60%, rgba(0, 0, 0, 0.6) 100%);
  animation: klp-glass-twinkle 6s ease-in-out infinite;
  pointer-events: none;
}

/* filter 在关键帧里整体覆盖，故 blur 需与 hue-rotate 写在一起。 */
@keyframes klp-glass-float-a {
  0%,
  100% {
    transform: translate(0, 0);
    filter: blur(50px) hue-rotate(0deg);
  }
  50% {
    transform: translate(-90px, 60px);
    filter: blur(50px) hue-rotate(40deg);
  }
}

@keyframes klp-glass-float-b {
  0%,
  100% {
    transform: translate(0, 0);
    filter: blur(50px) hue-rotate(0deg);
  }
  50% {
    transform: translate(110px, -70px);
    filter: blur(50px) hue-rotate(-40deg);
  }
}

@keyframes klp-glass-twinkle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

/* 舞台：logo 行 + 卡片，顶部固定 = max(24, (视口高 − 默认高) / 2)。 */
.klp-glass-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 29px;
  padding: max(24px, calc((100vh - var(--klp-card-h, 478px)) / 2)) 24px 24px;
  box-sizing: border-box;
}

.klp-glass-logo-row {
  height: 30px;
  display: flex;
  align-items: center;
}

.klp-glass-logo {
  height: 30px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.klp-glass-card {
  position: relative;
  width: 400px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 24px 51px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 24px;
  background: var(--klp-glass-card-bg);
  backdrop-filter: blur(6.65px);
  -webkit-backdrop-filter: blur(6.65px);
  border: 1px solid var(--klp-glass-card-border);
}

.klp-lang-slot {
  position: absolute;
  left: 16px;
  top: 16px;
}

.klp-glass-title {
  margin: 0 0 32px;
  min-height: 29px;
  font-size: 20px;
  font-weight: 500;
  line-height: 29px;
  text-align: center;
  color: var(--klp-text-primary);
}

.klp-glass-main {
  width: 100%;
}

@media (max-width: 640px) {
  .klp-glass-stage {
    padding-left: 16px;
    padding-right: 16px;
  }

  .klp-glass-card {
    width: 100%;
    padding: 24px 20px 32px;
  }

  /* 标题两侧给语言图标让位，避免重叠。 */
  .klp-glass-title {
    padding: 0 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .klp-motion {
    animation: none !important;
  }
}
</style>
