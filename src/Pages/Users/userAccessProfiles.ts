import { biAreas, type BiArea } from '../../config/biAreas'
import type { User } from '../../data/dashboardTypes'
import { isAccessProfileAssignableToUserProfile } from '../../lib/accessProfileRules'
import { storedAccessProfileId } from '../../services/accessProfiles/accessProfileAssignment'
import type { AccessProfile, UserProfile } from '../../types/access'
import {
  describeProfileDepartments,
  type PreviewDepartment,
} from '../AccessProfilesPreview/accessProfilesPreviewModel'

/**
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
 */

/* -------------------------------------------------------------------------- */
/* Estado de leitura                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Estado de quem não tem vínculo válido com nenhum Perfil de Acesso.
 *
 * Não é um perfil: não aparece nas opções do seletor e não é gravado. Descreve
 * uma situação que bloqueia a entrada no portal, e por isso é afirmativa, e não
 * uma reticência.
 */
export const UNPROFILED_ACCESS_LABEL = 'Sem Perfil de Acesso'

/* -------------------------------------------------------------------------- */
/* Opções do seletor                                                          */
/* -------------------------------------------------------------------------- */

/** Perfil de Acesso como o seletor e a tabela precisam dele. */
export type AccessProfileOption = {
  /** Id técnico real do perfil, o mesmo do domínio. */
  id: string
  /** Nome oficial exibido. */
  name: string
  /**
   * Rótulos oficiais dos departamentos concedidos, na ordem do catálogo.
   *
   * São nomes de departamento, e não páginas nem ids técnicos: é o que responde
   * "o que este perfil libera" em uma linha, sem transformar o seletor em uma
   * lista de permissões. A ordem é a de `biAreas`, a mesma da navegação, para o
   * texto não depender de como as concessões foram gravadas.
   */
  departmentLabels: string[]
  /** Cobertura oficial usada pelos labels e respectivos tooltips. */
  departments: PreviewDepartment[]
}

const areaById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))

/** Departamentos concedidos pelo perfil, na ordem do catálogo. */
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

/**
 * Opções que aquele Perfil do Sistema pode receber, na ordem da coleção.
 *
 * O filtro é a regra do domínio, e não uma comparação escrita aqui: somente
 * perfis ATIVOS e com o destino correspondente. É por isso que o Administrador vê
 * exatamente uma opção, `Acesso do Sistema`, e que um perfil de Executivo nunca
 * aparece para um Analista.
 */
export function accessProfileOptionsFor(
  profiles: readonly AccessProfile[],
  systemProfile: UserProfile,
): AccessProfileOption[] {
  return profiles
    .filter((profile) => isAccessProfileAssignableToUserProfile(profile, systemProfile))
    .map(toAccessProfileOption)
}

/** Opção correspondente ao id, ou null quando ele não está entre as oferecidas. */
export function findAccessProfileOption(
  options: readonly AccessProfileOption[],
  id: string | null,
): AccessProfileOption | null {
  if (id === null) return null

  return options.find((option) => option.id === id) ?? null
}

/**
 * Perfil de Acesso definido automaticamente pelo Perfil do Sistema, ou null
 * quando ele é escolhido.
 *
 * Só o Administrador tem um: ele recebe exclusivamente o `Acesso do Sistema`, e
 * como esse é o único perfil compatível com ele, a lista de compatíveis com
 * exatamente um item É a definição automática. Nenhum id é escrito aqui, e
 * nenhuma exceção é declarada: Executivos e Analistas têm mais de uma opção e
 * escolhem.
 */
export function automaticAccessProfileOption(
  options: readonly AccessProfileOption[],
  systemProfile: UserProfile,
): AccessProfileOption | null {
  if (systemProfile !== 'Administrador') return null

  return options.length === 1 ? options[0] : null
}

/* -------------------------------------------------------------------------- */
/* Rascunho do seletor                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Escolha aceita pelo seletor diante das opções atuais.
 *
 * Todo valor que entra no rascunho passa por aqui, e o que não for uma opção
 * oferecida vira null. É o que limpa a seleção ao trocar o Perfil do Sistema: um
 * perfil de Analista deixa de existir na lista do Executivo, e mantê-lo no estado
 * faria o `select` exibir a primeira opção como se ela tivesse sido escolhida,
 * enquanto o salvamento recusaria por incompatibilidade logo depois.
 *
 * Vale também para o perfil automático: quando ele existe, é ele o valor, porque
 * o Administrador não escolhe.
 */
export function accessProfileDraftFor(
  options: readonly AccessProfileOption[],
  systemProfile: UserProfile,
  selectedId: string | null,
): string | null {
  const automatic = automaticAccessProfileOption(options, systemProfile)
  if (automatic) return automatic.id

  return findAccessProfileOption(options, selectedId)?.id ?? null
}

/* -------------------------------------------------------------------------- */
/* Leitura do vínculo gravado                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Perfil de Acesso que o usuário tem hoje, ou null.
 *
 * O vínculo gravado sozinho não prova nada: um id pode apontar para um perfil
 * excluído, desativado ou de outro destino. Por isso ele é sempre confrontado
 * com a coleção real, e só devolve uma opção quando o perfil existe e continua
 * servindo àquele Perfil do Sistema.
 */
export function userAccessProfileOption(
  user: User,
  profiles: readonly AccessProfile[],
): AccessProfileOption | null {
  const linkedId = storedAccessProfileId(user)
  if (linkedId === null) return null

  const profile = profiles.find((candidate) => candidate.id === linkedId)
  if (!profile) return null
  if (!isAccessProfileAssignableToUserProfile(profile, user.profile)) return null

  return toAccessProfileOption(profile)
}

/** Nome exibido na tabela, ou o estado de quem não tem Perfil de Acesso válido. */
export function userAccessProfileLabel(
  user: User,
  profiles: readonly AccessProfile[],
): string {
  return userAccessProfileOption(user, profiles)?.name ?? UNPROFILED_ACCESS_LABEL
}

/** Escolha com que o seletor abre na edição; null na criação e sem vínculo válido. */
export function initialAccessProfileId(
  user: User | null,
  profiles: readonly AccessProfile[],
): string | null {
  if (!user) return null

  return userAccessProfileOption(user, profiles)?.id ?? null
}

/* -------------------------------------------------------------------------- */
/* Conteúdo do campo selecionado                                              */
/* -------------------------------------------------------------------------- */

/** Separador dos departamentos, o mesmo ponto médio já usado nas telas de perfis. */
const DEPARTMENT_SEPARATOR = ' · '

export type AccessProfileSummary = {
  /** Nome oficial do perfil. */
  name: string
  /** Departamentos concedidos em uma linha, ou o aviso de que não há nenhum. */
  departments: string
}

/**
 * Conteúdo apresentado para o perfil SELECIONADO: o nome e os departamentos que
 * ele concede.
 *
 * Sem perfil selecionado devolve null, e a tela não exibe nada: um resumo vazio
 * ocuparia espaço para dizer que ainda não há o que dizer.
 *
 * Só rótulos oficiais de departamento entram. Ids técnicos e listas de páginas
 * ficam de fora de propósito: quem escolhe um Perfil de Acesso decide por área, e
 * a página a página está na tela Perfis de acesso.
 */
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

/* -------------------------------------------------------------------------- */
/* Recusa do formulário                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Por que o formulário ainda não tem um Perfil de Acesso válido para gravar.
 *
 * `unavailable` é a coleção que não pôde ser lida, e não uma coleção vazia: sem
 * saber quais perfis existem, o formulário não tem como oferecer escolha nenhuma
 * e não pode afirmar que a escolha feita é inválida.
 */
export type AccessProfileSelectionFailureReason = 'required' | 'unknown' | 'unavailable'

export type AccessProfileSelectionState =
  | { ok: true; option: AccessProfileOption }
  | { ok: false; reason: AccessProfileSelectionFailureReason }

/**
 * Estado da escolha do Perfil de Acesso, e é ele que habilita o botão Salvar.
 *
 * A validação NÃO é `accessProfileId !== null`. O id é confrontado com as opções
 * oferecidas, que já são o recorte do domínio: somente perfis existentes, ativos
 * e compatíveis com o Perfil do Sistema em vigor no formulário. Um id que
 * apontava para um perfil desativado, excluído ou de outro destino cai em
 * `unknown` e mantém o salvamento bloqueado, em vez de seguir para o repositório
 * e voltar como erro depois do clique.
 */
export function checkAccessProfileSelection(
  options: readonly AccessProfileOption[],
  selectedId: string | null,
  profilesAvailable: boolean,
): AccessProfileSelectionState {
  if (!profilesAvailable) return { ok: false, reason: 'unavailable' }
  if (selectedId === null) return { ok: false, reason: 'required' }

  const option = findAccessProfileOption(options, selectedId)

  return option ? { ok: true, option } : { ok: false, reason: 'unknown' }
}
