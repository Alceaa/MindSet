import { useCallback, useEffect, useState } from "react";
import collectionService from "../api/collection.service";

/**
 * Список коллекций пользователя. Коллекции нужны сразу нескольким местам
 * (сайдбар, страница «Сеты», карточки), поэтому держим их в одном хуке:
 * после изменений зовём reload, и все, кто на него подписан, обновляются.
 */
const useCollections = (enabled = true) => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState("");

    const reload = useCallback(async () => {
        if (!enabled) {
            return;
        }

        setLoading(true);
        setError("");
        try {
            setCollections(await collectionService.list());
        } catch (err) {
            setError(err?.response?.data?.message ?? "Не удалось загрузить коллекции");
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { collections, loading, error, reload };
};

export default useCollections;
