export {};

// Imagens -> PDF ("combinar imagens num PDF"). Reaproveita a ideia do gerador
// PDF próprio de src/pdf.ts, mas com fluxos de imagem binários. JPEG entra como
// está (`/DCTDecode`, sem recompressão); RGB/RGBA já decodificados (o navegador
// decodifica PNG e afins via canvas) entram como `/FlateDecode`, com `/SMask`
// quando há canal alfa. 100% local, sem dependências.

export type PdfImageSource =
  | { kind: 'jpeg'; bytes: Uint8Array; width: number; height: number }
  | { kind: 'rgb'; rgb: Uint8Array; width: number; height: number }
  | { kind: 'rgba'; rgb: Uint8Array; alpha: Uint8Array; width: number; height: number };

export type ImagePageSize = 'a4' | 'letter' | 'fit';
export type ImageOrientation = 'portrait' | 'landscape' | 'auto';
export type ImageFit = 'contain' | 'cover';
export interface PdfImageOptions {
  pageSize: ImagePageSize;
  orientation: ImageOrientation;
  margin: number; // pt
  fit: ImageFit;
}
export const DEFAULT_IMAGE_OPTIONS: PdfImageOptions = {
  pageSize: 'a4',
  orientation: 'auto',
  margin: 0,
  fit: 'contain',
};
function resolveImageOptions(partial?: Partial<PdfImageOptions>): PdfImageOptions {
  const o = { ...DEFAULT_IMAGE_OPTIONS, ...(partial ?? {}) };
  o.margin = Math.min(120, Math.max(0, o.margin || 0));
  return o;
}

const BASE_DIMS: Record<'a4' | 'letter', { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

// Tamanho de um JPEG a partir do marcador SOF (sem decodificar a imagem).
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i += 1; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + len;
  }
  throw new Error('jpeg_no_sof');
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const buf = await new Response(new Blob([data as BlobPart]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}

class BinaryPdfWriter {
  private objects: (string | null)[] = [null];
  add(body: string): number { this.objects.push(body); return this.objects.length - 1; }
  set(id: number, body: string): void { this.objects[id] = body; }
  build(rootId: number): Uint8Array {
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [0];
    for (let id = 1; id < this.objects.length; id += 1) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${this.objects[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < this.objects.length; id += 1) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${this.objects.length} /Root ${rootId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

function pageBox(src: PdfImageSource, opts: PdfImageOptions): { w: number; h: number } {
  const pxToPt = 1; // 72 dpi
  if (opts.pageSize === 'fit') {
    return { w: src.width * pxToPt + opts.margin * 2, h: src.height * pxToPt + opts.margin * 2 };
  }
  const base = BASE_DIMS[opts.pageSize];
  let landscape = opts.orientation === 'landscape';
  if (opts.orientation === 'auto') landscape = src.width > src.height;
  return landscape ? { w: base.h, h: base.w } : { w: base.w, h: base.h };
}

export async function imagesToPdfBytes(sources: PdfImageSource[], options?: Partial<PdfImageOptions>): Promise<Uint8Array> {
  const opts = resolveImageOptions(options);
  const writer = new BinaryPdfWriter();
  const pagesId = writer.add('');
  const catalog = writer.add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const pageIds: number[] = [];

  for (let index = 0; index < (sources.length || 1); index += 1) {
    const src = sources[index];
    const box = src ? pageBox(src, opts) : BASE_DIMS.a4;
    let contentStream = '';
    let resources = '<< >>';

    if (src) {
      let imageObj: number;
      if (src.kind === 'jpeg') {
        const data = bytesToBinaryString(src.bytes);
        imageObj = writer.add(
          `<< /Type /XObject /Subtype /Image /Width ${src.width} /Height ${src.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n${data}\nendstream`,
        );
      } else {
        const rgbData = bytesToBinaryString(await deflate(src.rgb));
        let smaskRef = '';
        if (src.kind === 'rgba') {
          const alphaData = bytesToBinaryString(await deflate(src.alpha));
          const smaskId = writer.add(
            `<< /Type /XObject /Subtype /Image /Width ${src.width} /Height ${src.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n${alphaData}\nendstream`,
          );
          smaskRef = ` /SMask ${smaskId} 0 R`;
        }
        imageObj = writer.add(
          `<< /Type /XObject /Subtype /Image /Width ${src.width} /Height ${src.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${rgbData.length}${smaskRef} >>\nstream\n${rgbData}\nendstream`,
        );
      }
      resources = `<< /XObject << /Im0 ${imageObj} 0 R >> >>`;

      const availW = box.w - opts.margin * 2;
      const availH = box.h - opts.margin * 2;
      const ratios = [availW / src.width, availH / src.height];
      const scale = opts.fit === 'cover' ? Math.max(...ratios) : Math.min(...ratios);
      const drawW = src.width * scale;
      const drawH = src.height * scale;
      const x = (box.w - drawW) / 2;
      const y = (box.h - drawH) / 2;
      const clip = opts.fit === 'cover'
        ? `${opts.margin.toFixed(2)} ${opts.margin.toFixed(2)} ${availW.toFixed(2)} ${availH.toFixed(2)} re W n `
        : '';
      contentStream = `q ${clip}${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    }

    const contentId = writer.add(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    const resId = writer.add(resources);
    pageIds.push(writer.add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${box.w.toFixed(2)} ${box.h.toFixed(2)}] /Resources ${resId} 0 R /Contents ${contentId} 0 R >>`,
    ));
  }

  writer.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  return writer.build(catalog);
}

// Decodifica um File de imagem para PdfImageSource. JPEG entra sem recompressão;
// os demais são rasterizados via canvas (só no navegador). Usado por main.ts.
export async function decodeImageFile(file: File): Promise<PdfImageSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (isJpeg) {
    const { width, height } = jpegSize(bytes);
    return { kind: 'jpeg', bytes, width, height };
  }
  const bitmap = await createImageBitmap(new Blob([file]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const pixels = bitmap.width * bitmap.height;
  const rgb = new Uint8Array(pixels * 3);
  const alpha = new Uint8Array(pixels);
  let opaque = true;
  for (let i = 0; i < pixels; i += 1) {
    rgb[i * 3] = data[i * 4];
    rgb[i * 3 + 1] = data[i * 4 + 1];
    rgb[i * 3 + 2] = data[i * 4 + 2];
    alpha[i] = data[i * 4 + 3];
    if (alpha[i] !== 255) opaque = false;
  }
  bitmap.close();
  return opaque
    ? { kind: 'rgb', rgb, width: bitmap.width, height: bitmap.height }
    : { kind: 'rgba', rgb, alpha, width: bitmap.width, height: bitmap.height };
}
