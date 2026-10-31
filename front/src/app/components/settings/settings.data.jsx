import React, { useState } from "react";
import userService from "../../api/user.service";
import parseApiError from "../../utils/api.error";

const DataSettingsPanel = () => {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);

    const handleExport = async () => {
        setBusy(true);
        setNotice(null);
        try {
            const blob = await userService.exportData();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `mindset-export-${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            setNotice({ kind: "success", text: "Архив скачан: заметки в .md и метаданные в sets.json." });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="settingsPanel">
            <header className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Данные</h2>
                <p className="mutedText">Выгрузка своих сетов и печать статей.</p>
            </header>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            <div className="card settingsForm">
                <h3 className="settingsSectionLabel">Выгрузка</h3>
                <div className="settingsRow">
                    <div className="settingsRowMain">
                        <span className="settingsRowTitle">Все сеты одним архивом</span>
                        <span className="mutedText">
                            Внутри .zip: по одному файлу .md на заметку, метаданные в sets.json
                            и снимки сохранённых сетов. Годится и для переезда в другой редактор,
                            и как собственный бэкап.
                        </span>
                    </div>
                    <button
                        className="btn btnPrimary"
                        type="button"
                        disabled={busy}
                        onClick={handleExport}
                    >
                        {busy ? "Собираем архив…" : "Скачать все данные"}
                    </button>
                </div>

                <div className="settingsRow">
                    <div className="settingsRowMain">
                        <span className="settingsRowTitle">Печать статьи</span>
                        <span className="mutedText">
                            В панели над статьёй есть кнопка «Печать»: открывается версия для
                            печати, из неё сохраняется PDF.
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DataSettingsPanel;
