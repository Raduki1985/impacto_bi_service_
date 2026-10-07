export type UserProfile = 'Administrador' | 'Executivo' | 'Analista'

/**
 * Situação do usuário na tela de Usuários.
 *
 * `Pendente` é quem foi cadastrado e ainda NÃO definiu a senha: a conta existe,
 * o convite de primeiro acesso saiu por e-mail e ninguém entra nela. Vem de
 * `pending` no serviço, que é o estado de entrada de todo cadastro feito pelo
 * portal, e tem uma consequência visível: o botão de ativar/desativar da linha
 * fica desabilitado, porque as duas ações pressupõem uma conta que já entra no
 * portal. Ela sai de `Pendente` sozinha, no instante em que a senha passa a
 * existir.
 *
 * `Inativo` passou a significar SÓ uma coisa: desativado por um Administrador.
 * Antes ele acumulava também o "nunca definiu senha", e a tela tinha de adivinhar
 * de qual dos dois se tratava olhando a validade do convite - um palpite que
 * errava sempre que o convite era reenviado. `blocked`, que o portal não
 * atribui, continua sendo lido como `Inativo`.
 */
export type UserStatus = 'Ativo' | 'Pendente' | 'Inativo'

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
 * no próprio dado, o que já custou duas migrações de base ("Gestor" para
 * "Usuário Departamental" e, depois, "Usuário Departamental" para "Analista").
 * Os rótulos deste domínio vivem separados, em `lib/accessProfileRules`.
 */

/*
 * `AccessProfileKind` e `AccessProfileAudience` existiam aqui e foram REMOVIDOS.
 *
 * Os dois descreviam A QUEM um perfil de acesso servia — `kind` dizia se ele era
 * o perfil automático do portal ou um perfil comum, e o destino dizia se era de
 * Executivos ou de Analistas. Os dois vinham de uma única coluna do serviço,
 * `access.access_profile_system_id`, que foi removida junto com a chave
 * estrangeira composta de `users` que a fazia valer no banco.
 *
 * Um perfil de acesso passou a ser NOME e MENUS, e nada mais. Qualquer usuário
 * pode receber qualquer perfil, e o que ele enxerga são as páginas concedidas.
 * Não há de onde derivar um destino, e inventar um no portal seria afirmar uma
 * regra que o serviço não guarda nem faz cumprir.
 *
 * O que NÃO mudou: `UserProfile` (Administrador, Executivo, Analista) continua
 * sendo o que a PESSOA é, vindo de `users.profile_system_id`. Ele nunca dependeu
 * do perfil de acesso, e continua decidindo o acesso às telas administrativas.
 */

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
 * Conteúdo comum a qualquer perfil de acesso persistido.
 *
 * Guarda somente ids técnicos de departamento e chaves técnicas de página,
 * reaproveitando `DepartmentPageAccess`. Deliberadamente NÃO guarda: rótulos de
 * departamento como vínculo, lista de usuários, contagem de usuários vinculados
 * nem permissões administrativas, que continuam sendo assunto do perfil
 * funcional.
 *
 * Era a base comum das duas formas de perfil que existiam. Hoje é o perfil
 * inteiro: `AccessProfile` é um apelido para ele.
 */
type AccessProfileContent = {
    /** Id técnico permanente, imutável depois da criação. */
    id: string
    /** Nome já normalizado para exibição. */
    name: string
    /** Ausente quando não há descrição; nunca string vazia. */
    description?: string
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
 * Perfil de acesso persistido. Uma forma só.
 *
 * Era uma união discriminada por `kind`, entre o perfil do sistema e o perfil
 * comum. Deixou de ser: o serviço não distingue mais os dois, e toda linha de
 * `access` é um perfil que alguém criou com um nome e uma lista de menus.
 */
export type AccessProfile = AccessProfileContent

/**
 * Perfil em edição, antes de qualquer validação.
 *
 * Carrega apenas os campos que o Administrador preenche, e a página inicial pode
 * estar ausente enquanto o formulário não foi concluído. Criar e editar pedem
 * exatamente os mesmos campos: o destino era o que separava os dois contratos, e
 * ele não existe mais.
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
    /** Excluir: exige nenhum usuário vinculado, transferidos antes para outro perfil. */
    canDelete: boolean
}
