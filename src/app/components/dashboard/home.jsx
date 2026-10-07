import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import { stripMarkdown } from "../../utils/markdown.preview";

const Home = () => {
    const { user } = useAuth();
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setService
            .getSets()
            .then((data) => {
                if (active) {
                    setSets(data);
                }
            })
            .catch((err) => {
                if (active) {
                    setError(parseApiError(err).message);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    const recent = sets.slice(0, 5);

    return (
        <div className="page">
            <header className="pageHead">
                <div>
                    <h1 className="pageTitle">Привет, {user?.login}</h1>
                    <p className="pageSubtitle">Ваше пространство заметок и связей</p>
                </div>
                <Link className="btn btnPrimary" to="/sets/new">
                    Новый сет
                </Link>
            </header>

            <div className="cardGrid">
                <section className="card">
                    <h2 className="cardTitle">Недавние сеты</h2>
                    {loading && <p className="mutedText">Загружаем сеты…</p>}
                    {error && <p className="errorText">{error}</p>}
                    {!loading && !error && recent.length === 0 && (
                        <p className="mutedText">
                            Пока пусто. Создайте первый сет — он появится здесь.
                        </p>
                    )}
                    {!loading &&
                        !error &&
                        recent.map((set) => (
                            <Link className="homeSetRow" key={set.id} to={`/sets/${set.id}`}>
                                <span className="homeSetTitle">{set.title}</span>
                                <span className="homeSetPreview">
                                    {stripMarkdown(set.preview || set.description || "")}
                                </span>
                                <span className="listMeta">изменён {set.last_activity}</span>
                            </Link>
                        ))}
                </section>

                <section className="card">
                    <h2 className="cardTitle">Навигация</h2>
                    <div className="actionColumn">
                        <Link className="btn btnGhost btnBlock" to="/dashboard?tab=sets">
                            Все сеты ({sets.length})
                        </Link>
                        <Link className="btn btnGhost btnBlock" to="/dashboard?tab=graph">
                            Граф связей
                        </Link>
                        <Link className="btn btnGhost btnBlock" to="/explore">
                            Обзор сообщества
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Home;

