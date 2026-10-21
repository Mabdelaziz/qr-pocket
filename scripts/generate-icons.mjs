// Generates public/icons/* (master SVGs, 192/512 PNG, 512 maskable PNG). Called by `npm run build`.
import { fileURLToPath } from 'node:url';
import { writeIcons } from './icons.mjs';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const written = writeIcons(dir);
console.log(`Generated ${written.length} icon files in public/icons/: ${written.join(', ')}`);
