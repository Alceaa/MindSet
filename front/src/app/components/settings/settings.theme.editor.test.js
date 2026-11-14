import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { themeByKey } from "../../themes/app.themes";
import { THEME_PRESETS } from "../../themes/theme.roles";
import ThemeEditor from "./settings.theme.editor.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: { create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));

const item = {
    id: 7,
    key: "morskaya-noch",
    title: "Морская ночь",
    description: "Синяя вода",
    mode: "dark",
    base: "nord",
    roles: THEME_PRESETS[1].roles,
};

const setup = (props = {}) => {
    const handlers = { onSaved: jest.fn(), onDeleted: jest.fn() };

    render(
        <ThemeEditor
            item={null}
            draft={null}
            count={0}
            limit={10}
            {...handlers}
            {...props}
        />
    );

    return handlers;
};

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
});

test("новая тема: восемь ролей и сохранение в библиотеку", async () => {
    const handlers = setup();
    themeService.create.mockResolvedValue({ message: "Тема сохранена", theme: item });

    expect(screen.getAllByLabelText(/: палитра/)).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Сохранить в библиотеку" }).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Морская ночь"), {
        target: { value: "Морская ночь" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Море" }));

    await act(async () => {
        screen.getByRole("button", { name: "Сохранить в библиотеку" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalledTimes(1));

    const payload = themeService.create.mock.calls[0][0];
    expect(payload.title).toBe("Морская ночь");
    expect(payload.roles.accent).toBe(THEME_PRESETS[1].roles.accent);
    expect(payload.roles.canvas).toBe(THEME_PRESETS[1].roles.canvas);
    expect(handlers.onSaved).toHaveBeenCalledWith(item);
});

test("правка сохранённой темы: форма заполняется и обновляет её", async () => {
    setup({ item, count: 1 });
    themeService.update.mockResolvedValue({ message: "Тема обновлена", theme: item });

    expect(screen.getByDisplayValue("Морская ночь")).toBeTruthy();
    expect(screen.getByDisplayValue("Синяя вода")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Главный цвет: цвет/), {
        target: { value: "#ff00ff" },
    });

    await act(async () => {
        screen.getByRole("button", { name: "Сохранить" }).click();
    });

    await waitFor(() => expect(themeService.update).toHaveBeenCalledWith(7, expect.anything()));

    const payload = themeService.update.mock.calls[0][1];
    expect(payload.roles.accent).toBe("#ff00ff");
    expect(themeService.create).not.toHaveBeenCalled();
});

test("базовая тема подставляет свои цвета и режим", async () => {
    setup({ count: 0 });
    themeService.create.mockResolvedValue({ message: "Тема сохранена", theme: item });

    fireEvent.change(screen.getByPlaceholderText("Морская ночь"), { target: { value: "Светлая" } });
    fireEvent.change(screen.getByLabelText("Базовая тема"), { target: { value: "light" } });

    expect(screen.getByLabelText("Тёмная или светлая").value).toBe("light");
    expect(screen.getAllByLabelText(/: палитра/)[0].value).toBe(
        themeByKey("light").variables["--bg-canvas"]
    );

    await act(async () => {
        screen.getByRole("button", { name: "Сохранить в библиотеку" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalledTimes(1));

    const payload = themeService.create.mock.calls[0][0];
    expect(payload.base).toBe("light");
    expect(payload.mode).toBe("light");
});

test("лимит библиотеки не даёт сохранить лишнюю тему", () => {
    setup({ count: 10 });

    expect(screen.getByRole("button", { name: "Сохранить как новую" }).disabled).toBe(true);
    expect(screen.getByText(/В библиотеке уже 10 тем/)).toBeTruthy();
});

test("удаление спрашивает подтверждение", async () => {
    const handlers = setup({ item, count: 1 });
    themeService.remove.mockResolvedValue({ message: "Тема удалена" });

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await act(async () => {
        screen.getByRole("button", { name: "Удалить тему" }).click();
    });

    await waitFor(() => expect(themeService.remove).toHaveBeenCalledWith(7));
    expect(handlers.onDeleted).toHaveBeenCalledWith(7);
});

test("импортированная тема приходит черновиком и сохраняется только кнопкой", async () => {
    setup({
        draft: {
            title: "Из файла",
            description: "Взято из чата",
            mode: "dark",
            base: "dark",
            roles: THEME_PRESETS[2].roles,
        },
    });

    expect(screen.getByDisplayValue("Из файла")).toBeTruthy();
    expect(themeService.create).not.toHaveBeenCalled();

    themeService.create.mockResolvedValue({ message: "Тема сохранена", theme: item });

    await act(async () => {
        screen.getByRole("button", { name: "Сохранить в библиотеку" }).click();
    });

    await waitFor(() => expect(themeService.create).toHaveBeenCalledTimes(1));

    const payload = themeService.create.mock.calls[0][0];
    expect(payload.title).toBe("Из файла");
    expect(payload.description).toBe("Взято из чата");
    expect(payload.roles.accent).toBe(THEME_PRESETS[2].roles.accent);
});
