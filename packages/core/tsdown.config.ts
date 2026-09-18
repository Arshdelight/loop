import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // package.json type:module，输出 .js/.d.ts 与 exports 声明一致
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
