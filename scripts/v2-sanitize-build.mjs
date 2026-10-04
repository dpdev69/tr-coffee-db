import { readdirSync, unlinkSync } from 'node:fs';
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
