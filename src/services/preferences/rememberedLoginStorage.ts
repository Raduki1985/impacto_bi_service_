/**
 * Único ponto do projeto autorizado a tocar a memória do último e-mail usado na
 * tela de entrada.
 *
 * É o que o `Lembrar-me` passou a significar: guardar QUEM entrou por último,
 * para o campo de e-mail já vir preenchido no próximo acesso. Ele não mantém
 * ninguém logado, e não tem relação com a sessão: a sessão vive no
 * `sessionStorage` e morre com a aba, como descrito em `services/auth/authSession`.
 *
 * O e-mail NÃO é credencial: ele não prova nada, não autoriza nada e continua
 * passando pela mesma conferência de cadastro e Perfil de Acesso a cada entrada.
 * Guardá-lo é conveniência de digitação, e é por isso que a pessoa pode recusar,
 * desmarcando a caixa, e a recusa apaga o que estava gravado.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * anterior, editado à mão ou truncado. A leitura nunca lança e nunca devolve
 * algo fora de forma; a escrita nunca derruba a entrada quando falha.
 */

/** Mesmo padrão de nomenclatura das demais chaves do portal. */
export const REMEMBERED_LOGIN_STORAGE_KEY = 'impacto-bi.remembered-login'

/**
 * Os três estados possíveis, e por que são três e não dois.
 *
 * `undecided` é o primeiro acesso naquele navegador: ninguém entrou ainda, então
 * não existe recusa a respeitar e a caixa aparece marcada, como sempre apareceu.
 * `declined` é diferente: alguém desmarcou a caixa de propósito, e a tela precisa
 * lembrar dessa recusa, senão a caixa voltaria marcada no acesso seguinte e a
 * escolha da pessoa duraria uma entrada só.
 */
export type RememberedLogin =
    | { status: 'remembered'; email: string }
    | { status: 'declined' }
    | { status: 'undecided' }

/**
 * Texto vazio é a marca da recusa, e nunca um e-mail: nenhum e-mail sobrevive ao
 * `trim` como texto vazio, então os dois estados gravados não se confundem.
 */
const DECLINED_VALUE = ''

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null

    try {
        return window.localStorage
    } catch {
        return null
    }
}

/**
 * Estado gravado neste navegador.
 *
 * Chave ausente e armazenamento indisponível devolvem `undecided`, que é o
 * estado normal de quem nunca entrou por aqui: nenhum dos dois é erro para quem
 * chama. Nada é reescrito por uma leitura.
 */
export function readRememberedLogin(): RememberedLogin {
    const storage = getStorage()
    if (!storage) return {status: 'undecided'}

    try {
        const raw = storage.getItem(REMEMBERED_LOGIN_STORAGE_KEY)
        if (typeof raw !== 'string') return {status: 'undecided'}

        const email = raw.trim()

        return email ? {status: 'remembered', email} : {status: 'declined'}
    } catch {
        return {status: 'undecided'}
    }
}

/**
 * Guarda o e-mail de quem acabou de entrar.
 *
 * Devolve false quando o armazenamento recusa (quota, modo privado,
 * indisponível), sem lançar: a entrada já aconteceu, e não conseguir lembrar o
 * e-mail não pode atrapalhar quem está entrando.
 */
export function rememberLoginEmail(email: string): boolean {
    const normalized = email.trim()
    if (!normalized) return false

    const storage = getStorage()
    if (!storage) return false

    try {
        storage.setItem(REMEMBERED_LOGIN_STORAGE_KEY, normalized)

        return true
    } catch {
        return false
    }
}

/**
 * Registra a recusa e APAGA o e-mail que estivesse guardado.
 *
 * Apagar é a parte que importa: desmarcar a caixa em um computador compartilhado
 * precisa tirar da tela o e-mail de quem entrou antes, e não apenas parar de
 * atualizá-lo.
 */
export function declineRememberedLogin(): boolean {
    const storage = getStorage()
    if (!storage) return false

    try {
        storage.setItem(REMEMBERED_LOGIN_STORAGE_KEY, DECLINED_VALUE)

        return true
    } catch {
        return false
    }
}
