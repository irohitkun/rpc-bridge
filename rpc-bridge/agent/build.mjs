import { build } from 'esbuild';
import { execSync } from 'child_process';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'cjs',
  external: ['@xhayper/discord-rpc', '@supabase/supabase-js'],
  sourcemap: false,
});

console.log('Bundle built. Packaging as .exe...');

execSync(
  'npx pkg dist/index.js --targets node20-win-x64 --output release/rpc-bridge-agent.exe',
  { stdio: 'inherit' }
);

console.log('Done: release/rpc-bridge-agent.exe');
