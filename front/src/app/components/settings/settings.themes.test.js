import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
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

test("применяет опубликованную тему из списка", async () => {
    themeService.own.mockResolvedValue({
        themes: [{ ...draft, id: 7, status: "approved", published_at: "2026-11-14T10:00:00Z" }],
        limit: 10,
    });
    const onApplied = jest.fn();

    render(<ThemesSettings onApplied={onApplied} />);
    await screen.findByText("Северные сумерки");

    fireEvent.click(screen.getByRole("button", { name: "Применить" }));

    expect(onApplied).toHaveBeenCalledWith("custom:northern-dusk");
});

test("опубликованную тему можно открыть в конструкторе", async () => {
    themeService.own.mockResolvedValue({
        themes: [{ ...draft, id: 7, status: "approved" }],
        limit: 10,
    });
    const onEdit = jest.fn();

    render(<ThemesSettings onApplied={() => {}} onEdit={onEdit} />);
    await screen.findByText("Северные сумерки");

    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));

    expect(onEdit).toHaveBeenCalledWith("custom:northern-dusk");
});

test("снимает опубликованную тему с публикации и отмечает правку на модерации", async () => {
    themeService.own.mockResolvedValue({
        themes: [
            { ...draft, id: 7, status: "approved" },
            { ...draft, id: 8, title: "Полярный день", status: "approved", pending: true },
        ],
        limit: 10,
    });
    themeService.withdraw.mockResolvedValue({ message: "Тема снята с публикации" });

    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    expect(screen.getByText("правка на модерации")).toBeTruthy();

    await act(async () => {
        screen.getByRole("button", { name: "Снять с публикации" }).click();
    });

    await waitFor(() => expect(themeService.withdraw).toHaveBeenCalledWith(7));
    // Пока правка на модерации, снимать тему нельзя: черновик уже ждёт проверки.
    expect(screen.getAllByRole("button", { name: "Ждёт модерации" })[0].disabled).toBe(true);
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
