/**
 * Único ponto do projeto autorizado a tocar o armazenamento da visualização
 * escolhida na página Perfis de acesso.
 *
 * Preferência de apresentação, e não de acesso: o que está gravado aqui só
 * decide se a coleção aparece em lista ou em grade. Nenhuma regra de permissão,
 * de navegação ou de domínio depende deste valor, e nada aqui altera Perfil de
 * Acesso nenhum.
 *
 * A preferência é do navegador, e não do usuário: a página não tem sessão
 * própria e a escolha é uma comodidade de leitura, não um dado da pessoa. Por
 * isso a chave guarda um valor único, e não uma coleção indexada por `user.id`
 * como o departamento inicial.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * anterior, editado à mão ou truncado. A leitura nunca lança, nunca devolve algo
 * fora de forma e nunca reescreve o que encontrou; a escrita nunca derruba a
 * sessão quando falha.
 */

/** Mesmo padrão de nomenclatura das demais chaves do portal. */
export const ACCESS_PROFILES_VIEW_STORAGE_KEY = 'impacto-bi.access-profiles-view'

/** Visualizações aceitas pela página. */
export type AccessProfilesView = 'list' | 'grid'

/**
 * Grade é o padrão aprovado: a coleção inteira cabe na tela de uma vez, e é
 * assim que o Administrador percorre os perfis antes de abrir um deles.
 */
export const DEFAULT_ACCESS_PROFILES_VIEW: AccessProfilesView = 'grid'

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isAccessProfilesView(value: unknown): value is AccessProfilesView {
  return value === 'list' || value === 'grid'
}

/**
 * Visualização gravada, ou grade.
 *
 * Chave ausente, valor desconhecido, valor de outro tipo e armazenamento
 * indisponível devolvem grade: nenhum desses casos é erro para quem chama,
 * porque a ausência de preferência é o estado normal da primeira visita.
 *
 * O valor é texto puro, e não JSON: são duas palavras fechadas, e envelopá-las
 * só criaria uma segunda forma de o conteúdo estar quebrado.
 *
 * Nada é reescrito por uma leitura. Um valor inválido permanece intocado no
 * armazenamento até que o usuário escolha uma visualização: corrigi-lo aqui
 * transformaria uma leitura em escrita e apagaria em silêncio o que alguém pôs
 * ali de propósito.
 */
export function readStoredAccessProfilesView(): AccessProfilesView {
  const storage = getStorage()
  if (!storage) return DEFAULT_ACCESS_PROFILES_VIEW

  try {
    const raw = storage.getItem(ACCESS_PROFILES_VIEW_STORAGE_KEY)

    return isAccessProfilesView(raw) ? raw : DEFAULT_ACCESS_PROFILES_VIEW
  } catch {
    return DEFAULT_ACCESS_PROFILES_VIEW
  }
}

/**
 * Grava a escolha. Devolve false quando o armazenamento recusa (quota, modo
 * privado, indisponível), sem lançar: a escolha continua valendo durante a
 * sessão mesmo sem persistência, como já acontece com o tema e com a sidebar.
 */
export function writeStoredAccessProfilesView(view: AccessProfilesView): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, view)

    return true
  } catch {
    return false
  }
}
