import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// 单测配置：用真实 Vue / NaiveUI 挂载登录页，验证页面锚点契约；测试代码不进生产 bundle。
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.mjs']
  }
} as Parameters<typeof defineConfig>[0]);
