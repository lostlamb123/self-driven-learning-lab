import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages 的项目页跑在 `/self-driven-learning-lab/` 子路径下，
 * 需要 base 前缀才能正确加载资源；本地 dev / build 仍用根路径。
 * GitHub Actions 会自动注入 GITHUB_ACTIONS 环境变量，据此切换。
 */
const base = process.env.GITHUB_ACTIONS ? '/self-driven-learning-lab/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
