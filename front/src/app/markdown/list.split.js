import {
    $createListNode,
    $isListNode,
    ListItemNode,
    REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
    $createParagraphNode,
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_CRITICAL,
} from "lexical";

// Версии @lexical/* приходят из @mdxeditor/editor (сейчас 0.35.0) и должны совпадать
// с ядром lexical — поэтому отдельно в package.json их не фиксируем.

/**
 * Lexical по команде REMOVE_LIST_COMMAND снимает список целиком — вместе со всеми пунктами.
 * Нам нужно другое: снять список только с того пункта, где стоит курсор, и разделить список
 * на два (как в обычных редакторах). Возвращаем true, если обработали команду сами.
 */
export const registerListSplit = (editor) => {
    if (!editor || typeof editor.registerCommand !== "function") {
        return () => {};
    }

    return editor.registerCommand(
        REMOVE_LIST_COMMAND,
        () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
                return false;
            }

            const item = $getNearestNodeOfType(selection.anchor.getNode(), ListItemNode);
            const list = item ? item.getParent() : null;

            if (!item || !$isListNode(list)) {
                return false;
            }

            const items = list.getChildren();

            // Один пункт: пусть работает штатное поведение — список станет абзацем.
            if (items.length < 2) {
                return false;
            }

            // Пункт с вложенным списком не трогаем: разделение сложнее, чем нужно.
            if (item.getChildren().some((child) => $isListNode(child))) {
                return false;
            }

            const index = items.indexOf(item);
            const before = items.slice(0, index);
            const after = items.slice(index + 1);

            const paragraph = $createParagraphNode();
            paragraph.append(...item.getChildren());

            const buildList = (children) => {
                if (children.length === 0) {
                    return null;
                }

                const next = $createListNode(list.getListType());
                if (typeof list.getStart === "function" && typeof next.setStart === "function") {
                    next.setStart(list.getStart());
                }
                children.forEach((child) => next.append(child));
                return next;
            };

            const head = buildList(before);
            const tail = buildList(after);

            if (head) {
                list.insertBefore(head);
            }
            list.insertBefore(paragraph);
            if (tail) {
                list.insertBefore(tail);
            }
            list.remove();

            paragraph.selectStart();
            return true;
        },
        COMMAND_PRIORITY_CRITICAL,
    );
};

export default registerListSplit;
