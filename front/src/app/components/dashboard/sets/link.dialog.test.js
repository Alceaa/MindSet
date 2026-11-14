import { fireEvent, render, screen } from "@testing-library/react";
import LinkDialog from "./link.dialog.jsx";

test("подставляет https и вставляет ссылку с готовой подписью", () => {
    const onApply = jest.fn();

    render(<LinkDialog initial={{ text: "Майндсет" }} onApply={onApply} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Адрес ссылки"), {
        target: { value: "example.com/page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Вставить ссылку" }));

    expect(onApply).toHaveBeenCalledWith({
        href: "https://example.com/page",
        text: "Майндсет",
    });
});

test("относительный адрес оставляет как есть", () => {
    const onApply = jest.fn();

    render(<LinkDialog initial={{}} onApply={onApply} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Адрес ссылки"), { target: { value: "/sets/12" } });
    fireEvent.change(screen.getByLabelText("Текст ссылки"), { target: { value: " сет " } });
    fireEvent.click(screen.getByRole("button", { name: "Вставить ссылку" }));

    expect(onApply).toHaveBeenCalledWith({ href: "/sets/12", text: "сет" });
});

test("пробелы и скобки в адресе не ломают ссылку", () => {
    const onApply = jest.fn();

    render(<LinkDialog initial={{}} onApply={onApply} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Адрес ссылки"), {
        target: { value: "site.com/a b(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Вставить ссылку" }));

    expect(onApply).toHaveBeenCalledWith({
        href: "https://site.com/a%20b%281%29",
        text: "",
    });
});

test("без адреса вставить нельзя, Esc закрывает окно", () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    render(<LinkDialog initial={{}} onApply={onApply} onClose={onClose} />);

    expect(screen.getByRole("button", { name: "Вставить ссылку" }).disabled).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
});