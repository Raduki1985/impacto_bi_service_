# Aviso de versão desatualizada (SPA em cache)

Este documento descreve **todo o mecanismo** que faz o mobiq-web detectar quando um
novo deploy do front-end foi publicado e avisar o usuário para recarregar a página,
e serve como **guia de replicação** para qualquer projeto Node/SPA (React, Angular,
Vue, Svelte, etc.).

## Por que isso existe

Uma SPA é baixada uma vez e fica aberta no navegador por horas/dias. Quando um novo
build é publicado, o usuário continua rodando o bundle antigo — muitas vezes servido
do cache do navegador — até dar um refresh manual. O mecanismo abaixo:

1. "Carimba" cada build com um número de versão em um arquivo estático servido **sem cache**;
2. Faz o app rodando **consultar periodicamente** esse arquivo;
3. Compara a versão remota com a versão embutida no bundle atual;
4. Se a remota for mais nova, mostra um aviso persistente com botão **"Atualizar agora"**.

O ponto crítico é o **cache**: o `version.json` (e o `index.html`) precisam ser
servidos sem cache; o restante dos assets (JS/CSS com hash no nome) pode e deve ter
cache longo.

## Fluxo geral

```
build  ──►  package.json.version ──►  public/version.json  ──►  deploy
                                                                  │
navegador (bundle antigo) ── polling GET /version.json?t=… ──────┘
        │
        └─► versão remota > versão do bundle ?  ──► toast "Atualizar agora" ──► reload
```

---

## Peças que compõem o mecanismo (neste projeto)

| Arquivo | Linha(s) | Papel |
|---|---|---|
| `package.json` | `version` | Fonte única da versão (bump manual ou `npm version`) |
| `package.json` | `scripts.build` | Gera `public/version.json` a partir da versão antes do `vite build` |
| `public/version.json` | — | Artefato estático `{ "version": "x.y.z" }` publicado junto com o build |
| `.env` / `.env.staging` / `.env.production` | `VITE_VERSION_CHECK_INTERVAL_MINUTES` | Intervalo do polling por ambiente |
| `nginx.conf` | `location = /version.json` e `location = /index.html` | Serve esses arquivos **sem cache**; demais assets com cache de 1 ano |
| `src/config.ts` | `VERSION`, `IS_DEV`, `VERSION_CHECK_INTERVAL_MS` | Deriva a config a partir de env + `package.json` |
| `src/hooks/useVersionCheck.ts` | — | Faz o polling, compara semver e dispara o toast |
| `src/App.tsx` | `useVersionCheck()` | Ativa o hook uma vez no topo da árvore |

---

## 1. Carimbar o build com a versão

A versão vive **exclusivamente** no `package.json` (`version`). O script de build
serializa esse valor para `public/version.json` **antes** de empacotar, garantindo
que o arquivo publicado sempre reflita o build atual:

```jsonc
// package.json
{
  "version": "1.0.76",
  "scripts": {
    // gera public/version.json a partir da versão e só então builda
    "build": "node -e \"const {version}=require('./package.json');require('fs').writeFileSync('./public/version.json',JSON.stringify({version}))\" && vite build"
  }
}
```

Resultado (`public/version.json`):

```json
{ "version": "1.0.76" }
```

> **Não versione `public/version.json` desatualizado à mão.** Ele é um artefato de
> build. O que você atualiza é o `version` do `package.json`.

### Equivalências por framework

O importante é: **gerar um arquivo estático com a versão, na raiz servida do site,
como parte do build.**

- **Vite (React/Vue/Svelte)** → arquivos em `public/` são copiados para a raiz do
  `dist/`. Basta o `node -e ...` acima antes do `vite build` (como neste projeto),
  ou um plugin.
- **Angular (`ng build`)** → coloque um `assets/version.json` (ou use um script
  `prebuild` no `package.json`) e/ou liste o arquivo em `angular.json > assets`.
  Exemplo de `prebuild`:
  ```jsonc
  "scripts": {
    "prebuild": "node -e \"const {version}=require('./package.json');require('fs').writeFileSync('./src/version.json',JSON.stringify({version}))\"",
    "build": "ng build"
  }
  ```
- **Next.js / CRA / outros** → gere para a pasta pública correspondente (`public/`).
- **CI como fonte** → alternativamente, injete a versão via variável de CI
  (ex.: `CI_COMMIT_SHORT_SHA` ou tag do git) escrevendo o `version.json` no pipeline.
  Nesse caso a comparação abaixo passa a ser por igualdade de string (hash/tag) em
  vez de semver.

---

## 2. Servir `version.json` (e `index.html`) sem cache

Sem isso, o navegador/CDN devolve o `version.json` antigo e o check nunca dispara.

```nginx
# nginx.conf

# index.html sempre fresco (aponta para os assets com hash do build atual)
location = /index.html {
    add_header Cache-Control 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
    try_files $uri $uri/ =404;
}

# arquivo de versão sempre fresco
location = /version.json {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    try_files $uri =404;
}

# demais assets (JS/CSS/imagens/fontes) têm hash no nome → cache longo é seguro
location ~* \.(?:css|js|jpg|jpeg|gif|png|svg|ico|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public";
}
```

> Se o deploy estiver atrás de uma CDN (CloudFront, Cloudflare, etc.), aplique a
> mesma regra **na CDN**: `version.json` e `index.html` com TTL 0 / bypass de cache.
> O `Cache-Control` do origin sozinho pode não bastar.

O `fetch` no código ainda reforça isso com `cache: "no-store"` e um cache-buster
`?t=<timestamp>` (ver abaixo) — cinto e suspensório.

---

## 3. Configuração e intervalo de polling

O intervalo é uma env var, ajustável por ambiente (ex.: mais frequente em staging):

```dotenv
# .env              → VITE_VERSION_CHECK_INTERVAL_MINUTES=10
# .env.staging      → VITE_VERSION_CHECK_INTERVAL_MINUTES=2
# .env.production   → VITE_VERSION_CHECK_INTERVAL_MINUTES=15
```

`config.ts` deriva os valores usados pelo hook — a versão local vem do `package.json`
importado (Vite permite importar JSON):

```ts
// src/config.ts
import pkg from "../package.json";

export const Config = {
  IS_DEV: import.meta.env.DEV,
  VERSION: pkg.version, // versão embutida no bundle (build time)
  VERSION_CHECK_INTERVAL_MS:
    Number(import.meta.env.VITE_VERSION_CHECK_INTERVAL_MINUTES ?? 30) * 60 * 1000,
};
```

> **Angular**: use `environment.ts`/`environment.prod.ts` no lugar de `import.meta.env`,
> e importe a versão via `import { version } from '../../package.json'` (habilite
> `resolveJsonModule` no `tsconfig`) ou injete em build time.

---

## 4. O hook de polling + comparação + aviso

```ts
// src/hooks/useVersionCheck.ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Config } from "@/config";

async function fetchRemoteVersion(): Promise<string> {
  // ?t=… evita cache intermediário mesmo se algum proxy ignorar o Cache-Control
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("version fetch failed");
  const data = await res.json();
  return data.version as string;
}

// compara semver major.minor.patch
function isNewerVersion(remote: string, local: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [lMaj, lMin, lPat] = parse(local);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

export function useVersionCheck() {
  const [updateFound, setUpdateFound] = useState(false);

  const { data: remoteVersion } = useQuery({
    queryKey: ["app-version"],
    queryFn: fetchRemoteVersion,
    enabled: !Config.IS_DEV,                                   // desligado em dev
    refetchInterval: updateFound ? false : Config.VERSION_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,                        // não faz polling em aba oculta
    retry: false,
  });

  useEffect(() => {
    if (!remoteVersion || updateFound) return;
    if (!isNewerVersion(remoteVersion, Config.VERSION)) return;

    setUpdateFound(true);                                      // para o polling
    toast("Nova versão disponível", {
      id: "app-update",
      description: `Versão ${remoteVersion} está pronta. Atualize para ter as últimas melhorias.`,
      duration: Infinity,
      dismissible: false,
      action: {
        label: "Atualizar agora",
        onClick: () => window.location.reload(),
      },
    });
  }, [remoteVersion, updateFound]);
}
```

Ativado uma única vez no topo da aplicação:

```tsx
// src/App.tsx
import { useVersionCheck } from "@/hooks/useVersionCheck";

function App() {
  useVersionCheck();
  // ...
}
```

### Decisões de design importantes

- **Desligado em desenvolvimento** (`enabled: !Config.IS_DEV`) — em dev o
  `version.json` não é regenerado e o HMR já cuida da atualização.
- **Não faz polling em aba em segundo plano** (`refetchIntervalInBackground: false`).
- **Para o polling depois de detectar** (`refetchInterval: updateFound ? false : …`)
  para não empilhar toasts.
- **Falha silenciosa** (`retry: false`, `throw` no fetch): se o `version.json` estiver
  fora do ar, o check simplesmente não dispara — nunca quebra a UI.
- **Toast persistente e não-dispensável** (`duration: Infinity`, `dismissible: false`):
  a única saída é recarregar.
- **`window.location.reload()`** busca o `index.html` fresco → novos assets com hash →
  bundle novo.

---

## Checklist de replicação (qualquer projeto Node/SPA)

**Build**
- [ ] Versão única em `package.json > version` (bump manual ou `npm version`).
- [ ] Script de build gera `version.json` na raiz servida (`public/`, `assets/`, `dist/`) a partir dessa versão.

**Serving / infra**
- [ ] `version.json` servido **sem cache** (`Cache-Control: no-store`), no origin **e na CDN**.
- [ ] `index.html` servido **sem cache**.
- [ ] Demais assets com hash no nome + cache longo.

**Runtime (app)**
- [ ] Intervalo de polling configurável por ambiente (env var).
- [ ] Versão local embutida no bundle em build time (import do `package.json` ou env).
- [ ] Polling do `version.json` com cache-buster (`?t=`) e `cache: "no-store"`.
- [ ] Comparação (semver, ou igualdade de hash/tag se usar CI como fonte).
- [ ] Aviso ao usuário com ação de `reload`; falha silenciosa; desligado em dev; para após detectar.
- [ ] Hook/serviço ativado uma vez no bootstrap da app.

---

## Armadilhas comuns

- **CDN cacheando o `version.json`** → o check nunca dispara. É o erro nº 1; configure o bypass na CDN.
- **Esquecer o `index.html` sem cache** → o usuário recarrega mas recebe o HTML antigo apontando para assets antigos; o loop de "atualize" se repete.
- **Comparação por string simples** (`remote !== local`) → dispara "downgrade" se a
  ordem for invertida; por isso a comparação é semver. Se usar hash/tag de CI (sem
  ordenação), a igualdade `remote !== local` é aceitável.
- **`version.json` versionado desatualizado no git** → é artefato de build; não edite à mão.
- **Polling agressivo demais** → use minutos, não segundos; e evite polling em aba oculta.

---

## Documento relacionado

- [`versionamento-footer.md`](./versionamento-footer.md) — como a versão do front e a
  versão da API são exibidas no rodapé (mecanismo distinto, mas usa as mesmas fontes de versão).
```
