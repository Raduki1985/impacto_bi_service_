export type UserProfile = 'Administrador' | 'Executivo' | 'Usuário Departamental'

export type UserStatus = 'Ativo' | 'Inativo'

export type DepartmentPageAccess = {
  departmentId: string
  pageKeys: string[]
}

export type UserAuditMetadata = {
  createdAt: string
  createdByUserId: string
  createdByName: string
  updatedAt?: string
  updatedByUserId?: string
  updatedByName?: string
  deactivatedAt?: string
  deactivatedByUserId?: string
  deactivatedByName?: string
  reactivatedAt?: string
  reactivatedByUserId?: string
  reactivatedByName?: string
}

/**
 * Perfil de acesso reutilizável.
 *
 * Domínio novo e ainda isolado: descreve o que um usuário pode VISUALIZAR, e é
 * independente do perfil funcional (`UserProfile`), que descreve o que ele pode
 * FAZER. Os dois convivem sem se substituir, e nada aqui é consumido pela
 * aplicação neste momento.
 *
 * Os valores internos são identificadores técnicos estáveis em inglês, e não os
 * rótulos exibidos: `UserProfile` e `UserStatus` gravam o texto de apresentação
 * no próprio dado, o que já custou uma migração de base ("Gestor" para "Usuário
 * Departamental"). Os rótulos deste domínio vivem separados, em
 * `lib/accessProfileRules`.
 */

/**
 * Origem do perfil. `system` é o perfil automático mantido pelo próprio portal,
 * somente leitura em todas as operações; `standard` é o perfil reutilizável
 * criado e mantido pelo Administrador.
 */
export type AccessProfileKind = 'system' | 'standard'

/** Ciclo de vida persistido do perfil. É o único estado gravado. */
export type AccessProfileLifecycle = 'active' | 'inactive'

/**
 * Estado apresentado ao usuário. Sempre calculado a partir do ciclo de vida e
 * das pendências atuais, nunca gravado: um perfil corrigido volta sozinho para
 * `active`, e um perfil desativado continua `inactive` mesmo estando válido.
 */
export type AccessProfileOperationalStatus = 'active' | 'inactive' | 'needs-review'

/**
 * Endereço de uma única página dentro de um departamento.
 *
 * O par é indivisível porque a mesma chave de página (overview, model,
 * intelligence) existe em vários departamentos, e uma delas não identifica nada
 * sozinha. Não substitui `DepartmentPageAccess`, que descreve um conjunto de
 * páginas de um departamento; aqui é sempre uma página só.
 */
export type DepartmentPageReference = {
  departmentId: string
  pageKey: string
}

/**
 * Perfil de acesso persistido.
 *
 * Guarda somente ids técnicos de departamento e chaves técnicas de página,
 * reaproveitando `DepartmentPageAccess`. Deliberadamente NÃO guarda: rótulos de
 * departamento como vínculo, lista de usuários, contagem de usuários vinculados
 * nem permissões administrativas, que continuam sendo assunto do perfil
 * funcional.
 */
export type AccessProfile = {
  /** Id técnico permanente, imutável depois da criação. */
  id: string
  /** Nome já normalizado para exibição. */
  name: string
  /** Ausente quando não há descrição; nunca string vazia. */
  description?: string
  kind: AccessProfileKind
  lifecycle: AccessProfileLifecycle
  /** Departamentos e páginas concedidos. Mesma estrutura usada em `User`. */
  departmentPageAccess: DepartmentPageAccess[]
  /** Página de entrada do perfil, escolhida entre as páginas concedidas. */
  homePage: DepartmentPageReference
  /**
   * true quando o perfil já foi atribuído a algum usuário em algum momento.
   * Indicador do próprio perfil, e não uma contagem de vínculos: quantos e
   * quais usuários o utilizam é pergunta para a coleção de usuários.
   *
   * É irreversível: uma vez true, nunca volta a false, porque a marca registra
   * que o perfil chegou a valer para alguém. É essa marca que impede a exclusão
   * definitivamente, mesmo depois de todos os usuários serem transferidos.
   */
  hasBeenUsed: boolean
}

/**
 * Perfil em edição, antes de qualquer validação.
 *
 * Só existe para perfis comuns: perfis do sistema não são criados nem editados
 * por ninguém. Carrega apenas os campos que o Administrador preenche, e a
 * página inicial pode estar ausente enquanto o formulário não foi concluído.
 */
export type AccessProfileDraft = {
  id: string
  name: string
  description?: string
  departmentPageAccess: DepartmentPageAccess[]
  homePage: DepartmentPageReference | null
}

/** Rascunho aprovado: já normalizado e com a página inicial garantida. */
export type NormalizedAccessProfileDraft = {
  id: string
  name: string
  description?: string
  departmentPageAccess: DepartmentPageAccess[]
  homePage: DepartmentPageReference
}

/**
 * Nome em duas formas: a exibida e a usada para comparar. A chave de comparação
 * existe para que "Suporte  Técnico" e "suporte técnico" sejam reconhecidos
 * como o mesmo nome sem que o texto exibido perca a grafia escolhida.
 */
export type NormalizedAccessProfileName = {
  displayName: string
  comparisonKey: string
}

/** Motivo pelo qual um rascunho de perfil comum foi recusado. */
export type AccessProfileDraftErrorCode =
  | 'invalid-id'
  | 'duplicate-id'
  | 'immutable-id'
  | 'unknown-profile'
  | 'invalid-name'
  | 'duplicate-name'
  | 'no-pages-selected'
  | 'missing-home-page'
  | 'home-page-not-selected'
  | 'home-page-unavailable'
  | 'unknown-department'
  | 'unknown-page'
  | 'disabled-page'

/**
 * Recusa de um rascunho. O código é a identidade da falha; a mensagem é apenas
 * a tradução dele, e a interface pode substituí-la sem interpretar texto livre.
 */
export type AccessProfileDraftError = {
  code: AccessProfileDraftErrorCode
  message: string
  /** Presentes quando a falha é de um item específico da seleção. */
  departmentId?: string
  pageKey?: string
}

/** Resultado da validação: sucesso carrega o rascunho normalizado, recusa carrega todas as falhas. */
export type AccessProfileDraftValidation =
  | {
      ok: true
      draft: NormalizedAccessProfileDraft
    }
  | {
      ok: false
      errors: AccessProfileDraftError[]
    }

/**
 * Pendência de um perfil já existente diante do catálogo atual.
 *
 * Descreve o que o catálogo mudou por baixo de um perfil que já estava gravado,
 * e não um erro de preenchimento. Por isso a normalização preserva o que virou
 * pendência em vez de descartar: um acesso que sumiu em silêncio é um acesso que
 * ninguém revisa.
 */
export type AccessProfileIssueCode =
  | 'home-page-missing-from-catalog'
  | 'home-page-not-granted'
  | 'home-page-disabled'
  | 'department-missing-from-catalog'
  | 'granted-page-missing-from-catalog'
  | 'granted-page-disabled'
  | 'no-pages-granted'
  | 'no-available-page'

/**
 * Pendência estruturada. O código é a identidade estável; os três textos
 * descrevem o problema, a consequência para quem usa o perfil e o que precisa
 * ser feito, para a interface futura não precisar reconstruir nada.
 */
export type AccessProfileIssue = {
  code: AccessProfileIssueCode
  /** O que está errado. */
  reason: string
  /** O que isso causa a quem usa o perfil. */
  impact: string
  /** O que o Administrador precisa fazer. */
  requiredAction: string
  /** Presentes quando a pendência é de um item específico do perfil. */
  departmentId?: string
  pageKey?: string
}

/** Leitura completa de um perfil diante do catálogo atual, em uma única passagem. */
export type AccessProfileEvaluation = {
  issues: AccessProfileIssue[]
  operationalStatus: AccessProfileOperationalStatus
  /** null quando o perfil não tem nenhuma página disponível para abrir. */
  effectiveHomePage: DepartmentPageReference | null
}

/**
 * O que pode ser feito com um perfil agora.
 *
 * Perfil do sistema recusa as quatro operações. Perfil comum é sempre editável
 * e renomeável, mas desativar e excluir dependem do estado atual: do ciclo de
 * vida, de o perfil já ter sido utilizado e de quantos usuários estão
 * vinculados a ele neste momento.
 *
 * Resultado calculado, nunca gravado: a contagem de vínculos vem da coleção de
 * usuários e muda sem que o perfil seja tocado.
 */
export type AccessProfileCapabilities = {
  /** Alterar departamentos, páginas, página inicial e descrição. */
  canEdit: boolean
  /** Alterar o nome. Nunca o id, que é permanente. */
  canRename: boolean
  /** Desativar: exige perfil ativo e nenhum usuário vinculado. */
  canDeactivate: boolean
  /** Excluir: exige perfil nunca utilizado e nenhum usuário vinculado. */
  canDelete: boolean
}
