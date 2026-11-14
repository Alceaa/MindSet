import React, { useRef, useState } from "react";
import reportService from "../../api/report.service";
import uploadImage from "../../utils/image.upload";
import parseApiError from "../../utils/api.error";
import "../../css/settings/settings.scss";

// Столько же, сколько принимает сервер (models.BugReportMaxAttachments).
const MAX_ATTACHMENTS = 3;

const BugReportPanel = () => {
    const [topic, setTopic] = useState("");
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const fileInput = useRef(null);

    const handleFiles = async (event) => {
        const files = [...(event.target.files ?? [])];
        // Значение сбрасываем сразу: иначе повторный выбор того же файла не сработает.
        event.target.value = "";

        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) {
            return;
        }

        setError("");
        setUploading(true);

        try {
            const uploaded = [];
            for (const file of images.slice(0, MAX_ATTACHMENTS - attachments.length)) {
                uploaded.push(await uploadImage(file));
            }

            setAttachments((current) => [...current, ...uploaded]);
            if (images.length > uploaded.length) {
                setError(`К отчёту можно приложить не больше ${MAX_ATTACHMENTS} изображений.`);
            }
        } catch (err) {
            setError(parseApiError(err).message || "Не удалось загрузить изображение");
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (url) => {
        setAttachments((current) => current.filter((item) => item !== url));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);

        try {
            await reportService.send({
                topic: topic,
                message: message,
                page: window.location.pathname + window.location.search,
                attachments: attachments,
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
        setAttachments([]);
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

                <div className="settingsField">
                    <span className="settingsFieldLabel">
                        Скриншоты (до {MAX_ATTACHMENTS})
                    </span>
                    <input
                        ref={fileInput}
                        className="settingsFileInput"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFiles}
                        aria-label="Прикрепить изображения к отчёту"
                    />
                    <div className="settingsAttachments">
                        <button
                            className="btn btnGhost"
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            disabled={uploading || pending || attachments.length >= MAX_ATTACHMENTS}
                        >
                            {uploading ? "Загружаем…" : "Прикрепить изображение"}
                        </button>
                        {attachments.map((url) => (
                            <span className="settingsAttachment" key={url}>
                                <img className="settingsAttachmentThumb" src={url} alt="" />
                                <button
                                    className="settingsAttachmentRemove"
                                    type="button"
                                    onClick={() => removeAttachment(url)}
                                    title="Убрать изображение"
                                    aria-label="Убрать изображение"
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                    <span className="settingsFieldHint">
                        Изображение попадает в отчёт ссылкой: её видно в уведомлении и в админке.
                    </span>
                </div>

                <div className="settingsActions">
                    <button
                        className="btn btnPrimary"
                        type="submit"
                        disabled={pending || uploading}
                    >
                        {pending ? "Отправляем…" : "Отправить"}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default BugReportPanel;
