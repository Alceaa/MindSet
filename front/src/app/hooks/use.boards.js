import { useCallback, useEffect, useMemo, useState } from "react";
import boardService from "../api/board.service";
import { normalizeTitle } from "../markdown/wikilink";

/**
 * Свои доски для подстановки в текст сета: ссылка [[board:Название]] ищется по
 * названию, поэтому держим карту «ключ названия → доска». Загружаем только когда
 * в тексте действительно есть ссылки на доски — иначе лишний запрос ни к чему.
 */
const useBoards = (enabled = true) => {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState("");

    const reload = useCallback(async () => {
        if (!enabled) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            setBoards(await boardService.list());
        } catch (err) {
            setError(err?.response?.data?.message ?? "Не удалось загрузить доски");
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        reload();
    }, [reload]);

    const byKey = useMemo(() => {
        const map = new Map();

        boards.forEach((board) => {
            map.set(normalizeTitle(board.title), board);
        });

        return map;
    }, [boards]);

    return { boards, byKey, loading, error, reload };
};

export default useBoards;
