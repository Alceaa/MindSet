import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { THEME_PRESETS } from "../../themes/theme.roles";
import ThemesSettings from "./settings.themes.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: { remove: jest.fn() },
}));

const item = {
    id: 3,
    key: "morskaya-noch",
    title: "Морская ночь",
    description: "Синяя вода",
    mode: "dark",
    base: "nord",
    roles: THEME_PRESETS[1].roles,
};

const setup = (props = {}) => {
    const handlers = {
        onEdit: jest.fn(),
        onApplied: jest.fn(),
        onChanged: jest.fn(),
        onImport: jest.fn(),
    };

    render(
        <ThemesSettings
            themes={[item]}
            limit={10}
            loading={false}
            selectedId={0}
            {...handlers}
            {...props}
        />
    );

    return handlers;
};

beforeEach(() => {
    jest.clearAllMocks();
});

test("показывает свои темы и лимит", () => {
    setup();

    expect(screen.getByText("Морская ночь")).toBeTruthy();
    expect(screen.getByText(/Сохранено 1 из 10/)).toBeTruthy();
});

test("применяет тему и открывает её в конструкторе", () => {
    const handlers = setup();

    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    expect(handlers.onApplied).toHaveBeenCalledWith("custom:morskaya-noch");

    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    expect(handlers.onEdit).toHaveBeenCalledWith(3);
});

test("удаляет тему после подтверждения", async () => {
    const handlers = setup();
    themeService.remove.mockResolvedValue({ message: "Тема удалена" });

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(themeService.remove).toHaveBeenCalledWith(3));
    await waitFor(() => expect(handlers.onChanged).toHaveBeenCalled());
});

test("импорт понимает текст темы и объясняет мусор", () => {
    const handlers = setup();

    fireEvent.change(screen.getByLabelText("Текст темы"), { target: { value: "не json" } });
    fireEvent.click(screen.getByRole("button", { name: "Загрузить из текста" }));

    expect(screen.getByText(/не разобрали JSON/)).toBeTruthy();
    expect(handlers.onImport).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Текст темы"), {
        target: { value: JSON.stringify({ roles: { accent: "#5FC4D8" } }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Загрузить из текста" }));

    expect(handlers.onImport).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Импортированная тема" })
    );
});

test("пустая библиотека объясняет, что делать", () => {
    setup({ themes: [] });

    expect(screen.getByText(/Пока ни одной темы/)).toBeTruthy();
    expect(screen.getByText(/Сохранено 0 из 10/)).toBeTruthy();
});
