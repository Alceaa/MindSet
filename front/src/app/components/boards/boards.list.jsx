import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import boardService from "../../api/board.service";
import parseApiError from "../../utils/api.error";
import "../../css/boards/boards.scss";

const VISIBILITY_LABELS = {
    private: "Личная",
    unlisted: "По ссылке",
    public: "Публичная",
};

const formatDate = (value) => {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
};

const BoardsList = () => {
    const navigate = useNavigate();

    const [boards, setBoards] = useState([]);
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        boardService
            .list()
            .then((data) => {
                if (!cancelled) {
                    setBoards(data);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(parseApiError(err).message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const create = useCallback(
        async (event) => {
            event.preventDefault();

            const clean = title.trim();
            if (!clean || busy) {
                return;
            }

            setBusy(true);
            setError("");

            try {
                const board = await boardService.create({ title: clean });
                navigate(`/boards/${board.id}`);
            } catch (err) {
                setError(parseApiError(err).message);
                setBusy(false);
            }
        },
        [busy, navigate, title]
    );

    const remove = useCallback(async (board) => {
        if (!window.confirm(`Удалить доску «${board.title}»? Сцена тоже пропадёт.`)) {
            return;
        }

        try {
            await boardService.remove(board.id);
            setBoards((current) => current.filter((item) => item.id !== board.id));
            setError("");
        } catch (err) {
            setError(parseApiError(err).message);
        }
    }, []);

    return (
        <div className="page boardsPage">
            <div className="boardsHead">
                <div>
                    <h1 className="boardsTitle">Доски</h1>
                    <p className="mutedText">
                        Рисуем схемы и раскладываем мысли. Доску можно вставить в сет по названию.
                    </p>
                </div>
            </div>

            <form className="boardsCreate" onSubmit={create}>
                <input
                    className="input"
                    placeholder="Название новой доски"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    aria-label="Название новой доски"
                />
                <button type="submit" className="btn btnPrimary" disabled={busy || !title.trim()}>
                    Создать
                </button>
            </form>

            {error ? <p className="alertError boardsAlert">{error}</p> : null}

            {loading ? (
                <p className="mutedText">Загружаем доски…</p>
            ) : boards.length === 0 ? (
                <p className="mutedText boardsEmpty">
                    Досок пока нет. Создайте первую — и рисуйте схему прямо в браузере.
                </p>
            ) : (
                <ul className="boardsList">
                    {boards.map((board) => (
                        <li key={board.id} className="boardRow">
                            <Link className="boardRowMain" to={`/boards/${board.id}`}>
                                <span className="boardRowTitle">{board.title}</span>
                                <span className="boardRowMeta mutedText">
                                    изменена {formatDate(board.updated_at)}
                                    <span className="boardRowVisibility">
                                        {VISIBILITY_LABELS[board.visibility] ?? board.visibility}
                                    </span>
                                </span>
                            </Link>

                            <button
                                type="button"
                                className="btn btnGhost btnSmall"
                                onClick={() => remove(board)}
                            >
                                Удалить
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default BoardsList;
