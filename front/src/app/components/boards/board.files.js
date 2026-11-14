/**
 * Картинки в доске. Сцена Excalidraw держит их как dataURL, но в базу такое
 * класть нельзя: одна фотография раздувает doc на мегабайты. Поэтому при
 * сохранении картинки уезжают в S3, а в doc остаётся только адрес; при загрузке
 * адрес снова превращается в dataURL — иначе Excalidraw их не нарисует.
 *
 * Загрузка и чтение передаются снаружи: так модуль остаётся проверяемым тестами.
 */

export const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:");

// data:image/png;base64,AAAA → Blob. Разбираем сами: fetch на data: URL
// поддержан не везде, а atob есть и в браузере, и в тестах.
export const dataUrlToBlob = (dataUrl) => {
    const comma = String(dataUrl).indexOf(",");
    if (comma === -1) {
        throw new Error("Некорректный data URL");
    }

    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mime });
};

const meta = (file) => ({
    id: file.id,
    mimeType: file.mimeType,
    created: file.created,
});

/**
 * Готовит картинки к сохранению: новые отправляет в S3, уже загруженные берёт
 * из кеша (иначе одно и то же изображение уезжало бы при каждом сохранении).
 * Если загрузка не удалась, файл остаётся как был — картинка не потеряется.
 */
export const filesForSave = async (files, upload, cache = new Map()) => {
    const stored = {};

    for (const [id, file] of Object.entries(files ?? {})) {
        if (!file) {
            continue;
        }

        if (cache.has(id)) {
            stored[id] = { ...meta(file), s3Url: cache.get(id) };
            continue;
        }

        if (file.s3Url && !isDataUrl(file.dataURL)) {
            cache.set(id, file.s3Url);
            stored[id] = { ...meta(file), s3Url: file.s3Url };
            continue;
        }

        if (isDataUrl(file.dataURL)) {
            try {
                const s3Url = await upload(file);
                cache.set(id, s3Url);
                stored[id] = { ...meta(file), s3Url };
                continue;
            } catch {
                stored[id] = file;
                continue;
            }
        }

        stored[id] = file;
    }

    return stored;
};

/**
 * Готовит картинки к показу: адреса из S3 читает обратно в dataURL.
 * Если картинку прочитать не удалось, файл пропускаем — Excalidraw просто
 * не нарисует её, но доска откроется.
 */
export const filesForLoad = async (files, fetchImage) => {
    const ready = {};

    for (const [id, file] of Object.entries(files ?? {})) {
        if (!file) {
            continue;
        }

        if (file.s3Url && !isDataUrl(file.dataURL)) {
            try {
                ready[id] = { ...file, dataURL: await fetchImage(file.s3Url), lastRetrieved: Date.now() };
            } catch {
                // Картинка недоступна — оставляем доску без неё.
            }
            continue;
        }

        ready[id] = file;
    }

    return ready;
};

export default filesForSave;
