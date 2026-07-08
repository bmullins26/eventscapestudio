// Client-side PDF rendering via pdf.js. Renders a chosen page to a PNG blob
// so uploaded PDFs can be used as a reference layer instead of showing the
// browser's generic file icon.
import * as pdfjs from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite resolves this to a URL string at build time.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl as string;

export type PdfDoc = Awaited<ReturnType<typeof pdfjs.getDocument extends (src: unknown) => { promise: infer P } ? (src: unknown) => Promise<P> : never>>;

export async function loadPdf(file: File | Blob | ArrayBuffer) {
  const data = file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  const task = pdfjs.getDocument({ data });
  return task.promise;
}

export async function renderPdfPageToBlob(
  pdf: Awaited<ReturnType<typeof loadPdf>>,
  pageNumber: number,
  targetScale = 2,
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: targetScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  // pdf.js typings for RenderParameters have shifted across versions; the
  // runtime accepts { canvasContext, viewport } consistently.
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.92),
  );
  return { blob, width: canvas.width, height: canvas.height };
}

export async function renderPdfPageToDataUrl(
  pdf: Awaited<ReturnType<typeof loadPdf>>,
  pageNumber: number,
  targetScale = 0.5,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: targetScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
  return canvas.toDataURL("image/png");
}

export async function loadImageNaturalSize(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
