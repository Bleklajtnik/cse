// Build CSS: Tailwind CLI -> assets/css/site.<hash>.css + podmiana odwołania w HTML.
// Uruchamiany przez `npm run build` (lokalnie i na Netlify przy każdym deployu, patrz netlify.toml).
// Hash w nazwie pozwala ustawić długi cache (immutable): zmiana CSS = nowa nazwa pliku.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'assets', 'css');
const TMP = join(CSS_DIR, '.site.tmp.css');
const PAGES = ['index.html', 'dziekujemy.html'];
const REF = /assets\/css\/site\.[0-9a-f]{8}\.css/g;

mkdirSync(CSS_DIR, { recursive: true });
const cli = join(dirname(require.resolve('tailwindcss/package.json')), 'lib', 'cli.js');
execFileSync(
  process.execPath,
  [cli, '-c', join(ROOT, 'tailwind.config.js'), '-i', join(ROOT, 'src', 'tailwind.css'), '-o', TMP, '--minify'],
  { cwd: ROOT, stdio: 'inherit' },
);

const css = readFileSync(TMP);
unlinkSync(TMP);
const hash = createHash('sha256').update(css).digest('hex').slice(0, 8);
const name = `site.${hash}.css`;

writeFileSync(join(CSS_DIR, name), css);
// stare wersje usuwamy, żeby nie zostawały w repozytorium (na Windows plik może być chwilowo zablokowany - wtedy
// tylko ostrzeżenie; zostanie usunięty przy następnym buildzie)
for (const f of readdirSync(CSS_DIR)) {
  if (!/^site\.[0-9a-f]{8}\.css$/.test(f) || f === name) continue;
  try {
    unlinkSync(join(CSS_DIR, f));
  } catch (e) {
    console.warn(`Uwaga: nie udało się usunąć starego ${f} (${e.code})`);
  }
}

for (const page of PAGES) {
  const file = join(ROOT, page);
  const html = readFileSync(file, 'utf8');
  if (!html.match(REF)) throw new Error(`${page}: brak odwołania do assets/css/site.<hash>.css`);
  const next = html.replace(REF, `assets/css/${name}`);
  if (next !== html) writeFileSync(file, next);
}
console.log(`CSS: assets/css/${name} (${(css.length / 1024).toFixed(1)} KB)`);
