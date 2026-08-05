/**
 * Único ponto do projeto autorizado a tocar o armazenamento do departamento
 * inicial escolhido por cada usuário.
 *
 * É preferência do USUÁRIO, e não do Perfil de Acesso: por isso a coleção é
 * indexada pelo `user.id`, e vários usuários podem usar o mesmo navegador sem
 * sobrescrever a escolha uns dos outros.
 *
 * Preferência mockada, e não regra de segurança: o que está gravado aqui só
 * escolhe por onde o portal começa, dentro do que o usuário JÁ pode abrir. Quem
 * decide o acesso continua sendo `accessControl`, pelo par
 * `departmentId + pageKey`, e a validação do valor gravado acontece a cada
 * leitura, em `lib/homeNavigation`.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * anterior, editado à mão ou truncado. A leitura nunca lança e nunca devolve
 * algo fora de forma; a escrita nunca derruba a sessão quando falha.
 */

/** Mesmo padrão de nomenclatura das demais chaves do portal. */
export const HOME_DEPARTMENT_STORAGE_KEY = 'impacto-bi.home-department'

/** Departamento inicial escolhido, indexado pelo id técnico do usuário. */
export type HomeDepartmentPreferences = Readonly<Record<string, string>>

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Escolhas gravadas, ou coleção vazia.
 *
 * Chave ausente, JSON inválido, conteúdo que não é objeto e armazenamento
 * indisponível devolvem uma coleção vazia: nenhum desses casos é erro para quem
 * chama, porque a ausência de preferência é um estado normal e o portal já sabe
 * escolher o primeiro departamento permitido.
 *
 * Entradas fora de forma são descartadas uma a uma, e não a coleção inteira: o
 * registro estragado de um usuário não pode apagar a escolha válida dos outros.
 * Nada é reescrito por uma leitura.
 */
export function readStoredHomeDepartments(): HomeDepartmentPreferences {
  const storage = getStorage()
  if (!storage) return {}

  try {
    const raw = storage.getItem(HOME_DEPARTMENT_STORAGE_KEY)
    if (raw === null) return {}

    const parsed: unknown = JSON.parse(raw)
    if (!isPlainObject(parsed)) return {}

    const preferences: Record<string, string> = {}

    for (const [userId, departmentId] of Object.entries(parsed)) {
      if (!isNonEmptyString(userId) || !isNonEmptyString(departmentId)) continue

      preferences[userId] = departmentId
    }

    return preferences
  } catch {
    return {}
  }
}

/**
 * Coleção sem a escolha do usuário informado, preservando as dos demais.
 *
 * Função pura, e é ela que dá o descarte definitivo: uma escolha que deixou de
 * ser permitida some do estado e da persistência, em vez de continuar gravada e
 * voltar a valer sozinha caso o departamento seja concedido de novo mais tarde.
 *
 * Devolve a MESMA referência quando não há nada a remover. É o que permite a
 * quem chama não atualizar estado à toa, e é o que impede ciclo de renderização
 * quando a remoção é disparada por um efeito.
 */
export function withoutHomeDepartment(
  preferences: HomeDepartmentPreferences,
  userId: string,
): HomeDepartmentPreferences {
  if (!Object.prototype.hasOwnProperty.call(preferences, userId)) return preferences

  const next: Record<string, string> = {}

  for (const [id, departmentId] of Object.entries(preferences)) {
    if (id === userId) continue

    next[id] = departmentId
  }

  return next
}

/**
 * Grava a coleção inteira. Devolve false quando o armazenamento recusa (quota,
 * modo privado, indisponível), sem lançar: a escolha continua valendo durante a
 * sessão mesmo sem persistência, como já acontece com o tema e com a sidebar.
 */
export function writeStoredHomeDepartments(preferences: HomeDepartmentPreferences): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(HOME_DEPARTMENT_STORAGE_KEY, JSON.stringify(preferences))

    return true
  } catch {
    return false
  }
}
