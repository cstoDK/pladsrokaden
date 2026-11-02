// Tekstgenkendelse af skærmbilleder med Tesseract.js. Alt kører i browseren:
// worker, kerne og dansk sprogpakke hentes fra appens egne filer (public/tesseract),
// og billedet sendes aldrig nogen steder hen.

export interface OcrStatus {
  tekst: string;
  /** 0 til 1, eller null hvis ukendt. */
  andel: number | null;
}

export async function genkendTekst(billede: Blob, status: (s: OcrStatus) => void): Promise<string> {
  status({ tekst: 'Gør tekstgenkendelsen klar ...', andel: null });
  const png = await somPng(billede);
  const base = new URL('tesseract/', document.baseURI).href;
  try {
    return await genkend(png, `${base}core/`, status);
  } catch {
    // Nogle browsere (især Safari) siger, de kan noget, de ikke kan. Prøv
    // igen med den simpleste udgave af tekstgenkendelsen.
    return await genkend(png, `${base}core/tesseract-core-lstm.wasm.js`, status);
  }
}

async function genkend(billede: Blob, corePath: string, status: (s: OcrStatus) => void): Promise<string> {
  const { createWorker, OEM } = await import('tesseract.js');
  const base = new URL('tesseract/', document.baseURI).href;
  const worker = await createWorker('dan', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath,
    langPath: `${base}lang`,
    gzip: true,
    workerBlobURL: false,
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') status({ tekst: 'Læser navnene i billedet ...', andel: m.progress });
      else status({ tekst: 'Gør tekstgenkendelsen klar ...', andel: null });
    },
  });
  try {
    const { data } = await worker.recognize(billede);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Tegner billedet om til PNG i browseren. Så kan tekstgenkendelsen læse det,
 * uanset om det kom som TIFF (Safari), HEIC (iPhone) eller WebP, og små
 * skærmbilleder forstørres, så bogstaverne bliver tydeligere.
 */
async function somPng(billede: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(billede);
    const skala = bmp.width < 1200 ? 2 : 1;
    const c = document.createElement('canvas');
    c.width = bmp.width * skala;
    c.height = bmp.height * skala;
    const g = c.getContext('2d');
    if (!g) return billede;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const png = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    return png ?? billede;
  } catch {
    return billede;
  }
}

/** Finder et billede i et indsæt- eller slip-event. */
export function findBillede(liste: DataTransfer | null): File | null {
  if (!liste) return null;
  for (const f of Array.from(liste.files)) if (f.type.startsWith('image/')) return f;
  for (const item of Array.from(liste.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
