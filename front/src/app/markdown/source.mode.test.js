import { isSourceMode, shouldReapplySource } from "./source.mode";

describe("isSourceMode", () => {
    it("source и diff — режимы исходника, rich-text — нет", () => {
        expect(isSourceMode("source")).toBe(true);
        expect(isSourceMode("diff")).toBe(true);
        expect(isSourceMode("rich-text")).toBe(false);
    });

    it("неизвестный режим режимом исходника не считает", () => {
        expect(isSourceMode(undefined)).toBe(false);
        expect(isSourceMode(null)).toBe(false);
        expect(isSourceMode("")).toBe(false);
    });
});

describe("shouldReapplySource", () => {
    const base = {
        previousMode: "source",
        nextMode: "rich-text",
        draft: "новый текст",
        baseline: "старый текст",
    };

    it("пересобирает rich-text после source-режима, если текст изменили", () => {
        expect(shouldReapplySource(base)).toBe(true);
    });

    it("diff-режим ведёт себя так же, как source", () => {
        expect(shouldReapplySource({ ...base, previousMode: "diff" })).toBe(true);
    });

    it("не трогает редактор, если в source-режиме ничего не меняли", () => {
        expect(shouldReapplySource({ ...base, draft: base.baseline })).toBe(false);
    });

    it("не срабатывает на входе в source-режим", () => {
        expect(
            shouldReapplySource({ ...base, previousMode: "rich-text", nextMode: "source" })
        ).toBe(false);
    });

    it("не срабатывает при переключении между source и diff", () => {
        expect(shouldReapplySource({ ...base, nextMode: "diff" })).toBe(false);
    });

    it("без черновика или точки входа ничего не пересобирает", () => {
        expect(shouldReapplySource({ ...base, draft: null })).toBe(false);
        expect(shouldReapplySource({ ...base, baseline: undefined })).toBe(false);
    });
});
