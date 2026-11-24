import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 公开访问走站点根路径（https://<域名>/plugins/）。
 * 部署到 GitHub Pages 项目站时用 SITE_BASE=/dsh-vyra-plugins/ 覆盖；
 * 挂自定义域名时保持默认 /。
 */
const base = process.env.SITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 7000,
    strictPort: true,
    // Vite 6 默认拒绝陌生 Host（防 DNS rebinding）。
    // 通过 cpolar 隧道访问时，公网域名必须在这里显式放行。
    allowedHosts: ['dsh-plugin.vip.cpolar.cn'],
  },
  preview: {
    host: '127.0.0.1',
    port: 7000,
    strictPort: true,
    allowedHosts: ['dsh-plugin.vip.cpolar.cn'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
