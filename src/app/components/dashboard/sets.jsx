import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
const Sets = () => {
    const [sets, setSets] = useState([]);
    const [tombstones, setTombstones] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadSets = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [setsData, tombstoneData] = await Promise.all([
                setService.getSets(),
                setService.getSetTombstones().catch(() => []),
            ]);
            setSets(setsData);
            setTombstones(tombstoneData);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, []);

    const forbidCopies = async (tombstone) => {
        setBusyId(tombstone.id);
        setError("");
        try {
            await setService.forbidSetTombstone(tombstone.id);
            await loadSets();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setBusyId(null);
        }
    };

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

    return (
        <div className="stack">
            {tombstones.length > 0 && (
                <section className="card">
                    <h2 className="cardTitle">Отложенные удаления</h2>
                    <p className="mutedText">
                        Копии этих сетов остаются у читателей до указанной даты, после чего
                        удалятся безвозвратно. Запрет можно применить досрочно.
                    </p>
                    <ul className="plainList">
                        {tombstones.map((item) => (
                            <li key={item.id}>
                                <span className="savedItemMain">
                                    <span className="listTitle">
                                        {item.title || `Сет #${item.set_id}`}
                                    </span>
                                    <span className="listMeta">копии до {item.deadline}</span>
                                </span>
                                <span className="savedItemActions">
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        disabled={busyId === item.id || item.forbid_applied}
                                        onClick={() => forbidCopies(item)}
                                    >
                                        {item.forbid_applied
                                            ? "Запрет применён"
                                            : "Запретить копии сейчас"}
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {sets.length === 0 ? (
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
            ) : (
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
            )}
        </div>
    );
};

export default Sets;
