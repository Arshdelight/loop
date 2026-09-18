import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/workbench/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // package.json type:module，输出 .js/.d.ts 与 exports 声明一致
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  // dependencies / peerDependencies 全部 external（react-markdown 全家桶、
  // lucide-react、@arshdelight/loop-core 等），只打包本包源码
})
