import { groupListItems } from "./list.toggle";

// Снятие списка (и чек-листа) касается только выделенных пунктов: так рядом стоящие
// невыделенные остаются списком, а сам список может разорваться на два.
test("группирует пункты вокруг выделения", () => {
    const keys = ["a", "b", "c", "d"];

    expect(groupListItems(keys, new Set(["b", "c"]))).toEqual([
        { selected: false, keys: ["a"] },
        { selected: true, keys: ["b", "c"] },
        { selected: false, keys: ["d"] },
    ]);

    expect(groupListItems(keys, new Set(["b", "d"]))).toEqual([
        { selected: false, keys: ["a"] },
        { selected: true, keys: ["b"] },
        { selected: false, keys: ["c"] },
        { selected: true, keys: ["d"] },
    ]);

    expect(groupListItems(keys, new Set(["a"]))).toEqual([
        { selected: true, keys: ["a"] },
        { selected: false, keys: ["b", "c", "d"] },
    ]);

    expect(groupListItems(keys)).toEqual([{ selected: false, keys }]);
});

test("весь список выделен — одна группа на снятие", () => {
    const keys = ["a", "b"];
    expect(groupListItems(keys, new Set(keys))).toEqual([{ selected: true, keys }]);
});

test("пустой список — пустой результат", () => {
    expect(groupListItems([], new Set(["a"]))).toEqual([]);
});
