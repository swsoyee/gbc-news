import * as esbuild from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

await Promise.all([
  esbuild.build({
    entryPoints: [join(root, 'src/web/subscribe-core.ts')],
    outfile: join(root, 'public/subscribe-core.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    logLevel: 'info',
  }),
  esbuild.build({
    entryPoints: [join(root, 'src/web/theme-boot.ts')],
    outfile: join(root, 'public/theme-boot.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    logLevel: 'info',
  }),
])
