import { cp, mkdir, rm, access } from 'node:fs/promises';
await access('web/vendor/three.module.js');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('web', 'dist', { recursive: true });
console.log('Built Mercantile: static game, bundled Three.js, and Captain’s Chart.');
