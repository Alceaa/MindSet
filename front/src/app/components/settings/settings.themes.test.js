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

test("создаёт черновик с выбранными переменными", async () => {
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
        target: { value: "Ледяная ночь" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Фон страницы" }));
    fireEvent.change(screen.getByLabelText("Фон страницы: цвет"), {
        target: { value: "#101828" },
    });

    await act(async () => {
        screen.getByRole("button", { name: "Создать черновик" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalled());
    // Ключ не отправляем: сервер соберёт его из названия.
    expect(themeService.create).toHaveBeenCalledWith({
        title: "Ледяная ночь",
        description: "",
        mode: "dark",
        base: "dark",
        variables: { "--bg-canvas": "#101828" },
    });
});

test("не отправляет тему без переменных", async () => {
    render(<ThemesSettings onApplied={() => {}} />);
    await screen.findByText("Северные сумерки");

    await act(async () => {
        screen.getByRole("button", { name: "Создать тему" }).click();
    });

    fireEvent.change(screen.getByPlaceholderText("Северные сумерки"), {
        target: { value: "Проверка" },
    });

    expect(await screen.findByText(/Отметьте хотя бы одну переменную/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Создать черновик" }).disabled).toBe(true);
    expect(themeService.create).not.toHaveBeenCalled();
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
