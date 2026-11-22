// Bundles the app into build/: the main process and the server library in
//    main.cjs, the preload script, and the window's files.
import * as fs from 'node:fs';
import * as esbuild from 'esbuild';

fs.rmSync('build', { recursive: true, force: true });

const common = {
    bundle: true,
    logLevel: 'warning',
    sourcemap: true,
};

await esbuild.build({
    ...common,
    entryPoints: ['src/main.ts'],
    outfile: 'build/main.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
});

await esbuild.build({
    ...common,
    entryPoints: ['src/preload.ts'],
    outfile: 'build/preload.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
});

await esbuild.build({
    ...common,
    entryPoints: ['src/renderer/renderer.ts'],
    outfile: 'build/renderer/renderer.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
});

for (const name of ['index.html', 'style.css']) {
    fs.copyFileSync(`src/renderer/${name}`, `build/renderer/${name}`);
}
