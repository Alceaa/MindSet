import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { THEME_PRESETS } from "../../themes/theme.roles";
import LocalThemeSettings from "./settings.local.theme.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: {
        published: jest.fn(),
        profileTheme: jest.fn(),
        saveProfileTheme: jest.fn(),
        clearProfileTheme: jest.fn(),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    themeService.published.mockResolvedValue({ themes: [] });
    themeService.profileTheme.mockResolvedValue({ theme: null });
    themeService.saveProfileTheme.mockResolvedValue({ message: "Тема сохранена" });
    themeService.clearProfileTheme.mockResolvedValue({ message: "Своя тема удалена" });
});

test("показывает восемь ролей с понятными подписями", async () => {
    render(<LocalThemeSettings />);

    expect(await screen.findByText("Фон страницы")).toBeTruthy();
    ["Карточки и панели", "Основной текст", "Границы", "Главный цвет", "Опасное действие"].forEach(
        (label) => {
            expect(screen.getByText(label)).toBeTruthy();
        }
    );
    expect(screen.getAllByLabelText(/: цвет/)).toHaveLength(8);
});

test("пресет подставляет цвета и сохраняет тему в профиль", async () => {
    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    fireEvent.click(screen.getByRole("button", { name: "Море" }));
    fireEvent.change(screen.getByPlaceholderText("Моя тема"), { target: { value: "Морская" } });

    await act(async () => {
        screen.getByRole("button", { name: /^(Сохранить|Применить и сохранить)$/ }).click();
    });

    await waitFor(() => expect(themeService.saveProfileTheme).toHaveBeenCalledTimes(1));

    const payload = themeService.saveProfileTheme.mock.calls[0][0];
    expect(payload.title).toBe("Морская");
    expect(payload.roles.canvas).toBe(THEME_PRESETS[1].roles.canvas);
    expect(Object.keys(payload.roles)).toHaveLength(8);
});

test("предупреждает о нечитаемой теме, но не мешает сохранить", async () => {
    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    fireEvent.change(screen.getByLabelText("Фон страницы: цвет"), {
        target: { value: "#000000" },
    });
    fireEvent.change(screen.getByLabelText("Основной текст: цвет"), {
        target: { value: "#000000" },
    });

    expect(await screen.findByText("Проверьте читаемость")).toBeTruthy();
    expect(
        screen.getByRole("button", { name: /^(Сохранить|Применить и сохранить)$/ }).disabled
    ).toBe(false);
});

test("сброс удаляет свою тему", async () => {
    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    await act(async () => {
        screen.getByRole("button", { name: "Сбросить" }).click();
    });

    await waitFor(() => expect(themeService.clearProfileTheme).toHaveBeenCalledTimes(1));
});
