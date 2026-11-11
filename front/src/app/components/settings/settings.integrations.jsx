import React, { useCallback, useEffect, useState } from "react";
import tokenService from "../../api/token.service";
import parseApiError from "../../utils/api.error";
import { Skeleton } from "../common/skeleton.jsx";
import { useToast } from "../common/toast.jsx";

const EXPIRY_OPTIONS = [
    { value: 30, label: "30 дней" },
    { value: 90, label: "90 дней" },
    { value: 365, label: "Год" },
    { value: 0, label: "Без срока" },
];

const formatStamp = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const IntegrationsSettingsPanel = () => {
    const { push } = useToast();

    const [tokens, setTokens] = useState([]);
    const [limit, setLimit] = useState(20);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [title, setTitle] = useState("");
    const [days, setDays] = useState(90);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState(false);
    const [confirming, setConfirming] = useState(0);
    const [revoking, setRevoking] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await tokenService.list();
            setTokens(data.tokens ?? []);
            setLimit(data.limit ?? 20);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (event) => {
        event.preventDefault();
        setCreating(true);
        setError("");
        setCopied(false);

        try {
            const data = await tokenService.create({
                title: title.trim(),
                expires_in_days: Number(days),
            });

            setCreated({
                value: data.value,
                prefix: data.token?.prefix ?? "",
                expiresAt: data.token?.expires_at ?? "",
            });
            setTokens((current) => [data.token, ...current].filter(Boolean));
            setTitle("");
            push("Токен создан", "success");
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(created?.value ?? "");
            setCopied(true);
        } catch {
            push("Не удалось скопировать — выделите значение вручную", "error");
        }
    };

    const handleRevoke = async (token) => {
        setRevoking(token.id);
        try {
            await tokenService.revoke(token.id);
            setTokens((current) => current.filter((item) => item.id !== token.id));
            push(`Токен «${token.title}» отозван`, "success");
        } catch (err) {
            push(parseApiError(err).message, "error");
        } finally {
            setRevoking(0);
            setConfirming(0);
        }
    };

    const atLimit = tokens.length >= limit;
    const apiBase = process.env.REACT_APP_BASE_API_URL || "";

    return (
        <section className="settingsPanel">
            <header className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Интеграции</h2>
                <p className="mutedText">
                    Токены для внешних инструментов: скриптов, выгрузок и своих приложений.
                    По токену доступно только чтение — изменить данные через него нельзя.
                </p>
            </header>

            {error && (
                <div className="alert alertError" role="status">
                    {error}
                </div>
            )}

            {created && (
                <div className="card settingsForm">
                    <h3 className="settingsSectionLabel">Новый токен</h3>
                    <p className="mutedText">
                        Скопируйте значение сейчас: второй раз оно не показывается.
                    </p>
                    <div className="tokenValueRow">
                        <code className="tokenValue">{created.value}</code>
                        <button
                            className="btn btnPrimary btnSmall"
                            type="button"
                            onClick={handleCopy}
                        >
                            {copied ? "Скопировано" : "Скопировать"}
                        </button>
                    </div>
                    <p className="fieldHint">
                        Подставляется как <code>Authorization: Bearer {created.prefix}…</code>.
                        {created.expiresAt
                            ? ` Действует до ${formatStamp(created.expiresAt)}.`
                            : " Срок не ограничен."}
                    </p>
                    <div className="settingsActions">
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => setCreated(null)}
                        >
                            Готово
                        </button>
                    </div>
                </div>
            )}

            <form className="card settingsForm" onSubmit={handleCreate}>
                <h3 className="settingsSectionLabel">Создать токен</h3>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Название</span>
                    <input
                        className="input"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={60}
                        placeholder="Например, «Скрипт выгрузки»"
                        required
                    />
                    <span className="fieldHint">
                        Название видно только вам: по нему понятно, где используется токен.
                    </span>
                </label>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Срок действия</span>
                    <select
                        className="input"
                        value={days}
                        onChange={(event) => setDays(event.target.value)}
                    >
                        {EXPIRY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="settingsActions">
                    <button className="btn btnPrimary" type="submit" disabled={creating || atLimit}>
                        {creating ? "Создаём…" : "Создать токен"}
                    </button>
                    <span className="mutedText">
                        Использовано {tokens.length} из {limit}.
                        {atLimit ? " Отзовите ненужные, чтобы создать новый." : ""}
                    </span>
                </div>
            </form>

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Активные токены</h3>

                {loading ? (
                    <Skeleton variant="row" count={2} label="Загружаем токены…" />
                ) : tokens.length === 0 ? (
                    <p className="mutedText">
                        Токенов пока нет. Создайте первый — он пригодится для скриптов и выгрузок.
                    </p>
                ) : (
                    <ul className="tokenList">
                        {tokens.map((token) => (
                            <li className="tokenRow" key={token.id}>
                                <div className="tokenRowMain">
                                    <span className="tokenTitle">
                                        {token.title}
                                        {token.expired && <span className="tokenBadge">Истёк</span>}
                                    </span>
                                    <span className="tokenMeta">
                                        <code>{token.prefix}…</code> · создан{" "}
                                        {formatStamp(token.created_at)} ·{" "}
                                        {token.last_used_at
                                            ? `использован ${formatStamp(token.last_used_at)}`
                                            : "ещё не использовался"}
                                        {token.expires_at
                                            ? ` · до ${formatStamp(token.expires_at)}`
                                            : ""}
                                    </span>
                                </div>

                                {confirming === token.id ? (
                                    <div className="tokenRowActions">
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            disabled={revoking === token.id}
                                            onClick={() => handleRevoke(token)}
                                        >
                                            {revoking === token.id ? "Отзываем…" : "Отозвать"}
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => setConfirming(0)}
                                        >
                                            Отмена
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        onClick={() => setConfirming(token.id)}
                                    >
                                        Отозвать
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Как пользоваться</h3>
                <p className="mutedText">
                    Токен идёт в заголовке <code>Authorization: Bearer msk_…</code>. Все эндпоинты
                    с примерами описаны в файле <code>API.md</code> репозитория.
                </p>
                <pre className="tokenSample">
                    {`curl -H "Authorization: Bearer <токен>" \\\n  ${apiBase}/v1/sets?limit=10`}
                </pre>
                <p className="fieldHint">
                    Доступно чтение: профиль, сеты, коллекции и граф связей. Записи по токену нет —
                    для правок нужен вход в приложение.
                </p>
            </div>
        </section>
    );
};

export default IntegrationsSettingsPanel;
