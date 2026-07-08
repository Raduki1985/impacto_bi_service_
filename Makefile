.PHONY: install dev build lint preview clean

install:
	npm install --cache ./.npm-cache

dev:
	npm run dev -- --host 0.0.0.0

build:
	npm run build

lint:
	npm run lint

preview:
	npm run preview -- --host 0.0.0.0

clean:
	rm -rf dist node_modules .npm-cache
