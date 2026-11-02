import { dataUrlToBlob, filesForLoad, filesForSave, isDataUrl } from "./board.files";

// 1×1 прозрачный пиксель — минимальный настоящий PNG в base64.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

const sceneFiles = () => ({
    "file-1": { id: "file-1", mimeType: "image/png", dataURL: PNG, created: 100 },
});

describe("isDataUrl", () => {
    it("отличает data URL от адреса в S3", () => {
        expect(isDataUrl(PNG)).toBe(true);
        expect(isDataUrl("https://s3.example/sets/1/a.png")).toBe(false);
        expect(isDataUrl(undefined)).toBe(false);
    });
});

describe("dataUrlToBlob", () => {
    it("достаёт из data URL тип и содержимое", async () => {
        const blob = dataUrlToBlob(PNG);

        expect(blob.type).toBe("image/png");
        expect(blob.size).toBeGreaterThan(0);
    });

    it("на мусоре бросает ошибку", () => {
        expect(() => dataUrlToBlob("просто текст")).toThrow();
    });
});

describe("filesForSave", () => {
    it("отправляет новую картинку в S3 и оставляет в сцене только адрес", async () => {
        const upload = jest.fn().mockResolvedValue("https://s3.example/sets/1/pic.png");

        const stored = await filesForSave(sceneFiles(), upload);

        expect(upload).toHaveBeenCalledTimes(1);
        expect(stored["file-1"]).toEqual({
            id: "file-1",
            mimeType: "image/png",
            created: 100,
            s3Url: "https://s3.example/sets/1/pic.png",
        });
        expect(stored["file-1"].dataURL).toBeUndefined();
    });

    it("повторно то же изображение не загружает", async () => {
        const upload = jest.fn().mockResolvedValue("https://s3.example/sets/1/pic.png");
        const cache = new Map();

        await filesForSave(sceneFiles(), upload, cache);
        const second = await filesForSave(sceneFiles(), upload, cache);

        expect(upload).toHaveBeenCalledTimes(1);
        expect(second["file-1"].s3Url).toBe("https://s3.example/sets/1/pic.png");
    });

    it("если загрузка не удалась, картинка остаётся в сцене", async () => {
        const upload = jest.fn().mockRejectedValue(new Error("нет связи"));

        const stored = await filesForSave(sceneFiles(), upload);

        expect(stored["file-1"].dataURL).toBe(PNG);
    });

    it("файл, который уже лежит в S3, не загружаем заново", async () => {
        const upload = jest.fn();
        const stored = await filesForSave(
            { "file-2": { id: "file-2", mimeType: "image/png", s3Url: "https://s3.example/2.png", created: 1 } },
            upload
        );

        expect(upload).not.toHaveBeenCalled();
        expect(stored["file-2"].s3Url).toBe("https://s3.example/2.png");
    });
});

describe("filesForLoad", () => {
    it("адрес из S3 читает обратно в data URL", async () => {
        const fetchImage = jest.fn().mockResolvedValue(PNG);

        const ready = await filesForLoad(
            { "file-1": { id: "file-1", mimeType: "image/png", s3Url: "https://s3.example/1.png", created: 5 } },
            fetchImage
        );

        expect(fetchImage).toHaveBeenCalledWith("https://s3.example/1.png");
        expect(ready["file-1"].dataURL).toBe(PNG);
        expect(ready["file-1"].s3Url).toBe("https://s3.example/1.png");
    });

    it("недоступную картинку пропускает, доска всё равно открывается", async () => {
        const fetchImage = jest.fn().mockRejectedValue(new Error("404"));

        const ready = await filesForLoad(
            { "file-1": { id: "file-1", mimeType: "image/png", s3Url: "https://s3.example/1.png" } },
            fetchImage
        );

        expect(ready).toEqual({});
    });

    it("картинку, которая уже в сцене, не трогает", async () => {
        const fetchImage = jest.fn();

        const ready = await filesForLoad(sceneFiles(), fetchImage);

        expect(fetchImage).not.toHaveBeenCalled();
        expect(ready["file-1"].dataURL).toBe(PNG);
    });
});
