# Build and test targets for the shop services.
GO ?= go
PKGS := ./...
BIN := bin/shop

.PHONY: all build test lint clean release

all: build test

build:
	@mkdir -p bin
	$(GO) build -o $(BIN) ./cmd/shop

test:
	$(GO) vet $(PKGS)
	$(GO) test -race -count=1 $(PKGS)

lint:
	golangci-lint run $(PKGS)

clean:
	rm -rf bin dist coverage.out

release: clean build
	@mkdir -p dist
	tar -czf dist/shop.tar.gz -C bin shop
	@echo "release ready: dist/shop.tar.gz"
