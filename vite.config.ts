import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Publica `version.json` na raiz da compilação, com a versão do `package.json`.
 *
 * É o carimbo que o portal já no ar consulta para descobrir que houve deploy
 * novo (ver `src/components/ui/useVersionCheck.ts`). A fonte é a MESMA do
 * número que aparece no menu do usuário: o campo `version` do `package.json`,
 * e só ele.
 *
 * É um plugin, e não um passo do `scripts.build`, porque o `Dockerfile` não
 * chama o script: ele roda `bunx vite build --mode $VITE_BUILD_MODE` direto.
 * Um `node -e ...` pendurado no `npm run build` sairia de graça no
 * desenvolvimento e NÃO sairia na imagem que vai ao ar, que é justamente onde
 * o arquivo precisa existir.
 *
 * Só na compilação: em desenvolvimento o aviso está desligado, e o Vite já
 * recarrega a página sozinho.
 */
function emitVersionFile(): Plugin {
  return {
    name: 'impacto-version-file',
    apply: 'build',
    generateBundle() {
      // Lido do disco a cada compilação, e não importado: o
      // `tsconfig.node.json` não resolve JSON, e ler aqui garante que o número
      // publicado é o que está no arquivo AGORA.
      const { version } = JSON.parse(
        readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
      ) as { version: string }

      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionFile()],
  test: {
    /**
     * A suíte roda SEMPRE sobre as bases locais, nunca contra a API.
     *
     * Sem esta linha, um `.env.local` com `VITE_BI_API_URL` na máquina de quem
     * está desenvolvendo faria a Visão Geral de OS abrir em carregamento
     * dentro dos testes, e dezenas deles falhariam sem nenhuma mudança de
     * código. Teste que muda de resultado conforme a configuração da máquina
     * não prova nada.
     */
    env: { VITE_BI_API_URL: '', VITE_CORE_API_URL: '' },
    /**
     * Os testes da sessão antiga (`authSession`, `passwordFlows`) seguem no
     * repositório inteiramente comentados, junto com os módulos que exercitavam:
     * o serviço de autenticação passou a ser `services/auth/authService`. Um
     * arquivo sem nenhum `it` faz o Vitest falhar a suíte, então eles ficam de
     * fora da coleta enquanto não forem reescritos.
     */
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/services/auth/authSession.test.ts',
      'src/services/auth/passwordFlows.test.ts',
      'src/lib/firstAccessInvite.test.ts',
      'src/services/users/changeUserPassword.test.ts',
      'src/services/users/setUserPassword.test.ts',
      'src/services/users/userApiMapper.test.ts',
      'src/services/users/userStatusGuards.test.ts',
      'src/Pages/Users/userAccessProfiles.test.ts',
    ],
  },
})
