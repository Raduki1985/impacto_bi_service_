import {type BiArea, biAreas} from '../../config/biAreas'
import {departmentPages} from '../../config/departmentPages'
import type {User} from '../../data/dashboardTypes'
import {
    availableDepartmentPageKeys,
    isAccessProfileAssignable,
    normalizeStoredAccessProfileId
} from '../../lib/accessProfileRules'
// Chaves técnicas, e não rótulos: o auxílio de seleção do formulário identifica
// as duas páginas que ficam fora da seleção padrão pelo id do catálogo, para não
// depender do texto exibido em nenhum idioma nem de uma segunda lista própria.
import {INTELLIGENCE_PAGE_KEY, MODEL_PAGE_KEY} from '../../lib/userAccessRules'
import type {AccessProfile, DepartmentPageAccess,} from '../../types/access'
import {pageKeyFromChildMenuId} from '../../services/profileMenus/profileMenuKeys'
import type {CoreProfileMenuTree} from '../../types/coreApi'
import {UserTypes} from "../../types/user/userTypes";
import {AccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";

/**
 * Modelo de apresentação da tela Perfis de Acesso.
 *
 * Camada de apresentação e nada além disso: recebe os Perfis de Acesso reais do
 * repositório e a coleção de usuários, e traduz os dois para o que a tela
 * exibe. Função pura, sem leitura de armazenamento, sem escrita e sem criação
 * de perfil, e por isso testável sem navegador.
 *
 * A identidade dos perfis vem inteira do domínio: id, nome, ciclo de vida e
 * departamentos são os que estão gravados. Esta tela não fabrica mais perfis a
 * partir dos acessos dos usuários, e não existe aqui nenhuma taxonomia paralela
 * de apresentação: o que separa um perfil de outro é o id real e o conteúdo real
 * de `departmentPageAccess`.
 *
 * A correspondência entre usuário e perfil deixou de ser calculada: ela é o
 * VÍNCULO GRAVADO (`accessProfileId`), confrontado com a coleção recebida. Não
 * existe mais comparação de páginas para descobrir a qual perfil alguém
 * pertence, e por isso dois perfis com as mesmas concessões deixaram de ser
 * ambíguos. Esta camada continua somente leitura: nada é gravado aqui.
 *
 * Departamentos, páginas e rótulos vêm exclusivamente dos catálogos oficiais
 * (`biAreas` e `departmentPages`): nenhuma lista paralela é declarada aqui, e
 * nenhuma contagem é escrita à mão.
 */

/* -------------------------------------------------------------------------- */
/* Vocabulário da tela                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Acesso corporativo, modelado só aqui.
 *
 * A rota já existe no catálogo de navegação como contexto global do portal, e
 * não como departamento: ela não está em `departmentPages` e não deve ser
 * forçada para dentro de nenhum departamento. O nome é lido do próprio catálogo
 * a partir da rota oficial, para a tela não manter uma segunda grafia dele.
 */
/*
 * `CORPORATE_ACCESS_PATH`, `CORPORATE_ACCESS_LABEL`, `accessProfileAudienceLabels`
 * e `accessProfileAudienceProfiles` existiam aqui e foram REMOVIDOS.
 *
 * Os dois rótulos traduziam o DESTINO do perfil, que deixou de existir. Os dois
 * do acesso corporativo descreviam a Visão Geral Executiva como algo que um
 * perfil concedia por ser destinado a Executivos — e um perfil de acesso concede
 * exatamente os menus que tem, e nada por consequência de quem o recebe.
 *
 * A Visão Geral Executiva continua funcionando igual: quem a abre é decidido por
 * `usesCorporateHome`, a partir do Perfil do Sistema da PESSOA, em
 * `lib/homeNavigation`. Nada nesta tela participava dessa decisão.
 */

/* -------------------------------------------------------------------------- */
/* Estruturas da tela                                                         */
/* -------------------------------------------------------------------------- */

export type PreviewUser = {
    id: string
    name: string
    email: string
    profile: string
    status: string
}

/**
 * Página concedida, sempre resolvida contra o catálogo.
 *
 * `inDevelopment` traduz o `disabled` do catálogo: a página existe e está
 * concedida, mas ainda não abre. Os dois estados nunca somam no mesmo número.
 */
export type PreviewPage = {
    pageKey: string
    label: string
    inDevelopment: boolean
}

export type AccessProfilePageTotals = {
    available: number
    inDevelopment: number
}

/**
 * Cobertura do perfil dentro de um departamento, que é o que o chip mostra.
 *
 * O denominador é o total de páginas PUBLICADAS do departamento no catálogo, e
 * o numerador é quantas delas o perfil libera. Páginas em desenvolvimento não
 * entram em nenhum dos dois: elas não podem ser abertas, e contá-las descreveria
 * uma cobertura que o portal não entrega hoje.
 */
export type DepartmentCoverage = {
    /** Páginas publicadas que o perfil libera. */
    granted: number
    /** Páginas publicadas que o departamento tem no catálogo. */
    total: number
    /** 0 a 100, sempre finito: um departamento sem página publicada devolve 0. */
    percent: number
    /** `8/10`, exatamente como aparece no chip. */
    fraction: string
    /** Nome acessível completo, para a leitura não depender da cor nem do desenho. */
    accessibleLabel: string
}

/**
 * Página do departamento como o detalhamento de cobertura precisa dela: TODAS
 * as do catálogo, e não apenas as concedidas.
 *
 * É o que permite dizer o que o perfil não libera sem inventar lista nenhuma. Os
 * três estados são mutuamente exclusivos e saem do próprio catálogo:
 *
 * - concedida: o perfil libera e a página abre;
 * - em desenvolvimento: a página existe no portal mas ainda não abre, e por isso
 *   nenhum perfil pode concedê-la;
 * - não liberada: a página abre, mas este perfil não a concede.
 */
export type PreviewCatalogPage = {
    pageKey: string
    label: string
    granted: boolean
    inDevelopment: boolean
}

export type PreviewDepartment = {
    /**
     * Chave do departamento como ela foi CONCEDIDA, e não como o catálogo do
     * portal a escreve.
     *
     * Deixou de ser `BiAreaId` porque um Perfil de Acesso pode conceder um menu
     * que o portal não tem no catálogo: os itens de menu são cadastrados no
     * serviço, com a chave que quem cadastra decidir, e nem todos correspondem a
     * uma página real do front.
     */
    departmentId: string
    label: string
    /** Páginas concedidas neste departamento, na ordem do catálogo. */
    pages: PreviewPage[]
    /** Todas as páginas do departamento, na ordem do catálogo, com o estado de cada uma. */
    catalogPages: PreviewCatalogPage[]
    pageTotals: AccessProfilePageTotals
    coverage: DepartmentCoverage
}

export type PreviewProfile = {
    id: string
    name: string
    description: string
    users: PreviewUser[]
    userCount: number
    departments: PreviewDepartment[]
    departmentCount: number
    pageTotals: AccessProfilePageTotals
}

export type PreviewUnassignedUser = {
    id: string
    name: string
    email: string
    profile: string
}

export type AccessProfilesPreviewModel = {
    /**
     * Acesso do Sistema, quando a coleção recebida o traz.
     *
     * Continua identificado à parte porque as REGRAS dele são diferentes: não é
     * editável, não é excluível e não é atribuível por escolha. O que deixou de
     * ser separado é a APRESENTAÇÃO: a página o exibe como primeiro item da mesma
     * coleção, e é `orderedProfiles` que entrega essa ordem.
     */
    systemProfile: PreviewProfile | null
    /** Perfis comuns, na mesma ordem em que o repositório os devolveu. */
    profiles: PreviewProfile[]
    /**
     * Coleção única exibida pela página: o perfil do sistema primeiro, os comuns
     * na ordem do repositório em seguida.
     *
     * A ordem é decidida aqui, e não na tela, para lista e grade não terem chance
     * de discordar sobre qual perfil vem primeiro.
     */
    orderedProfiles: PreviewProfile[]
    unassignedUsers: PreviewUnassignedUser[]
    /** Perfis comuns exibidos. O perfil do sistema não entra na contagem. */
    profileCount: number
    /** Perfis exibidos na coleção única, com o perfil do sistema incluído. */
    totalProfileCount: number
    /** Usuários distintos que correspondem a um perfil comum. */
    matchedUserCount: number
    /**
     * Usuários distintos que correspondem a QUALQUER perfil exibido, com o
     * Acesso do Sistema incluído.
     *
     * É este o número que o resumo da página mostra, porque a coleção passou a
     * ser única: contar só os perfis comuns deixaria os Administradores de fora
     * de um total que a tela apresenta como o total de correspondências.
     *
     * Distintos, e não a soma dos `userCount` de cada perfil: um usuário
     * corresponde a no máximo um perfil, e somar por perfil daria o mesmo número
     * hoje, mas passaria a mentir no dia em que a correspondência deixasse de ser
     * exclusiva.
     */
    totalMatchedUserCount: number
    /**
     * Quantos estão sem Perfil de Acesso agora.
     *
     * Deixou de ser exibido como indicador do resumo em 21/09/2026, e continua aqui
     * porque descreve a base: é ele que fecha a conta com `totalMatchedUserCount` e
     * o que os testes usam para provar que ninguém fica fora dos dois grupos. Quem
     * são essas pessoas continua visível na seção do rodapé da página.
     */
    unassignedUserCount: number
    /** Usuários que podem corresponder a perfis comuns: sem Administradores. */
    assignableUsers: PreviewUser[]
}

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                   */
/* -------------------------------------------------------------------------- */

const areaById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/** Área oficial pelo id exato, ou null quando o id não está no catálogo. */
function findArea(departmentId: string): BiArea | null {
    return areaById.get(departmentId) ?? null
}

/** Concessões de um perfil ou de um usuário, tolerante a dado fora de forma. */
function storedAccess(source: { departmentPageAccess?: unknown }): DepartmentPageAccess[] {
    return Array.isArray(source.departmentPageAccess) ? source.departmentPageAccess : []
}

function storedPageKeys(access: DepartmentPageAccess): string[] {
    return Array.isArray(access.pageKeys) ? access.pageKeys : []
}

function countPages(pages: readonly PreviewPage[]): AccessProfilePageTotals {
    return {
        available: pages.filter((page) => !page.inDevelopment).length,
        inDevelopment: pages.filter((page) => page.inDevelopment).length,
    }
}

function sumTotals(departments: readonly PreviewDepartment[]): AccessProfilePageTotals {
    return departments.reduce<AccessProfilePageTotals>(
        (totals, department) => ({
            available: totals.available + department.pageTotals.available,
            inDevelopment: totals.inDevelopment + department.pageTotals.inDevelopment,
        }),
        {available: 0, inDevelopment: 0},
    )
}

/* -------------------------------------------------------------------------- */
/* Cobertura                                                                  */

/* -------------------------------------------------------------------------- */

/**
 * Cobertura de um departamento a partir do que o perfil libera nele.
 *
 * `granted` nunca passa de `total` porque as duas contagens saem da mesma lista
 * do catálogo: chaves desconhecidas e páginas em desenvolvimento ficam de fora
 * dos dois lados, e a duplicata some porque a contagem é sobre as páginas do
 * catálogo, e não sobre as chaves gravadas.
 *
 * Departamento sem nenhuma página publicada devolve `0/0` com 0%, e não uma
 * divisão por zero: o texto acessível diz que não existe página disponível, em
 * vez de sugerir que o perfil deixou de liberar algo.
 */
export function describeDepartmentCoverage(
    area: BiArea,
    grantedKeys: ReadonlySet<string>,
): DepartmentCoverage {
    const availableKeys = availableDepartmentPageKeys(area.id)
    const total = availableKeys.length
    const granted = availableKeys.filter((pageKey) => grantedKeys.has(pageKey)).length

    const percent = total === 0 ? 0 : Math.min(100, Math.max(0, (granted / total) * 100))

    return {
        granted,
        total,
        percent,
        fraction: `${granted}/${total}`,
        accessibleLabel:
            total === 0
                ? `${area.label}: nenhuma página disponível no departamento`
                : `${area.label}: ${granted} de ${total} ${
                    total === 1 ? 'página disponível liberada' : 'páginas disponíveis liberadas'
                }`,
    }
}

/**
 * Página concedida cuja chave o catálogo do portal não nomeia.
 *
 * O rótulo é a própria chave, porque não há outro texto a exibir: o menu foi
 * cadastrado no serviço e o portal não tem uma página com esse nome. Exibir a
 * chave crua é feio, e ainda assim é a única leitura honesta — a alternativa
 * anterior era descartá-la, e um acesso concedido que some da tela não é uma
 * apresentação melhor, é um dado perdido.
 */
function describeUnknownPage(pageKey: string): PreviewCatalogPage {
    return {pageKey, label: pageKey, granted: true, inDevelopment: false}
}

/**
 * Departamento do catálogo, com as páginas concedidas na ordem oficial.
 *
 * As chaves NÃO são mais filtradas pelo catálogo. Uma chave que ele não
 * reconhece entra ao fim da lista, pela função acima: os itens de menu vivem no
 * serviço, e um Perfil de Acesso pode conceder um submenu que não corresponde a
 * página nenhuma do front. Filtrar aqui fazia a concessão desaparecer do card e,
 * pior, da seleção com que o formulário reabre — reeditar o perfil apagava
 * silenciosamente o que a tela não sabia desenhar.
 *
 * A COBERTURA continua sendo só sobre o catálogo: ela responde quanto do portal
 * o perfil libera, e uma chave que não abre página nenhuma não entra nem no
 * numerador nem no denominador dessa conta.
 */
function describeDepartment(area: BiArea, grantedKeys: ReadonlySet<string>): PreviewDepartment {
    // Uma passada só sobre o catálogo: as concedidas são um recorte das do
    // catálogo, e derivar as duas listas da mesma origem impede que elas
    // discordem sobre rótulo ou ordem.
    const knownPages: PreviewCatalogPage[] = departmentPages[area.id].map((page) => ({
        pageKey: page.key,
        label: page.label,
        granted: grantedKeys.has(page.key),
        inDevelopment: page.disabled,
    }))

    const known = new Set(knownPages.map((page) => page.pageKey))
    const catalogPages: PreviewCatalogPage[] = [
        ...knownPages,
        ...[...grantedKeys].filter((pageKey) => !known.has(pageKey)).map(describeUnknownPage),
    ]

    const pages: PreviewPage[] = catalogPages
        .filter((page) => page.granted)
        .map(({pageKey, label, inDevelopment}) => ({pageKey, label, inDevelopment}))

    return {
        departmentId: area.id,
        label: area.label,
        pages,
        catalogPages,
        pageTotals: countPages(pages),
        coverage: describeDepartmentCoverage(area, grantedKeys),
    }
}

/**
 * Departamento concedido cuja chave não é a de nenhuma área do portal.
 *
 * Tudo o que se sabe dele é a chave do menu raiz e as chaves concedidas abaixo
 * dela, e é isso que a tela mostra. A cobertura é `n/n`: não existe catálogo
 * contra o qual medir o que falta, e afirmar `0/0` sugeriria que o perfil
 * deixou de liberar algo.
 */
function describeUnknownDepartment(
    departmentId: string,
    grantedKeys: ReadonlySet<string>,
): PreviewDepartment {
    const catalogPages: PreviewCatalogPage[] = [...grantedKeys].map(describeUnknownPage)
    const pages: PreviewPage[] = catalogPages.map(({pageKey, label, inDevelopment}) => ({
        pageKey,
        label,
        inDevelopment,
    }))

    const total = pages.length

    return {
        departmentId,
        label: departmentId,
        pages,
        catalogPages,
        pageTotals: countPages(pages),
        coverage: {
            granted: total,
            total,
            percent: total === 0 ? 0 : 100,
            fraction: `${total}/${total}`,
            accessibleLabel: `${departmentId}: ${total} ${
                total === 1 ? 'menu liberado' : 'menus liberados'
            } fora do catálogo do portal`,
        },
    }
}

export function describeProfileDepartments(profile: AccessProfileTypes): PreviewDepartment[] {
    const grantedByDepartment = new Map<string, Set<string>>()

    for (const access of storedAccess(profile)) {
        const departmentId = findArea(access.departmentId)?.id ?? access.departmentId

        const keys = grantedByDepartment.get(departmentId) ?? new Set<string>()
        for (const pageKey of storedPageKeys(access)) keys.add(pageKey)
        grantedByDepartment.set(departmentId, keys)
    }

    const known = biAreas.flatMap((area) => {
        const keys = grantedByDepartment.get(area.id)

        return keys ? [describeDepartment(area, keys)] : []
    })

    const unknown = [...grantedByDepartment]
        .filter(([departmentId]) => !findArea(departmentId))
        .map(([departmentId, keys]) => describeUnknownDepartment(departmentId, keys))

    return [...known, ...unknown]
}

function grantKey(departmentId: string, pageKey: string): string {
    return `${departmentId}::${pageKey}`
}

function linkedProfile(
    user: UserTypes,
    profilesById: ReadonlyMap<string, AccessProfileTypes>,
): AccessProfileTypes | null {
    const linkedId = normalizeStoredAccessProfileId(user.accessProfileId)
    if (linkedId === null) return null

    return profilesById.get(linkedId) ?? null
}

function toPreviewUser(user: UserTypes): PreviewUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profileType.code,
        status: user.status,
    }
}

function describeUnassignedUser(user: UserTypes): PreviewUnassignedUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profileType.code,
    }
}

function describeProfile(profile: AccessProfileTypes, members: readonly UserTypes[]): PreviewProfile {
    const departments = describeProfileDepartments(profile)

    return {
        id: profile.id!,
        name: profile.name!,
        description: profile.description ?? '',
        users: members.map(toPreviewUser),
        userCount: members.length,
        departments,
        departmentCount: departments.length,
        pageTotals: sumTotals(departments),
    }
}

export function buildAccessProfilesPreviewModel(input: {
    profiles: readonly AccessProfileTypes[]
    users: readonly UserTypes[]
}): AccessProfilesPreviewModel {
    const {profiles, users} = input

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

    const membersByProfileId = new Map<string, UserTypes[]>()
    const unassignedUsers: PreviewUnassignedUser[] = []

    for (const user of users) {
        const matched = linkedProfile(user, profilesById)

        if (!matched) {
            unassignedUsers.push(describeUnassignedUser(user))
            continue
        }

        const members = membersByProfileId.get(matched.id) ?? []
        members.push(user)
        membersByProfileId.set(matched.id, members)
    }

    const described = profiles.map((profile) =>
        describeProfile(profile, membersByProfileId.get(profile.id) ?? []),
    )

    // Não existe mais perfil do sistema: os dois grupos eram separados pelo TIPO
    // do perfil no serviço, e o tipo saiu de `access`. Toda a coleção é uma lista
    // só, na ordem do serviço, que continua intacta.
    const systemProfiles: PreviewProfile[] = []
    const systemProfile = null
    const standardProfiles = described

    const matchedUserIds = new Set(
        standardProfiles.flatMap((profile) => profile.users.map((user) => user.id)),
    )

    const orderedProfiles = [...systemProfiles, ...standardProfiles]

    const allMatchedUserIds = new Set(
        orderedProfiles.flatMap((profile) => profile.users.map((user) => user.id)),
    )

    return {
        systemProfile,
        profiles: standardProfiles,
        orderedProfiles,
        unassignedUsers,
        profileCount: standardProfiles.length,
        totalProfileCount: orderedProfiles.length,
        matchedUserCount: matchedUserIds.size,
        totalMatchedUserCount: allMatchedUserIds.size,
        unassignedUserCount: unassignedUsers.length,
        // Administrador tem alcance global pelo Perfil do Sistema e não é candidato
        // a um perfil comum.
        assignableUsers: users.filter((user) => user.profile !== 'Administrador').map(toPreviewUser),
    }
}

/* -------------------------------------------------------------------------- */
/* Exclusão de perfil                                                         */

/* -------------------------------------------------------------------------- */

/**
 * Frase que diz se o perfil pode ser excluído agora, e o que fazer quando não
 * pode.
 *
 * Um perfil com gente dentro não é excluído: as pessoas são transferidas antes
 * para outro Perfil de Acesso, e só o perfil vazio sai. A frase carrega as duas
 * coisas, o impedimento e a saída, porque no diálogo ela é o único lugar onde o
 * Administrador descobre o que precisa acontecer primeiro.
 *
 * O número é o de usuários realmente vinculados, e a flexão acompanha a
 * contagem. As três formas são textos aprovados e ficam inteiras aqui, em vez de
 * montadas por concatenação de pedaços: é assim que nenhuma delas sai com
 * concordância errada quando a contagem muda.
 *
 * Mora no modelo de apresentação, e não na tela, porque é texto que precisa ser
 * verificável sem navegador.
 */
export function describeAccessProfileDeletionImpact(userCount: number): string {
    if (userCount === 0) return 'Este perfil não possui usuários vinculados.'

    if (userCount === 1) {
        return 'Este perfil possui 1 usuário. Abra o Perfil de Acesso de destino e marque essa pessoa na aba Usuários: a transferência troca o vínculo sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.'
    }

    return `Este perfil possui ${userCount} usuários. Abra o Perfil de Acesso de destino e marque essas pessoas na aba Usuários: a transferência troca os vínculos de uma vez, sem deixar ninguém sem acesso. Com o perfil vazio, a exclusão é liberada.`
}

/*
 * `UsersByAudience`, `splitUsersByAudience` e `audienceFromSelectedUsers`
 * existiam aqui e foram REMOVIDOS, junto com a aba Usuários do formulário de
 * cadastro que era a única a usá-los.
 *
 * Os três giravam em torno do DESTINO do perfil: o primeiro separava quem podia
 * recebê-lo de quem o destino impedia, e o último descobria o destino pela
 * primeira pessoa marcada. Sem destino não há quem separar — qualquer usuário
 * pode receber qualquer Perfil de Acesso.
 *
 * Quem vincula uma pessoa a um perfil é a tela Usuários.
 */

/**
 * Perfis de Acesso que aquele usuário pode receber hoje.
 *
 * É o que o modal de `Definir perfil` oferece a quem está sem Perfil de Acesso, e
 * a regra é a MESMA do domínio, `isAccessProfileAssignable`: o perfil precisa
 * estar ativo. Nenhuma comparação de texto é escrita aqui, e nenhuma segunda
 * regra nasce nesta camada.
 *
 * Recebia também o Perfil do Sistema da pessoa, e recortava a lista pelo destino
 * do perfil. Não recorta mais: um Perfil de Acesso não se destina a ninguém em
 * particular, e todo mundo vê a mesma lista.
 *
 * Somente leitura: a ordem é a da coleção recebida, e nada é gravado. A gravação
 * revalida tudo de novo, porque a coleção lida pela tela pode ter mudado depois.
 */
export function assignableProfiles(
    profiles: readonly PreviewProfile[],
): PreviewProfile[] {
    return profiles.filter(isAccessProfileAssignable)
}

/**
 * Seleções do formulário sem as que deixaram de ser compatíveis.
 *
 * O mapa de atribuições é a composição visual da tela: id do usuário para id do
 * perfil, `null` quando ele foi retirado de todos, e CHAVE AUSENTE quando ele
 * continua como está hoje. Remover a chave, e não gravar `null`, é o que
 * devolve o usuário à situação original em vez de transformá-lo em alguém sem
 * perfil por causa de uma escolha desfeita no rascunho.
 *
 * Serve aos dois momentos com a mesma regra:
 *
 * - trocar o destino: `keepUserIds` recebe os usuários compatíveis com o destino
 *   novo, e quem não está lá sai da seleção;
 * - cancelar ou fechar a criação: `keepUserIds` vem vazio, e o rascunho inteiro
 *   é limpo.
 *
 * Só mexe em quem aponta para `profileId`: uma seleção feita em outro perfil não
 * é assunto deste formulário e permanece intacta.
 */
export function withoutAssignmentsTo(
    assignments: ReadonlyMap<string, string | null>,
    profileId: string,
    keepUserIds: ReadonlySet<string>,
): Map<string, string | null> {
    const next = new Map(assignments)

    for (const [userId, assignedProfileId] of assignments) {
        if (assignedProfileId !== profileId) continue
        if (keepUserIds.has(userId)) continue

        next.delete(userId)
    }

    return next
}

/* -------------------------------------------------------------------------- */
/* Catálogo para os formulários                                               */
/* -------------------------------------------------------------------------- */

/**
 * Item de menu selecionável na aba Acessos, exatamente como o serviço o publica.
 *
 * `inDevelopment` saiu daqui. Ele vinha do `disabled` do catálogo do portal e
 * desabilitava a caixa de seleção, e isso deixou de fazer sentido quando a lista
 * passou a ser a de `profile_menu` sem crivo nenhum: a maioria dos itens não tem
 * página no portal contra a qual perguntar, e bloquear os poucos que têm seria a
 * mesma regra de catálogo por outro nome.
 */
export type CatalogPage = {
    /** Chave do submenu, já sem o prefixo do pai. */
    pageKey: string
    label: string
}

export type CatalogDepartment = {
    /** Chave do menu raiz (`menu_id`), do jeito que ela foi cadastrada no serviço. */
    departmentId: string
    label: string
    pages: CatalogPage[]
}

/**
 * Chave de uma página dentro da seleção do formulário.
 *
 * O par é indivisível: a mesma chave de página existe em vários departamentos,
 * e sozinha ela não identifica nada.
 */
export function pageSelectionKey(departmentId: string, pageKey: string): string {
    return grantKey(departmentId, pageKey)
}

/*
 * `buildCatalogDepartments` existia aqui e foi REMOVIDA.
 *
 * Ela montava o catálogo oficial do portal (`biAreas` + `departmentPages`) no
 * formato da aba Acessos. Deixou de ser a lista exibida quando a aba passou a
 * percorrer os menus do serviço, e sobrou como CRIVO deles — era ela que dizia
 * quais `menu_id` o portal reconhecia, e tudo o que não reconhecia era
 * descartado da listagem.
 *
 * O crivo foi removido: os itens de menu são cadastrados no serviço, com a chave
 * que quem cadastra decidir, e um item que não corresponde a página nenhuma do
 * front continua sendo um item que um Perfil de Acesso pode conceder. Sem crivo,
 * esta função não tinha mais nenhum consumidor.
 */

/**
 * Catálogo da aba Acessos: os menus que o `impacto-bi-service` publicou em
 * `GET /profile-menus/tree`, TODOS eles.
 *
 * É a única origem da lista, e agora é a origem inteira. O que aparece como menu
 * pai e como menu filho são as linhas reais de `profile_menu`, que são as mesmas
 * que viram `menu_ids` na gravação — e é por isso que qualquer uma delas pode ser
 * marcada: `resolveMenuIds` casa a concessão com o menu pela mesma chave que esta
 * função leu, sem consultar catálogo nenhum.
 *
 * ## O crivo do catálogo local saiu
 *
 * Um menu raiz cujo `menu_id` não fosse um departamento de `biAreas`, e um
 * submenu cuja chave não fosse uma página de `departmentPages`, eram
 * DESCARTADOS, e um departamento sem nenhum filho reconhecido sumia junto. Na
 * prática isso obrigava quem cadastra um item de menu a escolher a chave dentro
 * de uma lista fixa do front, sob pena de o item existir no serviço e não
 * aparecer em lugar nenhum do formulário de Perfil de Acesso.
 *
 * Os itens de menu são cadastrados no serviço, e a chave é de quem cadastra. Um
 * item que não corresponde a uma página construída no portal é um item que ainda
 * assim pode ser concedido: ele pode ser a página da semana que vem, ou um menu
 * que só o serviço usa. Quem decide é o Administrador, e não o catálogo.
 *
 * Nada aqui é inventado nem traduzido: o serviço decide QUAIS itens existem, em
 * QUE ORDEM e COM QUAL NOME. O rótulo é o `name` gravado, e cai na própria chave
 * quando o nome está em branco — um registro incompleto aparece nomeado pela
 * chave, e não como uma linha vazia.
 *
 * A chave do submenu é lida na convenção de `profileMenuKeys`, tirando o prefixo
 * do pai quando ele está lá (`os.overview` vira `overview`). É leitura, e não
 * exigência: um filho gravado sem prefixo vale como está.
 *
 * Um menu raiz sem nenhum filho aparece, e aparece vazio. Ele existe no serviço,
 * e escondê-lo faria o Administrador procurar na aba Acessos um item que acabou
 * de cadastrar em Menu Itens.
 *
 * Devolve lista vazia só quando o serviço não publicou menu nenhum.
 */
export function catalogFromProfileMenuTree(
    tree: readonly CoreProfileMenuTree[],
): CatalogDepartment[] {
    return [...tree]
        .sort((a, b) => a.position - b.position)
        .map((root) => ({
            departmentId: root.menu_id,
            label: root.name.trim() || root.menu_id,
            pages: [...root.children]
                .sort((a, b) => a.position - b.position)
                .map((child) => ({
                    pageKey: pageKeyFromChildMenuId(root.menu_id, child.menu_id),
                    label: child.name.trim() || child.menu_id,
                })),
        }))
}

/** Seleção inicial do formulário a partir do que o perfil concede hoje. */
export function selectionFromDepartments(departments: readonly PreviewDepartment[]): Set<string> {
    return new Set(
        departments.flatMap((department) =>
            department.pages.map((page) => pageSelectionKey(department.departmentId, page.pageKey)),
        ),
    )
}

/* -------------------------------------------------------------------------- */
/* Seleção padrão de um departamento no formulário                            */
/* -------------------------------------------------------------------------- */

/**
 * Páginas que a seleção padrão do formulário NÃO marca.
 *
 * `Inteligência (IA)` é uma evolução futura do portal, e `Modelo Dimensional` é
 * conteúdo técnico: as duas existem, abrem e continuam selecionáveis à mão, mas
 * nenhuma delas entra em um perfil novo por conveniência. Concedê-las é uma
 * decisão, e uma decisão não vem embutida em um botão de atalho.
 *
 * São as CHAVES TÉCNICAS do catálogo, importadas do domínio: o comportamento não
 * depende dos rótulos exibidos, que podem mudar sem mudar a regra.
 *
 * O alcance é este auxílio de seleção, e nada além dele. `defaultDepartmentPageKeys`,
 * as concessões já gravadas, os perfis iniciais e a evolução dos usuários
 * persistidos continuam exatamente como estão: nada aqui reescreve nem retira
 * acesso de ninguém.
 */
export const NON_DEFAULT_SELECTION_PAGE_KEYS: readonly string[] = [
    INTELLIGENCE_PAGE_KEY,
    MODEL_PAGE_KEY,
]

/**
 * Chaves de seleção que o atalho de páginas padrão marca naquele departamento.
 *
 * Todos os submenus, menos os dois de concessão intencional. O filtro de página
 * em desenvolvimento saiu junto com o crivo do catálogo: não há mais como
 * perguntar isso a respeito de um menu do serviço, e o atalho marca o que a
 * pessoa marcaria clicando item por item.
 */
export function defaultSelectionKeysOf(department: CatalogDepartment): string[] {
    return department.pages
        .filter((page) => !NON_DEFAULT_SELECTION_PAGE_KEYS.includes(page.pageKey))
        .map((page) => pageSelectionKey(department.departmentId, page.pageKey))
}

/** Todas as chaves de seleção do departamento, inclusive as de concessão intencional. */
function allSelectionKeysOf(department: CatalogDepartment): string[] {
    return department.pages.map((page) =>
        pageSelectionKey(department.departmentId, page.pageKey),
    )
}

/**
 * Situação do departamento diante do atalho de páginas padrão.
 *
 * - `empty`: nenhuma página daquele departamento está marcada;
 * - `complete`: todas as páginas padrão estão marcadas;
 * - `partial`: existe marcação, mas falta alguma página padrão.
 *
 * Um departamento com IA marcada e mais nada é `partial`, e não `empty`: existe
 * concessão ali. Um departamento com todas as padrão e também IA continua
 * `complete`, porque o atalho já entregou tudo o que se propõe a entregar.
 */
export type DepartmentSelectionState = 'empty' | 'partial' | 'complete'

export function describeDepartmentSelectionState(
    department: CatalogDepartment,
    selection: ReadonlySet<string>,
): DepartmentSelectionState {
    const all = allSelectionKeysOf(department)
    if (!all.some((key) => selection.has(key))) return 'empty'

    const defaults = defaultSelectionKeysOf(department)

    return defaults.length > 0 && defaults.every((key) => selection.has(key)) ? 'complete' : 'partial'
}

/**
 * Seleção com as páginas padrão daquele departamento acrescentadas.
 *
 * ACRESCENTA, e não substitui: uma escolha manual de IA ou de Modelo Dimensional
 * feita antes continua valendo, porque o atalho existe para poupar cliques e não
 * para desfazer decisões. Nenhum outro departamento é tocado, e a seleção recebida
 * não é alterada.
 */
export function withDepartmentDefaultPages(
    selection: ReadonlySet<string>,
    department: CatalogDepartment,
): Set<string> {
    const next = new Set(selection)

    for (const key of defaultSelectionKeysOf(department)) next.add(key)

    return next
}

/**
 * Seleção sem nenhuma página daquele departamento.
 *
 * Limpa o departamento inteiro, inclusive IA e Modelo Dimensional: é a volta ao
 * estado em que ele não concede nada. Os demais departamentos permanecem
 * exatamente como estavam.
 */
export function withoutDepartmentPages(
    selection: ReadonlySet<string>,
    department: CatalogDepartment,
): Set<string> {
    const next = new Set(selection)

    for (const page of department.pages) {
        next.delete(pageSelectionKey(department.departmentId, page.pageKey))
    }

    return next
}

/**
 * Resumo da seleção do formulário.
 *
 * `inDevelopmentPageCount` saiu com o estado que o alimentava: a aba lista menus
 * do serviço, e nenhum deles é "em desenvolvimento" — isso era uma propriedade
 * das páginas do portal.
 */
export type CatalogSelectionSummary = {
    departmentCount: number
    pageCount: number
}

export function summarizeCatalogSelection(
    catalog: readonly CatalogDepartment[],
    selection: ReadonlySet<string>,
): CatalogSelectionSummary {
    let departmentCount = 0
    let pageCount = 0

    for (const department of catalog) {
        const selected = department.pages.filter((page) =>
            selection.has(pageSelectionKey(department.departmentId, page.pageKey)),
        )

        if (selected.length === 0) continue

        departmentCount += 1
        pageCount += selected.length
    }

    return {departmentCount, pageCount}
}
