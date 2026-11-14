import React from "react";
import {
    THEME_PRESETS,
    THEME_ROLES,
    buildThemeVariables,
    contrastWarnings,
} from "../../themes/theme.roles";

const PREVIEW_SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

/**
 * Восемь ролей темы: пресеты, предпросмотр, цветовые поля и предупреждения о контрасте.
 * Один и тот же блок для своей темы в профиле и для темы, которую отправляют в каталог.
 */
const ThemeRolesFields = ({ roles, base, onRole, onPreset }) => {
    const preview = buildThemeVariables(roles, base);
    const warnings = contrastWarnings(roles);

    return (
        <>
            <div className="themePresets">
                {THEME_PRESETS.map((preset) => (
                    <button
                        key={preset.key}
                        type="button"
                        className="btn btnGhost btnSmall"
                        onClick={() => onPreset(preset)}
                    >
                        {preset.title}
                    </button>
                ))}
            </div>

            <div className="localThemePreview" aria-hidden="true">
                {PREVIEW_SWATCHES.map((name) => (
                    <span
                        key={name}
                        className="localThemeSwatch"
                        style={{ backgroundColor: preview[name] }}
                    />
                ))}
            </div>

            <div className="localThemeRoles">
                {THEME_ROLES.map((role) => (
                    <label className="localThemeRole" key={role.key}>
                        <span className="localThemeRoleText">
                            <span className="settingsFieldLabel">{role.label}</span>
                            <span className="settingsFieldHint">{role.hint}</span>
                        </span>
                        <input
                            className="localThemeColor"
                            type="color"
                            value={roles[role.key]}
                            onChange={(event) => onRole(role.key, event.target.value)}
                            aria-label={`${role.label}: цвет`}
                        />
                    </label>
                ))}
            </div>

            {warnings.length > 0 && (
                <div className="localThemeWarnings" role="status">
                    <span className="settingsFieldLabel">Проверьте читаемость</span>
                    <ul>
                        {warnings.map((item) => (
                            <li key={item.label}>{item.text}</li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
};

export default ThemeRolesFields;
