import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    env: { VITE_BI_API_URL: '' },
  },
})
