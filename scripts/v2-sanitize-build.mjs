import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// The Cloudflare plugin emits local .dev.vars for preview. Those files are not release artifacts.
// Only generated files under this repository's dist tree are removed; source credentials stay intact.
const output = fileURLToPath(new URL('../dist/', import.meta.url));
let removed = 0;
function clean(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) clean(path);
    else if (entry.isFile() && /^\.dev\.vars(?:\..*)?$/.test(entry.name)) { unlinkSync(path); removed++; }
  }
}
clean(output);
console.log(`Release cleanup: removed ${removed} generated local-credential file(s).`);

// The gateway must run on every request and Workers Cache must sit in front of App only (workers/web.ts). If the generated
// config lost the per-entrypoint settings, the gateway itself would be cached and serve one nonce to everyone: refuse.
const deployed = JSON.parse(readFileSync(join(output, 'server/wrangler.json'), 'utf8'));
if (deployed.cache?.enabled !== true || deployed.exports?.default?.cache?.enabled !== false || deployed.exports?.App?.cache?.enabled !== true) {
  console.error('dist/server/wrangler.json must keep "cache" on with caching off for the default (gateway) export and on for App.');
  process.exit(1);
}

// Streamed icon markers must not carry the page path (vite-streamed-icons.ts): crawlers fetched "/<path>:<hash>:0" as pages.
let marked = 0;
function checkIconKeys(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkIconKeys(path);
    else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      const code = readFileSync(path, 'utf8');
      if (!code.includes('data-vinext-streamed-icon')) continue;
      if (/return\s*`\$\{\w+\}:\$\{\(\w+\s*>>>\s*0\)\.toString\(36\)\}`/.test(code)) { console.error(`${path} still builds streamed icon keys from the page path.`); process.exit(1); }
      if (code.includes('vinext-icon-')) marked++;
    }
  }
}
checkIconKeys(join(output, 'server'));
if (!marked) { console.error('No pathless streamed icon key found in dist/server: vite-streamed-icons.ts did not apply.'); process.exit(1); }
