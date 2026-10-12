import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // server-only は React Server 以外で読むと例外を投げる。テストでは中身が要らない。
      'server-only': path.resolve(__dirname, 'lib/__tests__/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
  },
})
