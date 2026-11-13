export const SNIPPET_GROUPS = [
    {
        key: "blocks",
        title: "Блоки",
        items: [
            {
                key: "checklist",
                title: "Чек-лист",
                hint: "Список задач с галочками",
                markdown: "- [ ] Первое\n- [ ] Второе\n- [ ] Третье\n",
            },
            {
                key: "steps",
                title: "Шаги",
                hint: "Нумерованный список",
                markdown: "1. Первый шаг\n2. Второй шаг\n3. Третий шаг\n",
            },
            {
                key: "table",
                title: "Таблица",
                hint: "Две колонки",
                markdown: "| Что | Зачем |\n| --- | --- |\n|  |  |\n|  |  |\n",
            },
            {
                key: "code",
                title: "Блок кода",
                hint: "С подсветкой языка",
                markdown: "```go\n\n```\n",
            },
            {
                key: "callout",
                title: "Главное",
                hint: "Короткий вывод в рамке",
                markdown: "> **Главное.** \n",
            },
            {
                key: "quote",
                title: "Цитата",
                hint: "Выделенная мысль",
                markdown: "> Мысль, которую хочется выделить.\n",
            },
            {
                key: "divider",
                title: "Разделитель",
                hint: "Горизонтальная линия",
                markdown: "---\n",
            },
        ],
    },
    {
        key: "templates",
        title: "Шаблоны заметки",
        items: [
            {
                key: "summary",
                title: "Конспект",
                hint: "Контекст, мысли, выводы",
                markdown: "## Контекст\n\n\n## Ключевые мысли\n\n- \n- \n\n## Выводы\n\n- \n",
            },
            {
                key: "review",
                title: "Разбор",
                hint: "Что было, что сделал, что понял",
                markdown: "## Что было\n\n\n## Что сделал\n\n\n## Что понял\n\n",
            },
            {
                key: "compare",
                title: "Сравнение",
                hint: "Два варианта в таблице",
                markdown:
                    "## Сравнение\n\n| Критерий | Вариант A | Вариант B |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n",
            },
            {
                key: "questions",
                title: "Вопросы к себе",
                hint: "Что главное и что дальше",
                markdown:
                    "## Вопросы к себе\n\n- [ ] Что здесь главное?\n- [ ] Что осталось непонятным?\n- [ ] Что сделать дальше?\n",
            },
        ],
    },
];

export default SNIPPET_GROUPS;
