import uploadsService from "../api/uploads.service";

const MAX_DIM = 1600;
const QUALITY = 0.85;

const loadImage = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Не удалось прочитать изображение"));
        };
        img.src = url;
    });

export async function compressImage(file) {
    if (!file.type.startsWith("image/")) {
        return file;
    }
    if (file.type === "image/gif") {
        return file;
    }

    try {
        const img = await loadImage(file);
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
        if (!blob || blob.size >= file.size) {
            return file;
        }

        const base = (file.name || "image").replace(/\.[^.]+$/, "");
        const ext = type === "image/png" ? "png" : "jpg";
        return new File([blob], `${base}.${ext}`, { type });
    } catch {
        return file;
    }
}

export async function uploadImage(file) {
    const prepared = await compressImage(file);
    const presign = await uploadsService.presign(prepared.type);

    const response = await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": prepared.type },
        body: prepared,
    });
    if (!response.ok) {
        throw new Error("Не удалось загрузить изображение");
    }
    return presign.public_url;
}

export default uploadImage;
