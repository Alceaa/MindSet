package links

import (
	"reflect"
	"testing"
)

func TestParseWikilinks(t *testing.T) {
	cases := []struct {
		name     string
		markdown string
		want     []Link
	}{
		{
			name:     "простая ссылка",
			markdown: "Смотри [[План на неделю]] и всё.",
			want:     []Link{{Label: "План на неделю", Key: "план на неделю"}},
		},
		{
			name:     "ссылка с текстом отображения",
			markdown: "Смотри [[План на неделю|план]] и всё.",
			want:     []Link{{Label: "План на неделю", Alias: "план", Key: "план на неделю"}},
		},
		{
			name:     "экранированная форма от MDXEditor",
			markdown: `Смотри \[\[План на неделю]] и \[\[Другое|алиас]].`,
			want: []Link{
				{Label: "План на неделю", Key: "план на неделю"},
				{Label: "Другое", Alias: "алиас", Key: "другое"},
			},
		},
		{
			name:     "экранированные скобки с обеих сторон",
			markdown: `Смотри \[\[План\]\] и всё.`,
			want:     []Link{{Label: "План", Key: "план"}},
		},
		{
			name:     "пробелы внутри скобок закодированы сущностями",
			markdown: "Смотри [[План&#x20;на&#x20;неделю]] и [[Отчёт&#32;за день]].",
			want: []Link{
				{Label: "План на неделю", Key: "план на неделю"},
				{Label: "Отчёт за день", Key: "отчёт за день"},
			},
		},
		{
			name:     "экранированная пунктуация внутри имени сета",
			markdown: `Смотри \[\[Мой\_сет]] и \[\[A \& B]] и \[\[Вопрос \(важный\)]].`,
			want: []Link{
				{Label: "Мой_сет", Key: "мой_сет"},
				{Label: "A & B", Key: "a & b"},
				{Label: "Вопрос (важный)", Key: "вопрос (важный)"},
			},
		},
		{
			name:     "экранированные ссылки не создаются из кода",
			markdown: "```go\nfmt.Println(\"\\[\\[[Внутри]]\")\n```\n\nСнаружи [[После]] и `\\[\\[Тоже нет]]`.",
			want:     []Link{{Label: "После", Key: "после"}},
		},
		{
			name:     "несколько ссылок в тексте",
			markdown: "# Заголовок\n\n- [[Первое]]\n- [[Второе]]\n\nАбзац со [[Третьим]].\n",
			want: []Link{
				{Label: "Первое", Key: "первое"},
				{Label: "Второе", Key: "второе"},
				{Label: "Третьим", Key: "третьим"},
			},
		},
		{
			name:     "дубликаты схлопываются по нормализованному ключу",
			markdown: "[[План]] и [[план]] и [[ ПЛАН  на  неделю ]]",
			want: []Link{
				{Label: "План", Key: "план"},
				{Label: "ПЛАН  на  неделю", Key: "план на неделю"},
			},
		},
		{
			name:     "ссылки внутри блока кода игнорируются",
			markdown: "Текст [[Снаружи]]\n\n```go\nfmt.Println(\"[[Внутри]]\")\n```\n\nИ ещё [[После]].\n",
			want: []Link{
				{Label: "Снаружи", Key: "снаружи"},
				{Label: "После", Key: "после"},
			},
		},
		{
			name:     "ссылка внутри инлайн-кода игнорируется",
			markdown: "Видим [[Снаружи]], а `[[Внутри]]` — нет.",
			want:     []Link{{Label: "Снаружи", Key: "снаружи"}},
		},
		{
			name:     "незакрытые и пустые скобки игнорируются",
			markdown: "[[Незакрытая и [[]] и [ [обычные скобки] ]",
			want:     []Link{},
		},
		{
			name:     "обычные markdown-ссылки не считаются связями",
			markdown: "Это [обычная ссылка](https://go.dev), а не [[связь]].",
			want:     []Link{{Label: "связь", Key: "связь"}},
		},
		{
			name:     "перевод строки внутри скобок не создаёт ссылку",
			markdown: "[[Первая половина\nвторая половина]]",
			want:     []Link{},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got := Parse(testCase.markdown)
			if len(got) == 0 {
				got = []Link{}
			}
			if !reflect.DeepEqual(got, testCase.want) {
				t.Errorf("Parse() = %+v, ожидалось %+v", got, testCase.want)
			}
		})
	}
}

func TestNormalizeTitle(t *testing.T) {
	cases := map[string]string{
		"План на неделю":      "план на неделю",
		"  План   на неделю ": "план на неделю",
		"ПЛАН":                "план",
		"Go Notes":            "go notes",
		"":                    "",
		"   ":                 "",
	}

	for input, want := range cases {
		if got := NormalizeTitle(input); got != want {
			t.Errorf("NormalizeTitle(%q) = %q, ожидалось %q", input, got, want)
		}
	}
}

func TestKeys(t *testing.T) {
	parsed := []Link{{Label: "А", Key: "а"}, {Label: "Б", Key: "б"}}

	if got := Keys(parsed); !reflect.DeepEqual(got, []string{"а", "б"}) {
		t.Errorf("Keys() = %v", got)
	}
	if got := Keys(nil); len(got) != 0 {
		t.Errorf("Keys(nil) = %v, ожидался пустой срез", got)
	}
}

func TestSlugify(t *testing.T) {
	tests := []struct {
		name  string
		title string
		want  string
	}{
		{name: "пробелы становятся дефисами", title: "Мои заметки", want: "мои-заметки"},
		{name: "латиница в нижний регистр", title: "Hello World", want: "hello-world"},
		{name: "смешанные алфавиты", title: "Go и Rust 1.21", want: "go-и-rust-1-21"},
		{name: "пунктуация схлопывается", title: "Что   это?! -- Да.", want: "что-это-да"},
		{name: "обрезка краёв", title: "  ...тест...  ", want: "тест"},
		{name: "только символы", title: "!!!", want: ""},
		{name: "пустая строка", title: "   ", want: ""},
		{name: "цифры", title: "123", want: "123"},
		{name: "слеш и подчёркивание", title: "a/b_c", want: "a-b-c"},
	}

	for _, tt := range tests {
		got := Slugify(tt.title)
		if got != tt.want {
			t.Errorf("Slugify(%q) = %q, want %q", tt.title, got, tt.want)
		}
	}
}

func TestIsValidSlug(t *testing.T) {
	valid := []string{"a", "hello-world", "мои-заметки", "123", "go-1-21"}
	for _, slug := range valid {
		if !IsValidSlug(slug) {
			t.Errorf("IsValidSlug(%q) = false, want true", slug)
		}
	}

	invalid := []string{"", "a b", "a/b", "a_b", "a.b", "a?b"}
	for _, slug := range invalid {
		if IsValidSlug(slug) {
			t.Errorf("IsValidSlug(%q) = true, want false", slug)
		}
	}
}

func TestSlugifyAlwaysValid(t *testing.T) {
	titles := []string{"Мои заметки", "Hello World", "!!!", "a/b_c", "  ", "Go 1.21"}

	for _, title := range titles {
		slug := Slugify(title)
		if slug == "" {
			continue
		}
		if !IsValidSlug(slug) {
			t.Errorf("Slugify(%q) = %q, which is not a valid slug", title, slug)
		}
	}
}

func TestSlugifyIsStable(t *testing.T) {
	first := Slugify("Мои заметки")

	for i := 0; i < 5; i++ {
		if got := Slugify("Мои заметки"); got != first {
			t.Fatalf("Slugify is not stable: %q then %q", first, got)
		}
	}
}
