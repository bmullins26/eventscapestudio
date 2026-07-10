/**
 * Lightweight rectangle detector for hand-drawn / scanned maps.
 * Runs entirely in the browser: grayscale → threshold → connected-components →
 * bounding boxes → filters. Results are approximate; user is expected to
 * review/clean up detected booths after import.
 */

export interface DetectedRect {
  /** Pixel-space bounding box in the source image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectOptions {
  /** Minimum area in px^2 for a component to be considered a rectangle. */
  minArea?: number;
  /** Maximum area (defaults to 5% of image). */
  maxArea?: number;
  /** Absolute max rectangles returned. */
  maxCount?: number;
  /** Downscale target width in px (perf). */
  targetWidth?: number;
}

export async function detectRectanglesFromUrl(url: string, opts: DetectOptions = {}): Promise<{
  rects: DetectedRect[];
  imageWidth: number;
  imageHeight: number;
}> {
  const img = await loadImage(url);
  const targetW = Math.min(opts.targetWidth ?? 1200, img.naturalWidth);
  const scale = targetW / img.naturalWidth;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);

  // Grayscale + Otsu-ish threshold
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < imgData.data.length; i += 4, j++) {
    gray[j] = (imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114) | 0;
  }
  const thresh = otsuThreshold(gray);
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < thresh ? 1 : 0; // ink = 1

  // Connected components (4-connectivity), collect bounding boxes
  const labels = new Int32Array(w * h);
  let next = 0;
  const boxes: { minX: number; minY: number; maxX: number; maxY: number; count: number }[] = [];

  const stack: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (bin[idx] !== 1 || labels[idx] !== 0) continue;
      next++;
      let minX = x, minY = y, maxX = x, maxY = y, count = 0;
      stack.push(idx);
      labels[idx] = next;
      while (stack.length) {
        const p = stack.pop()!;
        const py = (p / w) | 0;
        const px = p - py * w;
        count++;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        // 4-neighbors
        if (px > 0) {
          const n = p - 1;
          if (bin[n] === 1 && labels[n] === 0) { labels[n] = next; stack.push(n); }
        }
        if (px < w - 1) {
          const n = p + 1;
          if (bin[n] === 1 && labels[n] === 0) { labels[n] = next; stack.push(n); }
        }
        if (py > 0) {
          const n = p - w;
          if (bin[n] === 1 && labels[n] === 0) { labels[n] = next; stack.push(n); }
        }
        if (py < h - 1) {
          const n = p + w;
          if (bin[n] === 1 && labels[n] === 0) { labels[n] = next; stack.push(n); }
        }
      }
      boxes.push({ minX, minY, maxX, maxY, count });
    }
  }

  const area = w * h;
  const minArea = opts.minArea ?? Math.max(80, area * 0.0005);
  const maxArea = opts.maxArea ?? area * 0.05;
  const maxCount = opts.maxCount ?? 500;

  const filtered: DetectedRect[] = [];
  for (const b of boxes) {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const bArea = bw * bh;
    if (bArea < minArea || bArea > maxArea) continue;
    if (bw < 4 || bh < 4) continue;
    const aspect = bw / bh;
    if (aspect < 0.2 || aspect > 5) continue;
    // Fill ratio: how much of bbox is ink? Rectangles-with-outline typically 15-70%.
    const fill = b.count / bArea;
    if (fill < 0.05 || fill > 0.95) continue;
    filtered.push({
      x: b.minX / scale,
      y: b.minY / scale,
      w: bw / scale,
      h: bh / scale,
    });
    if (filtered.length >= maxCount) break;
  }

  // Sort by area desc for consistent numbering
  filtered.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  return { rects: filtered, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight };
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, wF = 0, mB = 0, mF = 0, max = 0, between = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    mB = sumB / wB;
    mF = (sum - sumB) / wF;
    between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
