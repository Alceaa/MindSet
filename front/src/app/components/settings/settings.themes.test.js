import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { THEME_PRESETS } from "../../themes/theme.roles";
import ThemesSettings from "./settings.themes.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: {
        published: jest.fn(),
        own: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        submit: jest.fn(),
        withdraw: jest.fn(),
    },
}));

const draft = {
    id: 4,
    key: "northern-dusk",
    title: "Северные сумерки",
    description: "Холодный вечер",
    mode: "dark",
    base: "dark",
    variables: { "--bg-canvas": "#0f1420" },
    status: "draft",
    moderation_note: "",
    author: "verifyuser",
    updated_at: "2026-11-13T12:00:00Z",
};

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    themeService.published.mockResolvedValue({ themes: [] });
    themeService.own.mockResolvedValue({ themes: [draft], limit: 10 });
});

test("показывает свои темы со статусом и причиной отказа", async () => {
    themeService.own.mockResolvedValue({
        themes: [
            { ...draft, id: 5, status: "rejected", moderation_note: "Слишком тёмный фон" },
        ],
        limit: 10,
    });

    render(<ThemesSettings onApplied={() => {}} />);

    expect(await screen.findByText("Северные сумерки")).toBeTruthy();
    expect(screen.getByText("отклонена")).toBeTruthy();
    expect(screen.getByText(/Слишком тёмный фон/)).toBeTruthy();
    expect(screen.getByText(/Использовано 1 из 10/)).toBeTruthy();
});

test("собирает пакет из восьми ролей пресета", async () => {
    themeService.create.mockResolvedValue({
        message: "Черновик сохранён",
        theme: { ...draft, id: 9 },
    });

    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    await act(async () => {
        screen.getByRole("button", { name: "Создать тему" }).click();
    });

    fireEvent.change(screen.getByPlaceholderText("Северные сумерки"), {
        target: { value: "Морская ночь" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Море" }));

    await act(async () => {
        screen.getByRole("button", { name: "Создать черновик" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalledTimes(1));

    const payload = themeService.create.mock.calls[0][0];
    expect(payload.title).toBe("Морская ночь");
    expect(payload.mode).toBe(THEME_PRESETS[1].mode);
    expect(payload.base).toBe(THEME_PRESETS[1].base);
    // В пакет уезжают производные переменные, а не восемь ролей.
    expect(payload.variables["--bg-canvas"]).toBe(THEME_PRESETS[1].roles.canvas);
    expect(payload.variables["--accent"]).toBe(THEME_PRESETS[1].roles.accent);
    expect(Object.keys(payload.variables).length).toBe(52);
});

test("не отправляет тему без названия", async () => {
    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    await act(async () => {
        screen.getByRole("button", { name: "Создать тему" }).click();
    });

    expect(await screen.findByText("Название темы: минимум 3 символа")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Создать черновик" }).disabled).toBe(true);
    expect(themeService.create).not.toHaveBeenCalled();
});

test("опубликованную тему можно изменить и снять с публикации", async () => {
    themeService.own.mockResolvedValue({
        themes: [{ ...draft, id: 7, status: "approved", published_at: "2026-11-14T10:00:00Z" }],
        limit: 10,
    });
    themeService.withdraw.mockResolvedValue({ message: "Тема снята с публикации" });

    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    // Правку опубликованной темы открывает «Изменить»: она уйдёт на модерацию.
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeTruthy();

    await act(async () => {
        screen.getByRole("button", { name: "Снять с публикации" }).click();
    });

    await waitFor(() => expect(themeService.withdraw).toHaveBeenCalledWith(7));
});

test("отправляет черновик на модерацию и удаляет после подтверждения", async () => {
    themeService.submit.mockResolvedValue({ message: "Тема отправлена на модерацию" });
    themeService.remove.mockResolvedValue({ message: "Тема удалена" });

    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    await act(async () => {
        screen.getByRole("button", { name: "На модерацию" }).click();
    });
    await waitFor(() => expect(themeService.submit).toHaveBeenCalledWith(4));

    await act(async () => {
        screen.getByRole("button", { name: "Удалить" }).click();
    });
    await act(async () => {
        screen.getByRole("button", { name: "Удалить" }).click();
    });

    await waitFor(() => expect(themeService.remove).toHaveBeenCalledWith(4));
});
