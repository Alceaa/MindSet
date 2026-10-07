import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import userService from "../../api/user.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import LoadingScreen from "../common/loading.screen.jsx";
import SetCard from "../common/set.card.jsx";
import SetArticle from "../dashboard/sets/set.article.jsx";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/profile.scss";
import "../../css/dashboard/feed.scss";

const PAGE_SIZE = 12;

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const UserProfile = () => {
    const { login } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const [profile, setProfile] = useState(null);
    const [bioLinks, setBioLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);

    const [sort, setSort] = useState("popular");
    const [sets, setSets] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [setsLoading, setSetsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");
        setProfile(null);

        userService
            .getProfile(login)
            .then((data) => {
                if (!cancelled) {
                    setProfile(data.profile);
                    setBioLinks(data.bio_links ?? []);
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
    }, [login]);

    const loadSets = useCallback(
        (currentSort, offset) =>
            userService.getProfileSets(login, { sort: currentSort, limit: PAGE_SIZE, offset }),
        [login]
    );

    useEffect(() => {
        let cancelled = false;
        setSetsLoading(true);
        setSets([]);

        loadSets(sort, 0)
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setSets(data.sets ?? []);
                setTotal(data.total ?? 0);
                setHasMore(Boolean(data.has_more));
            })
            .catch((err) => {
                if (!cancelled) {
                    setNotice({ kind: "error", text: parseApiError(err).message });
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setSetsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [loadSets, sort]);

    const handleLoadMore = async () => {
        setSetsLoading(true);
        try {
            const data = await loadSets(sort, sets.length);
            setSets((current) => [...current, ...(data.sets ?? [])]);
            setTotal(data.total ?? 0);
            setHasMore(Boolean(data.has_more));
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSetsLoading(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            const data = profile.is_following
                ? await userService.unfollow(profile.id)
                : await userService.follow(profile.id);
            setProfile((current) => ({
                ...current,
                is_following: data.is_following,
                followers_count: data.followers_count,
            }));
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <LoadingScreen label="Загружаем профиль..." />;
    }

    if (error || !profile) {
        return (
            <div className="publicPage">
                <div className="publicMessage">
                    <h1 className="publicMessageTitle">Профиль недоступен</h1>
                    <p className="mutedText">{error || "Возможно, пользователь больше не существует."}</p>
                    <Link className="btn btnGhost" to="/explore">
                        В обзор
                    </Link>
                </div>
            </div>
        );
    }

    const selfMatch =
        Boolean(user?.login) && user.login.toLowerCase() === profile.login.toLowerCase();
    const isSelf = profile.is_self || selfMatch;
    const avatarSrc = (isSelf && user ? user.avatar : profile.avatar) || undefined;

    return (
        <section className="profilePage">
            <div className="profileLayout">
                <aside className="profileSide">
                    <Avatar src={avatarSrc} sx={{ width: 128, height: 128, fontSize: 48 }}>
                        {initialOf(profile.login)}
                    </Avatar>
                    <h1 className="profileLogin">{profile.login}</h1>

                    <ul className="profileMetaList">
                        <li className="profileMetaItem">
                            <span className="profileMetaLabel">Публичных сетов</span>
                            <span className="profileMetaValue">{profile.public_set_count}</span>
                        </li>
                        <li className="profileMetaItem">
                            <span className="profileMetaLabel">Подписчики</span>
                            <span className="profileMetaValue">{profile.followers_count}</span>
                        </li>
                        <li className="profileMetaItem">
                            <span className="profileMetaLabel">Подписки</span>
                            <span className="profileMetaValue">{profile.following_count}</span>
                        </li>
                        <li className="profileMetaItem">
                            <span className="profileMetaLabel">С нами с</span>
                            <span className="profileMetaValue">{profile.date_joined || "—"}</span>
                        </li>
                    </ul>

                    <div className="profileActions">
                        {isSelf ? (
                            <Link className="btn btnGhost btnSmall" to="/settings">
                                Настроить профиль
                            </Link>
                        ) : (
                            <button
                                className={`btn ${
                                    profile.is_following ? "btnGhost" : "btnPrimary"
                                } btnSmall`}
                                type="button"
                                disabled={busy}
                                onClick={handleFollowToggle}
                            >
                                {profile.is_following ? "Отписаться" : "Подписаться"}
                            </button>
                        )}
                    </div>
                </aside>

                <div className="profileMain">
                    {notice && (
                        <div
                            className={`alert${notice.kind === "error" ? " alertError" : ""}`}
                            role="status"
                        >
                            {notice.text}
                        </div>
                    )}

                    <section className="profileBioCard">
                        <h2 className="profileSectionLabel">О себе</h2>
                        {profile.bio ? (
                            <div className="profileBioMarkdown">
                                <SetArticle content={profile.bio} links={bioLinks} />
                            </div>
                        ) : (
                            <p className="mutedText">Биография пока не заполнена.</p>
                        )}
                        {profile.private_set_count > 0 && (
                            <p className="profileMetaHint">
                                Также ведёт {profile.private_set_count} сет(ов) с ограниченным
                                доступом — их содержимое скрыто.
                            </p>
                        )}
                    </section>

                    <section className="profileSetsSection">
                        <div className="profileTabs">
                            <button
                                type="button"
                                className={`profileTab${sort === "popular" ? " profileTabActive" : ""}`}
                                onClick={() => setSort("popular")}
                            >
                                Популярные
                            </button>
                            <button
                                type="button"
                                className={`profileTab${sort === "recent" ? " profileTabActive" : ""}`}
                                onClick={() => setSort("recent")}
                            >
                                Новые
                            </button>
                        </div>

                        {setsLoading && sets.length === 0 ? (
                            <LoadingScreen label="Загружаем сеты..." />
                        ) : sets.length === 0 ? (
                            <div className="profileEmpty">
                                {profile.public_set_count > 0
                                    ? "Публичные сеты скрыты."
                                    : "У автора пока нет публичных сетов."}
                            </div>
                        ) : (
                            <>
                                <p className="listMeta mutedText">
                                    Показано {sets.length} из {total}
                                </p>
                                <div className="setGrid">
                                    {sets.map((set) => (
                                        <SetCard
                                            key={set.id}
                                            set={set}
                                            to={`/s/${set.slug}`}
                                            showAuthor={false}
                                            own={isSelf}
                                        />
                                    ))}
                                </div>
                                {hasMore && (
                                    <div className="exploreMore">
                                        <button
                                            className="btn btnGhost"
                                            type="button"
                                            onClick={handleLoadMore}
                                            disabled={setsLoading}
                                        >
                                            {setsLoading ? "Загружаем..." : "Показать ещё"}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            </div>
        </section>
    );
};

export default UserProfile;

