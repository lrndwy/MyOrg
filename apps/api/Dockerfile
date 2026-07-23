# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build server + CLI tools (migrate/seed are separate entrypoints —
# `./server migrate` is NOT a subcommand; it starts the HTTP server).
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -o /app/migrate ./cmd/migrate \
 && CGO_ENABLED=0 GOOS=linux go build -o /app/seed ./cmd/seed

# Run stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata \
    tesseract-ocr tesseract-ocr-data-ind tesseract-ocr-data-eng poppler-utils

# Non-root runtime user — Sentinel/Pulse open embedded SQLite stores under
# /app, so chown before USER or those fail with the misleading
# "out of memory (14)" SQLITE_CANTOPEN error.
RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=builder /app/server /app/migrate /app/seed ./

RUN chown -R app:app /app

USER app

EXPOSE 8080

CMD ["./server"]
