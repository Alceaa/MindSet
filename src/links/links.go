package links

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

type Link struct {
	Label string
	Alias string
	Key   string
}

var (
	wikilinkPattern = regexp.MustCompile(`\[\[([^\[\]\n]+)\]\]`)
	escapePattern   = regexp.MustCompile("\\\\([!-/:-@[-`{-~])")
	entityPattern   = regexp.MustCompile(`&#x([0-9a-fA-F]{1,6});|&#(\d{1,7});|&(lt|gt|quot|apos|nbsp|amp);`)
)

var namedEntities = map[string]string{
	"lt":   "<",
	"gt":   ">",
	"quot": "\"",
	"apos": "'",
	"nbsp": "\u00a0",
	"amp":  "&",
}

func Parse(markdown string) []Link {
	text := stripCode(decodeEntities(unescapeEscapes(markdown)))

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

func unescapeEscapes(text string) string {
	return escapePattern.ReplaceAllString(text, "$1")
}

func decodeEntities(text string) string {
	return entityPattern.ReplaceAllStringFunc(text, func(match string) string {
		parts := entityPattern.FindStringSubmatch(match)
		if parts == nil {
			return match
		}

		switch {
		case parts[1] != "":
			return characterReference(parts[1], 16, match)
		case parts[2] != "":
			return characterReference(parts[2], 10, match)
		default:
			if value, ok := namedEntities[parts[3]]; ok {
				return value
			}
			return match
		}
	})
}

func characterReference(raw string, base int, fallback string) string {
	code, err := strconv.ParseInt(raw, base, 32)
	if err != nil || code < 0 || code > unicode.MaxRune {
		return fallback
	}

	return string(rune(code))
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

var (
	nonSlugChars   = regexp.MustCompile(`[^\p{L}\p{N}]+`)
	repeatedDashes = regexp.MustCompile(`-+`)
	leadingDashes  = regexp.MustCompile(`^-+`)
	trailingDashes = regexp.MustCompile(`-+$`)
)

func Slugify(title string) string {
	lowered := strings.ToLower(strings.TrimSpace(title))
	replaced := nonSlugChars.ReplaceAllString(lowered, "-")
	collapsed := repeatedDashes.ReplaceAllString(replaced, "-")

	return trailingDashes.ReplaceAllString(leadingDashes.ReplaceAllString(collapsed, ""), "")
}

func IsValidSlug(slug string) bool {
	if slug == "" {
		return false
	}

	for _, symbol := range slug {
		if unicode.IsLetter(symbol) || unicode.IsDigit(symbol) || symbol == '-' {
			continue
		}

		return false
	}

	return true
}
