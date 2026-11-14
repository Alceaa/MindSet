import React, { useEffect, useState } from "react";
import {
    THEME_PRESETS,
    THEME_ROLES,
    buildThemeVariables,
    contrastWarnings,
} from "../../themes/theme.roles";

const PREVIEW_SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Цвет роли: системная палитра плюс текстовое поле — в него удобно вставить hex из макета.
 * Пока в тексте не набрался полный цвет, роли не трогаем, иначе палитра получит мусор.
 */
const RoleColor = ({ role, value, onChange }) => {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    const onText = (event) => {
        const next = event.target.value;

        setDraft(next);

        if (HEX_PATTERN.test(next.trim())) {
            onChange(next.trim().toLowerCase());
        }
    };

    return (
        <span className="localThemeColorField">
            <input
                className="localThemeColor"
                type="color"
                value={HEX_PATTERN.test(value) ? value : "#000000"}
                onChange={(event) => onChange(event.target.value)}
                aria-label={`${role.label}: палитра`}
            />
            <input
                className="input localThemeColorHex"
                type="text"
                value={draft}
                onChange={onText}
                onBlur={() => setDraft(value)}
                maxLength={7}
                spellCheck={false}
                placeholder="#rrggbb"
                aria-label={`${role.label}: цвет в виде #rrggbb`}
            />
        </span>
    );
};

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
                        <RoleColor
                            role={role}
                            value={roles[role.key]}
                            onChange={(value) => onRole(role.key, value)}
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
