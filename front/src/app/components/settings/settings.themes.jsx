import React, { useCallback, useEffect, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import { Skeleton } from "../common/skeleton.jsx";
import { APP_THEMES } from "../../themes/app.themes";
import { CUSTOM_THEME_PREFIX } from "../../themes/theme.packages";

const STATUS_LABELS = {
    draft: "черновик",
    pending: "на модерации",
    approved: "опубликована",
    rejected: "отклонена",
};

const STATUS_CLASSES = {
    draft: "tokenBadge",
    pending: "tokenBadge tokenBadgePending",
    approved: "tokenBadge tokenBadgeApproved",
    rejected: "tokenBadge tokenBadgeRejected",
};

const baseThemeOf = (key) => APP_THEMES.find((item) => item.key === key) ?? APP_THEMES[0];

/**
 * Свои темы в каталоге. Конструктор тут не нужен: он один — блок «Своя тема» выше.
 * Здесь только состояние тем и действия над ними: применить, снять с публикации, удалить.
 */
const ThemesSettings = ({ onApplied }) => {
    const [themes, setThemes] = useState([]);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(0);

    const load = useCallback(async () => {
        try {
            const data = await themeService.own();
            setThemes(data?.themes ?? []);
            setLimit(data?.limit ?? 10);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const run = async (action, fallback) => {
        setNotice(null);
        setBusy(true);

        try {
            const data = await action();
            setNotice({ kind: "success", text: data?.message || fallback });
            setConfirming(0);
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card settingsForm">
            <h3 className="settingsSectionLabel">Мои темы в каталоге</h3>
            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            {loading ? (
                <Skeleton variant="row" count={2} label="Загружаем свои темы…" />
            ) : themes.length === 0 ? (
                <p className="mutedText">Своих тем в каталоге пока нет.</p>
            ) : (
                <ul className="tokenList">
                    {themes.map((item) => (
                        <li className="tokenRow" key={item.id}>
                            <div className="tokenRowMain">
                                <span className="tokenTitle">
                                    {item.title}
                                    <span className={STATUS_CLASSES[item.status] ?? "tokenBadge"}>
                                        {STATUS_LABELS[item.status] ?? item.status}
                                    </span>
                                    {item.pending && (
                                        <span className="tokenBadge">правка на модерации</span>
                                    )}
                                </span>
                                <span className="tokenMeta">
                                    <code>{item.key}</code> · база: {baseThemeOf(item.base).label} ·{" "}
                                    {item.mode === "light" ? "светлый режим" : "тёмный режим"}
                                </span>
                                {item.moderation_note && (
                                    <span className="themeNote">
                                        {item.status === "rejected"
                                            ? "Причина отказа: "
                                            : "Замечание модератора: "}
                                        {item.moderation_note}
                                    </span>
                                )}
                            </div>
                            <div className="tokenRowActions">
                                {item.status === "approved" && (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        onClick={() =>
                                            onApplied(`${CUSTOM_THEME_PREFIX}${item.key}`)
                                        }
                                    >
                                        Применить
                                    </button>
                                )}

                                {(item.status === "draft" || item.status === "rejected") && (
                                    <button
                                        className="btn btnPrimary btnSmall"
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            run(
                                                () => themeService.submit(item.id),
                                                "Тема отправлена на модерацию"
                                            )
                                        }
                                    >
                                        На модерацию
                                    </button>
                                )}

                                {item.status === "approved" && (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        disabled={busy || Boolean(item.pending)}
                                        title="Тема исчезнет из каталога, править её можно сразу"
                                        onClick={() =>
                                            run(
                                                () => themeService.withdraw(item.id),
                                                "Тема снята с публикации"
                                            )
                                        }
                                    >
                                        {item.pending ? "Ждёт модерации" : "Снять с публикации"}
                                    </button>
                                )}

                                {confirming === item.id ? (
                                    <>
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                run(
                                                    () => themeService.remove(item.id),
                                                    "Тема удалена"
                                                )
                                            }
                                        >
                                            Удалить
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => setConfirming(0)}
                                        >
                                            Отмена
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        onClick={() => setConfirming(item.id)}
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <span className="mutedText">
                Использовано {themes.length} из {limit}.
            </span>
        </div>
    );
};

export default ThemesSettings;
