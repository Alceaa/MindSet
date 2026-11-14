import {
    $createListNode,
    $isListItemNode,
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

// Версии @lexical/* приходят из @mdxeditor/editor и должны совпадать с ядром lexical —
// поэтому отдельно в package.json их не фиксируем.

/**
 * Пункты списка режем на подряд идущие группы: снять список нужно только с выделенных
 * пунктов (или с того, где стоит курсор), а остальные оставить списком. Чистая функция,
 * поэтому её проверяет тест.
 */
export const groupListItems = (keys, selectedKeys = new Set()) => {
    const groups = [];

    keys.forEach((key) => {
        const selected = selectedKeys.has(key);
        const last = groups[groups.length - 1];

        if (last && last.selected === selected) {
            last.keys.push(key);
            return;
        }

        groups.push({ selected, keys: [key] });
    });

    return groups;
};

/**
 * Списки и пункты, которых коснулось выделение: для курсора без выделения — ровно один
 * пункт, для выделения — все пункты диапазона.
 */
export const itemsUnderSelection = (selection) => {
    const touched = new Map();

    const add = (node) => {
        if (!node) {
            return;
        }

        const item = $isListItemNode(node) ? node : $getNearestNodeOfType(node, ListItemNode);
        const list = $isListItemNode(item) ? item.getParent() : null;

        if (!item || !$isListNode(list)) {
            return;
        }

        if (!touched.has(list)) {
            touched.set(list, new Set());
        }
        touched.get(list).add(item);
    };

    if (selection.isCollapsed()) {
        add(selection.anchor.getNode());
        return touched;
    }

    add(selection.anchor.getNode());
    add(selection.focus.getNode());
    selection.getNodes().forEach(add);

    return touched;
};

// Снимаем список с части пунктов: выделенные становятся абзацами, остальные — списками
// того же типа (то есть список может разорваться на два).
const unlistItems = (list, items, selection) => {
    const nodes = list.getChildren().filter((child) => $isListItemNode(child));
    const selectedKeys = new Set([...items].map((item) => item.getKey()));

    if (nodes.length === 0 || !nodes.some((item) => selectedKeys.has(item.getKey()))) {
        return false;
    }

    const byKey = new Map(nodes.map((item) => [item.getKey(), item]));
    const blocks = [];

    groupListItems(
        nodes.map((item) => item.getKey()),
        selectedKeys
    ).forEach((group) => {
        if (!group.selected) {
            const next = $createListNode(list.getListType());
            if (typeof list.getStart === "function" && typeof next.setStart === "function") {
                next.setStart(list.getStart());
            }
            group.keys.forEach((key) => next.append(byKey.get(key)));
            blocks.push(next);
            return;
        }

        group.keys.forEach((key) => {
            const item = byKey.get(key);
            const paragraph = $createParagraphNode();
            const nested = [];

            // Вложенные списки пункта остаются рядом со своим текстом.
            item.getChildren().forEach((child) => {
                if ($isListNode(child)) {
                    nested.push(child);
                    return;
                }
                paragraph.append(child);
            });

            blocks.push(paragraph, ...nested);
        });
    });

    blocks.forEach((block) => list.insertBefore(block));
    list.remove();

    // Курсор мог стоять на самом пункте (пустой пункт списка): после перестройки
    // такого узла уже нет — переносим курсор в первый абзац.
    if ($isRangeSelection(selection) && !selection.anchor.getNode().isAttached()) {
        blocks.find((block) => !$isListNode(block))?.selectStart();
    }

    return true;
};

/**
 * Lexical по REMOVE_LIST_COMMAND снимает списки целиком: в абзацы превращаются все пункты,
 * которых коснулось выделение. Нужно как в обычных редакторах: снять список только с
 * выделенных пунктов (или с того, где стоит курсор), а остальные оставить. Возвращаем true,
 * когда обработали команду сами.
 */
export const registerListToggle = (editor) => {
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

            const touched = itemsUnderSelection(selection);
            if (touched.size === 0) {
                return false;
            }

            let handled = false;
            touched.forEach((items, list) => {
                if (unlistItems(list, items, selection)) {
                    handled = true;
                }
            });

            return handled;
        },
        COMMAND_PRIORITY_CRITICAL
    );
};

export default registerListToggle;
