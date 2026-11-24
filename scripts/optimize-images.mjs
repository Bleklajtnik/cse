// Jednorazowa konwersja obrazów do WebP (npm run images). Wynik: assets/img/<nazwa>-<szerokość>.<hash>.webp
// Oryginały zostają w assets/ (używają ich m.in. favicon, og:image i JSON-LD - tych nie zmieniamy).
// Po zmianie obrazu: uruchom ponownie i podmień nazwy plików w HTML na te z wypisanej listy.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets');
const OUT = join(SRC, 'img');

// [plik źródłowy, nazwa wyjściowa, szerokości (null = oryginał), jakość, opcje: crop = wycięcie środka]
const JOBS = [
  // tło hero: pełne (desktop) + środek 1080 px na telefony (background-size: cover pokazuje tam tylko środek)
  ['tlo1.jpg', 'tlo1', [null], 72],
  ['tlo1.jpg', 'tlo1-mobile', [null], 72, { crop: { width: 1080, height: 600 } }],
  ['girlanda1.png', 'girlanda1', [null], 85],
  ['igitlo.jpg', 'igitlo', [null], 72],
  // zdjęcie Marka: telefon (280 px wys. => 251 px szer. x2/x3), desktop (do 466 px szer. x2), awatar 64 px x3
  ['hero_zalozyciel_web.png', 'hero-zalozyciel', [192, 503, 754, null], 80],
  ['naklejkaigi.png', 'naklejka', [760, 1140], 80],
  ['lektor-michelle.jpg', 'lektor-michelle', [null], 80],
  ['Ted.png', 'lektor-theodore', [null], 80],
  ['lektor-mairead.jpg', 'lektor-mairead', [null], 80],
  ['logo.png', 'logo', [108], 90],
  // plakat wideo = pierwsza klatka opinia.mp4 (ffmpeg -i assets/opinia.mp4 -frames:v 1 -q:v 2 assets/opinia-poster.jpg)
  ['opinia-poster.jpg', 'opinia-poster', [1280], 72],
  // plakat VSL = klatka z 1,2 s VSL_main_1080p.mp4 (ffmpeg -ss 1.2 -i assets/VSL_main_1080p.mp4 -frames:v 1 -q:v 2 assets/vsl-poster.jpg)
  ['vsl-poster.jpg', 'vsl-poster', [1280], 75],
];

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.webp')) unlinkSync(join(OUT, f));

for (const [src, name, widths, quality, opts = {}] of JOBS) {
  for (const w of widths) {
    let img = sharp(join(SRC, src));
    const meta = await img.metadata();
    if (opts.crop) {
      const { width, height } = opts.crop;
      img = img.extract({ left: Math.round((meta.width - width) / 2), top: Math.round((meta.height - height) / 2), width, height });
    }
    if (w) img = img.resize({ width: w });
    const buf = await img.webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    const hash = createHash('sha256').update(buf.data).digest('hex').slice(0, 8);
    const file = `${name}-${buf.info.width}.${hash}.webp`;
    writeFileSync(join(OUT, file), buf.data);
    console.log(`${file}\t${buf.info.width}x${buf.info.height}\t${(buf.data.length / 1024).toFixed(0)} KB`);
  }
}
