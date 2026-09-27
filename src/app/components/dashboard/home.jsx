import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
const Home = () => {
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setService
            .getSets()
            .then((data) => {
                if (active) setSets(data);
            })
            .catch((err) => {
                if (active) setError(parseApiError(err).message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const recent = sets.slice(0, 3);

    return (
        <div className="stack">
            <div className="cardGrid">
                <div className="card">
                    <h2 className="cardTitle">Последняя активность</h2>
                    {loading && <p className="mutedText">Загружаем сеты...</p>}
                    {error && <p className="errorText">{error}</p>}
                    {!loading && !error && recent.length === 0 && (
                        <p className="mutedText">
                            Пока пусто. Создайте первый сет — он появится здесь.
                        </p>
                    )}
                    {!loading && recent.length > 0 && (
                        <ul className="plainList">
                            {recent.map((set) => (
                                <li key={set.id}>
                                    <span className="listTitle">{set.title}</span>
                                    <span className="listMeta">{set.last_activity}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="card">
                    <h2 className="cardTitle">Быстрые действия</h2>
                    <div className="actionColumn">
                        <Link className="btn btnPrimary btnBlock" to="/sets/new">
                            Создать сет
                        </Link>
                        <Link className="btn btnGhost btnBlock" to="/dashboard?tab=sets">
                            Все сеты ({sets.length})
                        </Link>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Home;
