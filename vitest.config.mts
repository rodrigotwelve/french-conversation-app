import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
      'next/font/google': path.resolve(import.meta.dirname, './tests/__mocks__/nextFontMock.ts')
    }
  }
})
