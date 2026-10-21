<script setup lang="ts">
/**
 * 外壳：split 分栏卡片（默认样式，视觉规范 样式 D）。
 * 页面中央一张 1080×580 白色大卡片：左半是呼吸光晕 + 绕行小光球 + 「Sign In / to Kimpo」大标题，
 * 右半是 logo + 表单区。表单列起点按默认态在 580 高卡片内垂直居中后固定（视觉规范 formTop），
 * 状态切换不跳动；出现验证码时只向下生长（卡片高度固定，留有余量）。
 * ≤1024 改单列（隐藏大标题与小光球，卡片高度随内容、顶部固定）；≤640 卡片铺满。
 * 本外壳只负责画面，不承载任何认证逻辑。
 */
import { computed } from 'vue';

defineOptions({ name: 'KimpoLayoutSplit' });

const props = defineProps<{
  slogan?: string;
  logoSrc: string;
  /** 图形标（仅 ring 外壳使用）；声明出来避免作为未知属性透传到根节点。 */
  markSrc?: string;
  logoAlt: string;
  /** 表单区默认高度（不含验证码行）。 */
  baseFormHeight: number;
}>();

const emit = defineEmits<{ (e: 'logo-error'): void }>();

/** 桌面档卡片固定高度与表单列 logo 行占高（30 + 36），来自视觉规范。 */
const CARD_HEIGHT = 580;
const LOGO_BLOCK = 66;
/** 单列档卡片外框：上内边距 56（给语言图标留位）+ logo 66 + 下内边距 40。 */
const COMPACT_FRAME = 162;

const vars = computed(() => ({
  // 表单列顶部：(580 − 66 − f) / 2，至少 36
  '--klp-split-form-top': `${Math.max(36, Math.round((CARD_HEIGHT - LOGO_BLOCK - props.baseFormHeight) / 2))}px`,
  '--klp-card-h': `${COMPACT_FRAME + props.baseFormHeight}px`
}));
</script>

<template>
  <div class="klp-root klp-style-split klp-layout-split" :style="vars">
    <div class="klp-split-card">
      <!-- 左半装饰：呼吸光晕（视觉规范 kPulse），纯视觉；绕行小光球已移除。 -->
      <div class="klp-split-glow klp-motion" aria-hidden="true"></div>
      <h1 class="klp-split-title" :class="{ 'klp-split-title--slogan': slogan }">
        <span v-if="slogan" class="klp-slogan">{{ slogan }}</span>
        <template v-else>
          <!-- 品牌语，不随语言切换。 -->
          <span class="klp-split-title-line">Sign In</span>
          <span class="klp-split-title-line">to Kimpo</span>
        </template>
      </h1>

      <div class="klp-lang-slot"><slot name="lang" /></div>

      <!-- 右半表单列：顶部位置固定。 -->
      <div class="klp-split-form">
        <div class="klp-split-logo-row">
          <img :src="logoSrc" :alt="logoAlt" class="klp-split-logo" @error="emit('logo-error')" />
        </div>
        <main class="klp-split-main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.klp-layout-split {
  --klp-page-bg: linear-gradient(188deg, #e6f6ff 5%, #ffffff 65%);
  --klp-split-card-bg: #ffffff;
  --klp-split-card-shadow: 15px 0 56.8px rgba(9, 217, 238, 0.03), 0 29px 85.8px rgba(8, 119, 244, 0.1);
  --klp-split-glow: linear-gradient(217deg, #def2ff 0%, #eddfff 38%, #c2f9ff 76%, #fff5dc 100%);
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  background: var(--klp-page-bg);
}

html.dark .klp-layout-split {
  --klp-page-bg: linear-gradient(188deg, #0f1622 5%, #0b0d12 65%);
  --klp-split-card-bg: #161a22;
  --klp-split-card-shadow: 0 29px 70px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35);
  --klp-split-glow: linear-gradient(217deg, #1d3a55 0%, #3a2d5c 38%, #144a55 76%, #4a4228 100%);
}

/* 桌面档：固定 580 高，宽度随视口收窄（最多 1080）。 */
.klp-split-card {
  position: relative;
  width: min(1080px, 100%);
  height: 580px;
  flex: none;
  border-radius: 24px;
  overflow: hidden;
  background: var(--klp-split-card-bg);
  box-shadow: var(--klp-split-card-shadow);
}

/* 光晕：视觉规范 590 画框内 r=195 圆 + 50px 高斯模糊，圆心 (271, 290)。 */
.klp-split-glow {
  position: absolute;
  left: 76px;
  top: 95px;
  width: 390px;
  height: 390px;
  border-radius: 50%;
  background: var(--klp-split-glow);
  filter: blur(50px);
  animation: klp-split-pulse 9s ease-in-out infinite;
  pointer-events: none;
}

@keyframes klp-split-pulse {
  0%,
  100% {
    transform: scale(1);
    filter: blur(50px) hue-rotate(0deg);
  }
  50% {
    transform: scale(1.1);
    filter: blur(50px) hue-rotate(-35deg);
  }
}

/* 大标题：两行右对齐，64/92（视觉规范）；使用系统字体栈。 */
.klp-split-title {
  position: absolute;
  left: 130px;
  top: 207px;
  width: 288px;
  margin: 0;
  text-align: right;
  font-family: Roboto, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 900;
  font-size: 64px;
  line-height: 92px;
  color: var(--klp-text-primary);
}

/* 自定义标语：字号收小、加宽，右缘与默认标题对齐。 */
.klp-split-title--slogan {
  left: 58px;
  width: 360px;
  font-size: 40px;
  line-height: 1.35;
}

.klp-split-title-line {
  display: block;
}

.klp-lang-slot {
  position: absolute;
  top: 36px;
  right: 36px;
  z-index: 2;
}

/* 表单列：右缘距卡片 134（视觉规范 left 648 / width 298 / 卡宽 1080）。 */
.klp-split-form {
  position: absolute;
  right: 134px;
  top: var(--klp-split-form-top, 107px);
  width: 298px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.klp-split-logo-row {
  height: 30px;
  margin-bottom: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.klp-split-logo {
  height: 30px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.klp-split-main {
  width: 100%;
}

/* ≤1024：单列，隐藏大标题与小光球；卡片高度随内容、顶部固定（按默认态居中）。 */
@media (max-width: 1024px) {
  .klp-layout-split {
    align-items: flex-start;
    padding: max(24px, calc((100vh - var(--klp-card-h, 462px)) / 2)) 24px 24px;
  }

  .klp-split-card {
    width: min(440px, 100%);
    height: auto;
    padding: 56px 0 40px;
    box-sizing: border-box;
  }

  .klp-split-title {
    display: none;
  }

  .klp-split-glow {
    left: -140px;
    top: -160px;
    opacity: 0.8;
  }

  .klp-lang-slot {
    top: 20px;
    right: 20px;
  }

  .klp-split-form {
    position: relative;
    right: auto;
    top: auto;
    margin: 0 auto;
  }
}

/* ≤640：卡片铺满。 */
@media (max-width: 640px) {
  .klp-layout-split {
    padding: 16px;
  }

  .klp-split-card {
    width: 100%;
  }

  .klp-split-form {
    width: 100%;
    padding: 0 20px;
    box-sizing: border-box;
  }
}

@media (prefers-reduced-motion: reduce) {
  .klp-motion {
    animation: none !important;
  }
}
</style>
