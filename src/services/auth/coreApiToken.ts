/**
 * Guarda do token JWT emitido por `POST /auth/login` do `impacto-bi-service`.
 *
 * É a SESSÃO do portal: quem tem o token gravado é quem o serviço reconhece, e
 * quem não tem precisa entrar pelo formulário. Nenhum outro identificador de
 * sessão é gravado em lugar nenhum, e a antiga chave `impacto-bi.auth-session`
 * da fase mockada é apagada por `services/auth/authSession`.
 *
 * Este módulo só guarda e devolve o token. Quem o obtém, quem o valida e quem o
 * descarta é `authSession`; quem o envia em cada chamada é `coreApiClient`. Os
 * três dependem deste arquivo, e ele não depende de nenhum deles.
 *
 * `sessionStorage` e não `localStorage`: a credencial pertence à aba e morre
 * quando ela fecha, que é o comportamento pedido para o portal. Um token de
 * acesso vivendo no `localStorage` sobreviveria ao fechamento do navegador.
 *
 * Limite conhecido, e que não depende deste código: se o próprio navegador
 * restaurar a aba fechada (Ctrl+Shift+T, ou a opção de continuar de onde parou),
 * ele devolve junto o `sessionStorage` daquela aba, e a sessão volta.
 */

/** Mesmo padrão de nomenclatura das demais chaves do portal. */
export const CORE_API_TOKEN_STORAGE_KEY = 'impacto-bi.core-api-token'

/**
 * Cópia em memória do token desta execução.
 *
 * Existe para o armazenamento indisponível (modo privado, quota, bloqueio) não
 * impedir a entrada: a sessão vale enquanto a página estiver aberta, e só o F5
 * a perde. É o mesmo tratamento que as preferências do portal dão a uma
 * gravação recusada.
 */
let inMemoryToken: string | null = null

/**
 * null quando indisponível (SSR, modo privado ou bloqueio do navegador).
 *
 * Lido por `window.sessionStorage`, e não pelo global solto: é o mesmo caminho
 * das demais chaves do portal, e o que permite aos testes trocarem o
 * armazenamento por um dublê.
 */
function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null

    try {
        return window.sessionStorage
    } catch {
        return null
    }
}

/**
 * Leitura tolerante: sem armazenamento, sem chave ou texto em branco devolvem
 * `null`, e quem chama trata como sem sessão. Uma exceção aqui derrubaria a tela
 * inteira por causa de uma credencial que pode simplesmente não existir ainda.
 */
export function getCoreApiToken(): string | null {
    const storage = getStorage()
    if (!storage) return inMemoryToken

    try {
        const stored = storage.getItem(CORE_API_TOKEN_STORAGE_KEY)
        const trimmed = stored?.trim() ?? ''
        return trimmed === '' ? inMemoryToken : trimmed
    } catch {
        return inMemoryToken
    }
}

/**
 * Grava o token. Devolve false quando o armazenamento recusou: a sessão vale em
 * memória até o próximo F5, e a pessoa entra de novo depois dele.
 */
export function setCoreApiToken(token: string): boolean {
    const trimmed = token.trim()
    if (trimmed === '') return clearCoreApiToken()

    inMemoryToken = trimmed

    const storage = getStorage()
    if (!storage) return false

    try {
        storage.setItem(CORE_API_TOKEN_STORAGE_KEY, trimmed)
        return true
    } catch {
        return false
    }
}

/** Apaga o token, da memória e da aba. Devolve false quando o armazenamento recusou. */
export function clearCoreApiToken(): boolean {
    inMemoryToken = null

    const storage = getStorage()
    if (!storage) return false

    try {
        storage.removeItem(CORE_API_TOKEN_STORAGE_KEY)
        return true
    } catch {
        return false
    }
}
