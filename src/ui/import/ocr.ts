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
  const { createWorker, OEM } = await import('tesseract.js');
  const base = new URL('tesseract/', document.baseURI).href;
  const worker = await createWorker('dan', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core/`,
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
