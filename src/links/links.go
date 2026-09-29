package links

import (
	"regexp"
	"strings"
)

type Link struct {
	Label string
	Alias string
	Key   string
}

var wikilinkPattern = regexp.MustCompile(`\[\[([^\[\]\n]+)\]\]`)

func Parse(markdown string) []Link {
	text := stripCode(unescapeBrackets(markdown))
	matches := wikilinkPattern.FindAllStringSubmatch(text, -1)

	parsed := make([]Link, 0, len(matches))
	seen := make(map[string]bool, len(matches))

	for _, match := range matches {
		label, alias := splitAlias(match[1])
		key := NormalizeTitle(label)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		parsed = append(parsed, Link{Label: label, Alias: alias, Key: key})
	}

	return parsed
}

func NormalizeTitle(title string) string {
	return strings.ToLower(strings.Join(strings.Fields(title), " "))
}

func Keys(parsed []Link) []string {
	keys := make([]string, 0, len(parsed))
	for _, link := range parsed {
		keys = append(keys, link.Key)
	}
	return keys
}

func splitAlias(raw string) (label, alias string) {
	parts := strings.SplitN(raw, "|", 2)
	label = strings.TrimSpace(parts[0])
	if len(parts) == 2 {
		alias = strings.TrimSpace(parts[1])
	}
	return label, alias
}

func unescapeBrackets(text string) string {
	return strings.NewReplacer(`\[`, "[", `\]`, "]").Replace(text)
}

func stripCode(text string) string {
	var out strings.Builder
	fence := ""

	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)

		if fence != "" {
			if strings.HasPrefix(trimmed, fence) {
				fence = ""
			}
			continue
		}

		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			fence = trimmed[:3]
			continue
		}

		out.WriteString(stripInlineCode(line))
		out.WriteString("\n")
	}

	return out.String()
}

func stripInlineCode(line string) string {
	var out strings.Builder
	inCode := false

	for _, symbol := range line {
		if symbol == '`' {
			inCode = !inCode
			continue
		}
		if !inCode {
			out.WriteRune(symbol)
		}
	}

	return out.String()
}
