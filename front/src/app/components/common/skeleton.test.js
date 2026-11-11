import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonWorkspace } from "./skeleton.jsx";

test("скелетон объявляет загрузку с переданной подписью", () => {
    render(<Skeleton variant="card" count={3} label="Загружаем сеты…" />);

    expect(screen.getByRole("status", { name: "Загружаем сеты…" })).toBeTruthy();
});

test("скелетон по умолчанию подписан «Загружаем…»", () => {
    render(<Skeleton />);

    expect(screen.getByRole("status", { name: "Загружаем…" })).toBeTruthy();
});

test("скелетон рабочего места объявляет загрузку сета", () => {
    render(<SkeletonWorkspace />);

    expect(screen.getByRole("status", { name: "Загружаем сет…" })).toBeTruthy();
});
