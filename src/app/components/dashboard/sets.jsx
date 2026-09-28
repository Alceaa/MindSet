import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
const Sets = () => {
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadSets = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setSets(await setService.getSets());
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSets();
    }, [loadSets]);

    if (loading) {
        return <p className="mutedText">Загружаем сеты...</p>;
    }

    if (error) {
        return (
            <div className="alert alertError" role="alert">
                {error}
                <button className="btn btnGhost btnSmall" onClick={loadSets}>
                    Повторить
                </button>
            </div>
        );
    }

    if (sets.length === 0) {
        return (
            <div className="emptyState">
                <h2>Сетов пока нет</h2>
                <p className="mutedText">
                    Создайте первый сет — это заметка, внутри которой можно будет связывать
                    слова с другими сетами.
                </p>
                <Link className="btn btnPrimary" to="/sets/new">
                    Создать сет
                </Link>
            </div>
        );
    }

    return (
        <div className="setGrid">
            {sets.map((set) => (
                <Link className="setCard" key={set.id} to={`/sets/${set.id}`}>
                    <h3 className="setTitle">{set.title}</h3>
                    {set.description ? (
                        <p className="setDescription">{set.description}</p>
                    ) : (
                        <p className="setDescription mutedText">Без описания</p>
                    )}
                    <div className="setMeta">
                        <span className="badge">id {set.id}</span>
                        <span className="listMeta">Изменён {set.last_activity}</span>
                    </div>
                </Link>
            ))}
        </div>
    );
};

export default Sets;
