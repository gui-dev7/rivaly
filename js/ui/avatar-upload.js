/**
 * avatar-upload.js — reading a local image with native browser APIs only.
 *
 * The uploaded file is decoded, square-cropped and re-encoded to a small
 * WebP before it is handed back. That matters: localStorage holds roughly
 * 5 MB per origin, and dropping a 4 MB phone photo in there verbatim
 * would take the whole passport down with a QuotaExceededError.
 *
 * No library, no FileReader-to-Blob round trip beyond what is needed:
 * createImageBitmap + canvas + toDataURL.
 */

export const UPLOAD_LIMITS = {
    maxMB: 6,
    maxBytes: 6 * 1024 * 1024,
    size: 256,           // output edge, in px
    quality: 0.82,
    types: ['image/jpeg', 'image/png', 'image/webp'],
};

/**
 * @param {File} file
 * @returns {Promise<{ok:true, src:string, bytes:number} | {ok:false, error:string}>}
 */
export async function readImageFile(file) {
    if (!file) return { ok: false, error: 'Nenhum arquivo selecionado.' };

    if (!UPLOAD_LIMITS.types.includes(file.type)) {
        return { ok: false, error: 'Use uma imagem JPEG, PNG ou WebP.' };
    }
    if (file.size > UPLOAD_LIMITS.maxBytes) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        return { ok: false, error: `A imagem tem ${mb} MB. O limite é ${UPLOAD_LIMITS.maxMB} MB.` };
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return { ok: false, error: 'Não foi possível ler o arquivo como imagem.' };
    }

    try {
        const src = squareCrop(bitmap, UPLOAD_LIMITS.size, UPLOAD_LIMITS.quality);
        bitmap.close?.();

        // A data URL is ~4/3 the size of the bytes it encodes.
        const bytes = Math.round((src.length * 3) / 4);
        if (bytes > 900 * 1024) {
            return { ok: false, error: 'A imagem é complexa demais para o armazenamento local. Tente usar uma imagem mais simples.' };
        }
        return { ok: true, src, bytes };
    } catch {
        bitmap.close?.();
        return { ok: false, error: 'Não foi possível processar a imagem.' };
    }
}

/**
 * Centre-crops to a square and scales to `size`, so a portrait or
 * landscape photo never arrives stretched in a round avatar frame.
 */
function squareCrop(bitmap, size, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const edge = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - edge) / 2;
    const sy = (bitmap.height - edge) / 2;

    context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size);

    // WebP is markedly smaller than PNG here; PNG is the safety net for
    // any engine that refuses to encode it.
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}
