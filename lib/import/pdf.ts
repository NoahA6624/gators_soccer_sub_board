// pdf.js loading + text extraction (port of SubParser.extract, L574, and loadPdfJs, L1441). CLIENT ONLY.
import type { TextItem } from './pdfParse';

export const PDFJS_VERSION = '3.11.174';
export const PDFJS_WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

type PdfJs = typeof import('pdfjs-dist');
let pdfReady: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (typeof window === 'undefined') return Promise.reject(new Error('The PDF reader only runs in the browser.'));
  if (!pdfReady) {
    pdfReady = import('pdfjs-dist')
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        return lib;
      })
      .catch((e) => {
        pdfReady = null;
        throw new Error('Could not load the PDF reader. ' + (e instanceof Error ? e.message : ''));
      });
  }
  return pdfReady;
}

/** Pull positioned text items from every page. */
export async function extractPages(data: Uint8Array): Promise<TextItem[][]> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of tc.items) {
      if ('str' in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }
    pages.push(items);
  }
  return pages;
}
