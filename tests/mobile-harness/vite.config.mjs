import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({ root, server: { host: '127.0.0.1', port: 3092, strictPort: true }, esbuild: { jsx: 'automatic' }, css: { postcss: { plugins: [tailwind({ base: root })] } }, resolve: { alias: [
{ find: './voice-sdk-adapter', replacement: root + 'tests/mobile-harness/voice.ts' },
{ find: '@/lib/auth', replacement: root + 'tests/mobile-harness/server.ts' },
{ find: '@/lib/prisma', replacement: root + 'tests/mobile-harness/server.ts' },
{ find: '@/lib/supabase/client', replacement: root + 'tests/mobile-harness/server.ts' },
{ find: 'next/navigation', replacement: root + 'tests/mobile-harness/navigation.ts' },
{ find: 'next/link', replacement: root + 'tests/mobile-harness/link.tsx' },
{ find: '@', replacement: root + 'src' },
] } });
