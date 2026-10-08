import React, { useState } from "react";
import reportService from "../../api/report.service";
import parseApiError from "../../utils/api.error";
import "../../css/settings/settings.scss";

const BugReportPanel = () => {
    const [topic, setTopic] = useState("");
    const [message, setMessage] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);

        try {
            await reportService.send({
                topic: topic,
                message: message,
                page: window.location.pathname + window.location.search,
            });
            setSent(true);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setPending(false);
        }
    };

    const reset = () => {
        setTopic("");
        setMessage("");
        setError("");
        setSent(false);
    };

    if (sent) {
        return (
            <section className="settingsPanel">
                <header className="settingsPanelHead">
                    <h2 className="settingsPanelTitle">Сообщить о проблеме</h2>
                </header>
                <div className="card settingsThanks">
                    <span className="settingsThanksIcon" aria-hidden="true">
                        🙌
                    </span>
                    <h3 className="settingsSectionLabel">Спасибо!</h3>
                    <p className="mutedText">
                        Сообщение отправлено. Мы получили ваш отчёт о проблеме.
                    </p>
                    <button className="btn btnGhost" type="button" onClick={reset}>
                        Отправить ещё одно
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="settingsPanel">
            <header className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Сообщить о проблеме</h2>
                <p className="mutedText">
                    Опишите баг: тема, детали и, при необходимости, скриншот.
                </p>
            </header>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <form className="card settingsForm" onSubmit={handleSubmit}>
                <label className="settingsField">
                    <span className="settingsFieldLabel">Тема</span>
                    <input
                        className="input"
                        type="text"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        placeholder="Например: не сохраняется биография"
                        maxLength={120}
                        required
                    />
                </label>

                <label className="settingsField">
                    <span className="settingsFieldLabel">Сообщение</span>
                    <textarea
                        className="input textarea"
                        rows={6}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Что произошло, что ожидали, шаги воспроизведения…"
                        maxLength={2000}
                        required
                    />
                </label>

                <div className="settingsActions">
                    <button className="btn btnPrimary" type="submit" disabled={pending}>
                        {pending ? "Отправляем…" : "Отправить"}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default BugReportPanel;
