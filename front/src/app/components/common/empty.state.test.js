import { render, screen } from "@testing-library/react";
import EmptyState from "./empty.state.jsx";

test("блок пустого состояния показывает заголовок, подсказку и действие", () => {
    render(
        <EmptyState
            title="Сетов пока нет"
            hint="Создайте первый"
            action={<button type="button">Создать</button>}
        />
    );

    expect(screen.getByRole("heading", { name: "Сетов пока нет" })).toBeTruthy();
    expect(screen.getByText("Создайте первый")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Создать" })).toBeTruthy();
});

test("компактный вариант выводит одну строку без заголовка", () => {
    render(<EmptyState variant="inline" title="Ничего не найдено" />);

    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
});
