// Kopierer tekstgenkendelsen (Tesseract.js) og den danske sprogpakke ind i
// public/, så appen selv leverer filerne. Ingen CDN ved kørsel.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ud = join(process.cwd(), 'public', 'tesseract');
const pakke = (navn) => dirname(require.resolve(`${navn}/package.json`));

rmSync(ud, { recursive: true, force: true });
mkdirSync(join(ud, 'core'), { recursive: true });
mkdirSync(join(ud, 'lang'), { recursive: true });

cpSync(join(pakke('tesseract.js'), 'dist', 'worker.min.js'), join(ud, 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  cpSync(join(pakke('tesseract.js-core'), f), join(ud, 'core', f));
}
cpSync(join(pakke('@tesseract.js-data/dan'), '4.0.0_best_int', 'dan.traineddata.gz'), join(ud, 'lang', 'dan.traineddata.gz'));
console.log('Tesseract kopieret til public/tesseract');
