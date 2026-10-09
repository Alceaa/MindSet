# ---- build stage ----
FROM golang:1.24-alpine AS build

WORKDIR /src
COPY src/go.mod src/go.sum ./
RUN go mod download

COPY src/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/mindset . \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/admin ./cmd/admin \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/mailcheck ./cmd/mailcheck

# ---- runtime stage ----
FROM alpine:3.20

RUN adduser -D -u 10001 app \
 && apk add --no-cache ca-certificates tzdata \
 && mkdir -p /app/uploads && chown -R app:app /app

WORKDIR /app
COPY --from=build /out/mindset /app/mindset
COPY --from=build /out/migrate /app/migrate
COPY --from=build /out/admin /app/admin
COPY --from=build /out/mailcheck /app/mailcheck
COPY src/db/schema.sql /app/db/schema.sql
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER app
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
