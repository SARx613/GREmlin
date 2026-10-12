import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Injecte dans dist/sw.js la liste de tous les fichiers du build et une version (hash du contenu). */
function precache(): Plugin {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  return {
    name: 'precache',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const files = walk(dir)
        .map((f) => '/' + relative(dir, f).split('\\').join('/'))
        .filter((f) => f !== '/sw.js' && f !== '/index.html')
        .sort();
      const hash = createHash('sha1');
      for (const f of files) hash.update(f).update(readFileSync(join(dir, f)));
      hash.update(readFileSync(join(dir, 'index.html')));
      const sw = join(dir, 'sw.js');
      writeFileSync(
        sw,
        readFileSync(sw, 'utf8').replace('__BUILD__', hash.digest('hex').slice(0, 10)).replace('__PRECACHE__', JSON.stringify(files)),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), precache()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
