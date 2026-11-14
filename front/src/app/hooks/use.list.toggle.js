import { useEffect, useRef } from "react";
import { registerListToggle } from "../markdown/list.toggle";

/**
 * Регистрирует обработчик списков и чек-листов у экземпляра MDXEditor: он появляется
 * не сразу (редактор создаётся асинхронно), поэтому несколько раз пробуем снова.
 *
 * getEditor — функция, которая возвращает текущий редактор; variant — значение, которое
 * меняется, когда редактор пересоздаётся (например, режим страницы), чтобы обработчик
 * привязался к новому экземпляру.
 */
export default function useListToggle(getEditor, variant = 0) {
    const getEditorRef = useRef(getEditor);
    useEffect(() => {
        getEditorRef.current = getEditor;
    }, [getEditor]);

    useEffect(() => {
        let unregister = null;
        let attempts = 0;
        let timer = null;

        const attach = () => {
            const editor = getEditorRef.current?.();

            if (editor) {
                unregister = registerListToggle(editor);
                return;
            }

            attempts += 1;
            if (attempts < 20) {
                timer = window.setTimeout(attach, 150);
            }
        };

        attach();

        return () => {
            window.clearTimeout(timer);
            unregister?.();
        };
    }, [variant]);
}

export { useListToggle };
