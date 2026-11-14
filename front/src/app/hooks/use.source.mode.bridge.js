import { useEffect, useRef } from "react";
import { markdownSourceEditorValue$, viewMode$ } from "@mdxeditor/editor";
import { isSourceMode, shouldReapplySource } from "../markdown/source.mode";

/**
 * Связывает source-режим редактора с состоянием сета.
 *
 * В source-режиме MDXEditor публикует текст в markdownSourceEditorValue$, а markdown$
 * (и, значит, onChange) не трогает. Без этой связи правки в source-режиме не попадали
 * ни в статью, ни в сохранение, а rich-text оставался с прежним текстом — при этом
 * следующая правка в нём падала с ошибкой Lexical.
 */
const useSourceModeBridge = ({ realm, editorRef, onSourceChange, prepare }) => {
    const draftRef = useRef(null);
    const baselineRef = useRef(null);
    const modeRef = useRef(null);
    const changeRef = useRef(onSourceChange);
    const prepareRef = useRef(prepare);

    useEffect(() => {
        changeRef.current = onSourceChange;
        prepareRef.current = prepare;
    }, [onSourceChange, prepare]);

    useEffect(() => {
        if (!realm || typeof realm.sub !== "function" || typeof realm.getValue !== "function") {
            return undefined;
        }

        // prepare приводит текст к виду, который понимает статья: в source-режиме фенс мог
        // быть набран и настоящим, и текстом с экранированными бэктиками.
        const prepared = (value) =>
            typeof prepareRef.current === "function" ? prepareRef.current(value) : value;

        const unsubscribeValue = realm.sub(markdownSourceEditorValue$, (value) => {
            if (typeof value !== "string" || !isSourceMode(realm.getValue(viewMode$))) {
                return;
            }

            // Первое значение после входа в source-режим — то, с чего начали.
            if (baselineRef.current === null) {
                baselineRef.current = value;
            }

            draftRef.current = value;
            changeRef.current?.(prepared(value));
        });

        const unsubscribeMode = realm.sub(viewMode$, (mode) => {
            const previous = modeRef.current;
            modeRef.current = mode;

            if (isSourceMode(mode) && !isSourceMode(previous)) {
                // Точка входа: если редактор ещё ничего не публиковал, берём текущее значение.
                const seeded = realm.getValue(markdownSourceEditorValue$);
                baselineRef.current = typeof seeded === "string" ? seeded : null;
                draftRef.current = baselineRef.current;
                return;
            }

            if (mode !== "rich-text" || !isSourceMode(previous)) {
                return;
            }

            const draft = draftRef.current;
            const baseline = baselineRef.current;
            draftRef.current = null;
            baselineRef.current = null;

            if (!shouldReapplySource({ previousMode: previous, nextMode: mode, draft, baseline })) {
                return;
            }

            // Редактор становится видимым в этом же кадре — переносим текст после него.
            window.requestAnimationFrame(() => {
                const editor = editorRef.current;
                if (editor && typeof editor.setMarkdown === "function") {
                    editor.setMarkdown(prepared(draft));
                }
            });
        });

        return () => {
            unsubscribeValue?.();
            unsubscribeMode?.();
        };
    }, [realm, editorRef]);
};

export default useSourceModeBridge;
