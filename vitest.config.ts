import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      // Unit tests configuration
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
          // Test timeout
          testTimeout: 30000,
          hookTimeout: 30000,
          // Pool options for better isolation
          pool: 'threads',
          poolOptions: {
            threads: {
              singleThread: true,
            },
          },
          // Define globals
          define: {
            'import.meta.env.SSR': false,
          },
          // Coverage configuration
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            exclude: [
              'node_modules/',
              'dist/',
              '.storybook/',
              '**/*.stories.tsx',
              '**/*.stories.ts',
              '**/*.d.ts',
              'src/test-utils/**',
              'src/mocks/**',
              '**/__tests__/**',
              '**/*.config.*',
              '**/mockServiceWorker.js',
            ],
            thresholds: {
              lines: 80,
              functions: 80,
              branches: 75,
              statements: 80,
            },
          },
        },
        resolve: {
          alias: {
            '@': path.resolve(dirname, './src'),
            '@/lib': path.resolve(dirname, './src/lib'),
            '@/types': path.resolve(dirname, './src/types'),
            '@/stores': path.resolve(dirname, './src/stores'),
          },
        },
      },
      // Storybook tests configuration
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }]
      },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
