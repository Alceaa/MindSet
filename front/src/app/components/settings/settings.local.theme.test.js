import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { THEME_PRESETS } from "../../themes/theme.roles";
import LocalThemeSettings from "./settings.local.theme.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: {
        published: jest.fn(),
        own: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        submit: jest.fn(),
        profileTheme: jest.fn(),
        saveProfileTheme: jest.fn(),
        clearProfileTheme: jest.fn(),
    },
}));

const published = {
    id: 7,
    key: "morskaya",
    title: "Морская",
    description: "Синяя вода",
    mode: "dark",
    base: "dark",
    status: "approved",
};

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    themeService.published.mockResolvedValue({ themes: [] });
    themeService.profileTheme.mockResolvedValue({ theme: null });
    themeService.saveProfileTheme.mockResolvedValue({ message: "Тема сохранена" });
    themeService.clearProfileTheme.mockResolvedValue({ message: "Своя тема удалена" });
    themeService.own.mockResolvedValue({ themes: [], limit: 10 });
    themeService.create.mockResolvedValue({ message: "Черновик сохранён", theme: published });
    themeService.update.mockResolvedValue({ message: "Правка сохранена" });
    themeService.submit.mockResolvedValue({ message: "Тема отправлена на модерацию" });
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

    fireEvent.change(screen.getByLabelText(/^Фон страницы: цвет/), {
        target: { value: "#000000" },
    });
    fireEvent.change(screen.getByLabelText(/^Основной текст: цвет/), {
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

test("цвет можно вписать текстом", async () => {
    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    fireEvent.change(screen.getByLabelText(/^Главный цвет: цвет/), {
        target: { value: "#ff00ff" },
    });

    await act(async () => {
        screen.getByRole("button", { name: /^(Сохранить|Применить и сохранить)$/ }).click();
    });

    await waitFor(() => expect(themeService.saveProfileTheme).toHaveBeenCalledTimes(1));
    expect(themeService.saveProfileTheme.mock.calls[0][0].roles.accent).toBe("#ff00ff");
});

test("отправляет свою тему на модерацию", async () => {
    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    fireEvent.click(screen.getByRole("button", { name: "Море" }));
    fireEvent.change(screen.getByPlaceholderText("Моя тема"), { target: { value: "Морская" } });

    await act(async () => {
        screen.getByRole("button", { name: "Отправить на модерацию" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalledTimes(1));

    const payload = themeService.create.mock.calls[0][0];
    expect(payload.title).toBe("Морская");
    expect(payload.mode).toBe(THEME_PRESETS[1].mode);
    expect(payload.base).toBe(THEME_PRESETS[1].base);
    // В пакет уезжает белый список переменных, а не восемь ролей.
    expect(payload.variables["--accent"]).toBe(THEME_PRESETS[1].roles.accent);
    expect(Object.keys(payload.variables)).toHaveLength(52);

    // Своя тема сначала сохраняется в профиль, потом уходит на проверку.
    expect(themeService.saveProfileTheme).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(themeService.submit).toHaveBeenCalledWith(published.id));
});

test("правку своей опубликованной темы отправляет на модерацию обновлением", async () => {
    themeService.own.mockResolvedValue({
        themes: [{ id: 7, key: "morskaya", title: "Морская", status: "approved" }],
        limit: 10,
    });

    render(<LocalThemeSettings />);
    await screen.findByText("Фон страницы");

    fireEvent.change(screen.getByPlaceholderText("Моя тема"), { target: { value: "Морская" } });

    await act(async () => {
        screen.getByRole("button", { name: "Отправить на модерацию" }).click();
    });

    await waitFor(() =>
        expect(themeService.update).toHaveBeenCalledWith(
            7,
            expect.objectContaining({ title: "Морская" })
        )
    );
    // Опубликованная тема живёт версиями: обновление и есть отправка на модерацию.
    expect(themeService.create).not.toHaveBeenCalled();
    expect(themeService.submit).not.toHaveBeenCalled();
});
