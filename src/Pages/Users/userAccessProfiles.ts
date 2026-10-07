/*
import {type BiArea, biAreas} from '../../config/biAreas'
import {isAccessProfileAssignable, normalizeStoredAccessProfileId,} from '../../lib/accessProfileRules'
import {type SystemProfileOption, userProfileFromCode} from '../../services/users/userApiMapper'
import type {AccessProfile, UserProfile} from '../../types/access'
import {describeProfileDepartments, type PreviewDepartment,} from '../AccessProfiles/accessProfilesPreviewModel'
import type {CoreUser} from '../../types/coreApi'
import {UserTypes} from "../../types/user/userTypes";
import {AccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";
import {UNPROFILED_ACCESS_LABEL} from '../../lib/formatters'

/!**
 * Perfis de Acesso na camada de apresentação da página Usuários.
 *
 * Deixou de ser uma tradução provisória. O portal passou a persistir o vínculo
 * entre usuário e Perfil de Acesso (`accessProfileId`), e o acesso expandido é
 * derivado do perfil pelo repositório: esta camada não reconhece mais perfil
 * nenhum a partir dos acessos gravados, não monta identidades locais e não
 * converte perfil em `UserAccessConfig`.
 *
 * O que sobrou é o que uma camada de apresentação deve fazer: transformar os
 * Perfis de Acesso REAIS nas opções do seletor, dizer qual deles um usuário tem
 * hoje e montar o texto que o campo selecionado apresenta.
 *
 * Módulo puro: recebe a coleção por parâmetro, não lê nem grava armazenamento e
 * não muta nada do que recebe. Departamentos e rótulos vêm exclusivamente de
 * `biAreas`, e nenhuma lista paralela é declarada aqui.
 *!/

/!* -------------------------------------------------------------------------- *!/
/!* Estado de leitura                                                          *!/
/!* -------------------------------------------------------------------------- *!/

export {UNPROFILED_ACCESS_LABEL}

/!* -------------------------------------------------------------------------- *!/
/!* Perfil do Sistema                                                          *!/

/!* -------------------------------------------------------------------------- *!/

/!**
 * Perfil do Sistema com que o seletor abre.
 *
 * Na edição é o tipo cujo código corresponde ao perfil gravado do usuário: o
 * usuário vem do serviço já com o `profile` lido, e o catálogo diz qual linha
 * de `profile_types` é aquela. Na criação é o Analista, o mesmo padrão de
 * sempre. Sem correspondência no catálogo (catálogo ainda não carregado, ou
 * vazio), null: o formulário fica sem escolha até o catálogo chegar.
 *!/
export function initialProfileSystemId(
    user: CoreUser | null,
    profileTypes: readonly SystemProfileOption[],
): string | null {
    // O código é a chave estável do tipo de perfil; `name` é texto de exibição e
    // muda de ambiente para ambiente. Na criação, e quando o serviço devolve um
    // código que o portal não lê, o padrão é o Analista, como sempre foi.
    const wanted: UserProfile = userProfileFromCode(user?.profile_type?.code) ?? 'Analista'

    return profileTypes.find((type) => type.profile === wanted)?.id ?? null
}

/!** Leitura do portal para o tipo escolhido, ou null quando o id não está no catálogo. *!/
export function systemProfileOf(
    profileTypes: readonly SystemProfileOption[],
    profileSystemId: string | null,
): UserProfile | null {
    if (profileSystemId === null) return null

    return profileTypes.find((type) => type.id === profileSystemId)?.profile ?? null
}

/!* -------------------------------------------------------------------------- *!/
/!* Opções do seletor                                                          *!/
/!* -------------------------------------------------------------------------- *!/

export type AccessProfileOption = {
    id: string
    name: string
    /!** Rótulos oficiais dos departamentos concedidos, na ordem de `biAreas`. *!/
    departmentLabels: string[]
    departments: PreviewDepartment[]
}

const areaById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

function grantedDepartmentLabels(profile: AccessProfile): string[] {
    const granted = new Set<string>()

    for (const access of Array.isArray(profile.departmentPageAccess)
        ? profile.departmentPageAccess
        : []) {
        if (!access || typeof access.departmentId !== 'string') continue
        if (!Array.isArray(access.pageKeys) || access.pageKeys.length === 0) continue

        const area = areaById.get(access.departmentId)
        if (area) granted.add(area.id)
    }

    return biAreas.filter((area) => granted.has(area.id)).map((area) => area.label)
}

export function toAccessProfileOption(profile: AccessProfile): AccessProfileOption {
    return {
        id: profile.id,
        name: profile.name,
        departmentLabels: grantedDepartmentLabels(profile),
        departments: describeProfileDepartments(profile),
    }
}

/!**
 * Opções que o seletor oferece, na ordem da coleção.
 *
 * O filtro é a regra do domínio, e não uma comparação escrita aqui: somente
 * perfis ATIVOS.
 *
 * O recorte por Perfil do Sistema ACABOU. Ele existia porque cada Perfil de
 * Acesso declarava a quem servia, e o serviço deixou de guardar isso: hoje
 * QUALQUER usuário pode receber QUALQUER perfil, e o Administrador vê a mesma
 * lista que todo mundo. O que a pessoa enxerga são as páginas concedidas.
 *!/
export function accessProfileOptionsFor(
    profiles: readonly AccessProfile[],
): AccessProfileOption[] {
    return profiles.filter(isAccessProfileAssignable).map(toAccessProfileOption)
}

/!** Opção correspondente ao id, ou null quando ele não está entre as oferecidas. *!/
export function findAccessProfileOption(
    options: readonly AccessProfileOption[],
    id: string | null,
): AccessProfileOption | null {
    if (id === null) return null

    return options.find((option) => option.id === id) ?? null
}

/!*
 * `automaticAccessProfileOption` existia aqui e foi REMOVIDA.
 *
 * Ela devolvia o Perfil de Acesso que o Administrador recebia sem escolher: o
 * `Acesso do Sistema` era o único compatível com ele, e uma lista de compatíveis
 * com exatamente um item era a definição automática. Nenhum perfil é mais
 * exclusivo de ninguém, então não há o que definir por conta de quem quer que
 * seja: todo mundo escolhe, inclusive o Administrador.
 *!/

/!* -------------------------------------------------------------------------- *!/
/!* Rascunho do seletor                                                        *!/

/!* -------------------------------------------------------------------------- *!/

/!**
 * Escolha aceita pelo seletor diante das opções atuais.
 *
 * Todo valor que entra no rascunho passa por aqui, e o que não for uma opção
 * oferecida vira null. É o que limpa a seleção ao trocar o Perfil do Sistema: um
 * perfil de Analista deixa de existir na lista do Executivo, e mantê-lo no estado
 * faria o `select` exibir a primeira opção como se ela tivesse sido escolhida,
 * enquanto o salvamento recusaria por incompatibilidade logo depois.
 *
 *!/
export function accessProfileDraftFor(
    options: readonly AccessProfileOption[],
    selectedId: string | null,
): string | null {
    return findAccessProfileOption(options, selectedId)?.id ?? null
}

/!* -------------------------------------------------------------------------- *!/
/!* Leitura do vínculo gravado                                                 *!/

/!* -------------------------------------------------------------------------- *!/

/!**
 * Perfil de Acesso que o usuário tem hoje, ou null.
 *
 * O vínculo gravado sozinho não prova nada: um id pode apontar para um perfil
 * excluído ou desativado. Por isso ele é sempre confrontado com a coleção real,
 * e só devolve uma opção quando o perfil existe e continua ativo.
 *!/
export function userAccessProfileOption(
    user: UserTypes,
    profiles: readonly AccessProfileTypes[],
): AccessProfileOption | null {
    const linkedId = normalizeStoredAccessProfileId(user.accessProfileId)
    if (linkedId === null) return null

    const profile = profiles.find((candidate) => candidate.id === linkedId)
    if (!profile) return null
    if (!isAccessProfileAssignable(profile)) return null

    return toAccessProfileOption(profile)
}

/!** Nome exibido na tabela, ou o estado de quem não tem Perfil de Acesso válido. *!/
export function userAccessProfileLabel(
    user: UserTypes,
    profiles: readonly AccessProfileTypes[],
): string {
    return userAccessProfileOption(user, profiles)?.name ?? UNPROFILED_ACCESS_LABEL
}

/!** Escolha com que o seletor abre na edição; null na criação e sem vínculo válido. *!/
export function initialAccessProfileId(
    user: CoreUser | null,
    profiles: readonly AccessProfile[],
): string | null {
    if (!user) return null

    return userAccessProfileOption(user, profiles)?.id ?? null
}

/!* -------------------------------------------------------------------------- *!/
/!* Conteúdo do campo selecionado                                              *!/
/!* -------------------------------------------------------------------------- *!/

/!** Separador dos departamentos, o mesmo ponto médio já usado nas telas de perfis. *!/
const DEPARTMENT_SEPARATOR = ' · '

export type AccessProfileSummary = {
    /!** Nome oficial do perfil. *!/
    name: string
    /!** Departamentos concedidos em uma linha, ou o aviso de que não há nenhum. *!/
    departments: string
}

/!**
 * Conteúdo apresentado para o perfil SELECIONADO: o nome e os departamentos que
 * ele concede.
 *
 * Sem perfil selecionado devolve null, e a tela não exibe nada: um resumo vazio
 * ocuparia espaço para dizer que ainda não há o que dizer.
 *
 * Só rótulos oficiais de departamento entram. Ids técnicos e listas de páginas
 * ficam de fora de propósito: quem escolhe um Perfil de Acesso decide por área, e
 * a página a página está na tela Perfis de acesso.
 *!/
export function accessProfileSummary(
    option: AccessProfileOption | null,
): AccessProfileSummary | null {
    if (!option) return null

    return {
        name: option.name,
        departments: option.departmentLabels.length
            ? option.departmentLabels.join(DEPARTMENT_SEPARATOR)
            : 'Nenhum departamento concedido',
    }
}

/!* -------------------------------------------------------------------------- *!/
/!* Recusa do formulário                                                       *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * Por que o formulário ainda não tem um Perfil de Acesso válido para gravar.
 *
 * `unavailable` é a coleção que não pôde ser lida, e não uma coleção vazia: sem
 * saber quais perfis existem, o formulário não tem como oferecer escolha nenhuma
 * e não pode afirmar que a escolha feita é inválida.
 *!/
export type AccessProfileSelectionFailureReason = 'required' | 'unknown' | 'unavailable'

export type AccessProfileSelectionState =
    | { ok: true; option: AccessProfileOption }
    | { ok: false; reason: AccessProfileSelectionFailureReason }

/!**
 * Estado da escolha do Perfil de Acesso, e é ele que habilita o botão Salvar.
 *
 * A validação NÃO é `accessProfileId !== null`. O id é confrontado com as opções
 * oferecidas, que já são o recorte do domínio: somente perfis existentes, ativos
 * e compatíveis com o Perfil do Sistema em vigor no formulário. Um id que
 * apontava para um perfil desativado, excluído ou de outro destino cai em
 * `unknown` e mantém o salvamento bloqueado, em vez de seguir para o repositório
 * e voltar como erro depois do clique.
 *!/
export function checkAccessProfileSelection(
    options: readonly AccessProfileOption[],
    selectedId: string | null,
    profilesAvailable: boolean,
): AccessProfileSelectionState {
    if (!profilesAvailable) return {ok: false, reason: 'unavailable'}
    if (selectedId === null) return {ok: false, reason: 'required'}

    const option = findAccessProfileOption(options, selectedId)

    return option ? {ok: true, option} : {ok: false, reason: 'unknown'}
}

*/
