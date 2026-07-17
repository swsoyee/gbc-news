import * as esbuild from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const subscribeCoreOutput = join(root, 'public/subscribe-core.js')
const themeBootOutput = join(root, 'public/theme-boot.js')

await Promise.all([
  esbuild.build({
    entryPoints: [join(root, 'src/web/subscribe-core.ts')],
    outfile: subscribeCoreOutput,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    logLevel: 'info',
  }),
  esbuild.build({
    entryPoints: [join(root, 'src/web/theme-boot.ts')],
    outfile: themeBootOutput,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    logLevel: 'info',
  }),
])

await Promise.all(
  [subscribeCoreOutput, themeBootOutput].map(async (outputPath) => {
    const source = await readFile(outputPath, 'utf8')
    const config = (await resolveConfig(outputPath)) ?? {}
    await writeFile(outputPath, await format(source, { ...config, filepath: outputPath }), 'utf8')
  }),
)
