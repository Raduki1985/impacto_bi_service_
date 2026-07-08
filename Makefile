APP_NAME ?= impacto-bi-web
IMAGE_NAME ?= impacto-bi-web
IMAGE_TAG ?= local
PORT ?= 8080

.PHONY: install dev build lint preview clean docker-build docker-run docker-stop docker-logs

install:
	bun install

dev:
	bun run dev -- --host 0.0.0.0

build:
	bun run build

lint:
	bun run lint

preview:
	bun run preview -- --host 0.0.0.0

clean:
	rm -rf dist node_modules .npm-cache .bun-cache

docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

docker-run: docker-stop docker-build
	docker run -d --name $(APP_NAME) -p $(PORT):80 $(IMAGE_NAME):$(IMAGE_TAG)

docker-stop:
	-docker rm -f $(APP_NAME)

docker-logs:
	docker logs -f $(APP_NAME)
