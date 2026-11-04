import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: false,
    watch: false,
    include: ['test/**/*.{spec,e2e-spec}.ts', 'src/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**', '.next/**', 'coverage/**', '.turbo/**'],
  },
});
