package handlers

import (
	"testing"

	"mindset/media"
	"mindset/models"
)

// Вложения отчёта: адрес приходит от клиента, а уведомление читают живые люди,
// поэтому принимаем только ссылки из своего хранилища и не больше трёх.
func TestBugReportAttachments(t *testing.T) {
	ownURL := "https://s3.twcstorage.ru/mindset-media/reports/1.png"

	// Хранилище не настроено: проверить ссылку нечем — отчёт лучше отклонить.
	if _, err := bugReportAttachments([]string{ownURL}); err == nil {
		t.Fatal("без настроенного хранилища вложение должно отклоняться")
	}

	if err := media.Setup(media.Config{
		Endpoint:   "https://s3.twcstorage.ru",
		AccessKey:  "test-access-key",
		SecretKey:  "test-secret-key",
		Bucket:     "mindset-media",
		PublicBase: "https://s3.twcstorage.ru/mindset-media/",
	}); err != nil {
		t.Fatalf("media.Setup: %v", err)
	}

	cases := []struct {
		name    string
		given   []string
		want    []string
		wantErr bool
	}{
		{name: "пусто", given: nil, want: []string{}},
		{name: "пустые строки пропускаем", given: []string{"", "   "}, want: []string{}},
		{
			name:  "свои ссылки проходят",
			given: []string{media.PublicURL("reports/1.png"), " " + media.PublicURL("reports/2.png")},
			want:  []string{media.PublicURL("reports/1.png"), media.PublicURL("reports/2.png")},
		},
		{
			name:  "повторы не считаются",
			given: []string{media.PublicURL("reports/1.png"), media.PublicURL("reports/1.png")},
			want:  []string{media.PublicURL("reports/1.png")},
		},
		{
			name:    "чужая ссылка отклоняется",
			given:   []string{"https://evil.example/reports/1.png"},
			wantErr: true,
		},
		{
			name: "лишние вложения отклоняются",
			given: []string{
				media.PublicURL("reports/1.png"),
				media.PublicURL("reports/2.png"),
				media.PublicURL("reports/3.png"),
				media.PublicURL("reports/4.png"),
			},
			wantErr: true,
		},
	}

	for _, testCase := range cases {
		got, err := bugReportAttachments(testCase.given)
		if testCase.wantErr {
			if err == nil {
				t.Errorf("%s: ожидалась ошибка, получили %v", testCase.name, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: неожиданная ошибка %v", testCase.name, err)
			continue
		}
		if len(got) != len(testCase.want) {
			t.Errorf("%s: получили %v, ожидали %v", testCase.name, got, testCase.want)
			continue
		}
		for index := range got {
			if got[index] != testCase.want[index] {
				t.Errorf("%s: получили %v, ожидали %v", testCase.name, got, testCase.want)
				break
			}
		}
	}

	if models.BugReportMaxAttachments != 3 {
		t.Errorf("лимит вложений изменился: %d — поправьте подсказку в форме отчёта",
			models.BugReportMaxAttachments)
	}
}
