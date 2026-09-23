/**
 * Regras do cadastro de itens de menu (`profile_menu`), sem rede e sem interface.
 *
 * Elas existem em um lugar só porque três consumidores precisam da MESMA
 * resposta: o formulário, que só pode oferecer o que é gravável; o repositório,
 * que recusa antes de chamar o serviço; e a listagem, que monta a hierarquia.
 * Duas cópias divergiriam na primeira mudança, e a divergência apareceria como
 * um campo que oferece algo que a gravação recusa.
 *
 * ## Dois níveis, e não uma árvore livre
 *
 * O serviço aceita qualquer profundidade: `profile_menu_id` aponta para outro
 * menu, e nada impede um neto. O PORTAL, não: a tradução de acesso em
 * `profileMenuApi` lê as raízes como departamentos e os filhos de cada raiz como
 * páginas, e ignora o que estiver abaixo disso. Um neto cadastrado aqui seria um
 * item invisível para os Perfis de Acesso — existiria no banco e não concederia
 * nada.
 *
 * Por isso o pai oferecido é sempre uma RAIZ, e um item que já tem filhos não
 * pode virar filho de ninguém. As duas regras são a mesma decisão vista dos dois
 * lados da relação.
 */

import type { CoreProfileMenu } from '../../types/coreApi'

/** Campos do formulário, ainda como o usuário digitou. */
export type ProfileMenuDraft = {
  name: string
  /** Chave textual (`menu_id`), que é o que liga o menu ao catálogo do portal. */
  menuKey: string
  /** Número de ordenação entre os irmãos. Texto, porque vem de um campo. */
  position: string
  icon: string
  /** UUID do pai, ou null para um item raiz. */
  parentId: string | null
}

/** Rascunho já aparado e conferido, no formato que o serviço aceita. */
export type ProfileMenuInput = {
  name: string
  menuKey: string
  position: number
  /** Vazio significa sem ícone. */
  icon: string
  parentId: string | null
}

/* -------------------------------------------------------------------------- */
/* Hierarquia                                                                 */
/* -------------------------------------------------------------------------- */

/** Itens sem pai, que são os grupos do menu. */
export function rootMenus(menus: readonly CoreProfileMenu[]): CoreProfileMenu[] {
  return menus.filter((menu) => menu.profile_menu_id === null)
}

/** Filhos diretos de um item, na ordem em que o serviço os devolveu. */
export function childrenOf(
  menus: readonly CoreProfileMenu[],
  parentId: string,
): CoreProfileMenu[] {
  return menus.filter((menu) => menu.profile_menu_id === parentId)
}

/** true quando o item tem ao menos um filho, e por isso só pode ser raiz. */
export function hasChildren(menus: readonly CoreProfileMenu[], id: string): boolean {
  return menus.some((menu) => menu.profile_menu_id === id)
}

/**
 * Pais que o item pode receber: as raízes, menos ele próprio.
 *
 * Um item que já tem filhos não recebe pai nenhum, e a lista vem vazia: dar um
 * pai a ele criaria o terceiro nível que o portal não enxerga. A ausência de
 * opções é o que o formulário usa para explicar isso por escrito, em vez de
 * oferecer uma escolha que a gravação recusaria.
 *
 * `editingId` é null na criação, quando não há item a excluir da lista.
 */
export function parentOptionsFor(
  menus: readonly CoreProfileMenu[],
  editingId: string | null,
): CoreProfileMenu[] {
  if (editingId !== null && hasChildren(menus, editingId)) return []

  return rootMenus(menus).filter((menu) => menu.id !== editingId)
}

/**
 * Próxima posição livre entre os irmãos de um pai.
 *
 * Serve ao formulário de criação, que abre com o número já preenchido: a
 * posição é obrigatória no serviço, e obrigar alguém a descobrir qual é a
 * próxima olhando a lista seria trabalho para nada. Ninguém fica preso a ela —
 * o campo continua editável, e o serviço aceita posições repetidas.
 */
export function nextPositionFor(
  menus: readonly CoreProfileMenu[],
  parentId: string | null,
): number {
  const siblings = parentId === null ? rootMenus(menus) : childrenOf(menus, parentId)

  return siblings.reduce((maior, menu) => Math.max(maior, menu.position), 0) + 1
}

/**
 * Itens que somem junto com este, por causa da cascata do serviço.
 *
 * A exclusão de um pai leva os filhos, e é esse número que a confirmação
 * precisa dizer antes de alguém clicar. Só um nível é contado porque só um
 * nível existe, pela regra acima.
 */
export function deletionImpactOf(
  menus: readonly CoreProfileMenu[],
  id: string,
): { childCount: number } {
  return { childCount: childrenOf(menus, id).length }
}

/* -------------------------------------------------------------------------- */
/* Conferência do rascunho                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Recusas que o portal reconhece sozinho, antes de chamar o serviço.
 *
 * Nenhuma delas substitui a conferência de lá: a chave duplicada, por exemplo,
 * também volta como 409 quando alguém cadastra a mesma em outra aba enquanto
 * este formulário está aberto. A conferência aqui existe para a recusa chegar
 * escrita na língua do portal e sem uma ida à rede.
 */
export type ProfileMenuDraftFailureReason =
  | 'invalid-name'
  | 'invalid-menu-key'
  | 'menu-key-taken'
  | 'invalid-position'
  | 'unknown-parent'
  | 'parent-not-root'
  | 'parent-is-self'
  | 'parent-of-parent'

export type ProfileMenuDraftCheck =
  | { ok: true; input: ProfileMenuInput }
  | { ok: false; reason: ProfileMenuDraftFailureReason }

/*
 * `MENU_KEY_PATTERN` existia aqui e foi REMOVIDO.
 *
 * Era uma lista fechada de caracteres (`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`) que, junto
 * das sugestões vindas do catálogo do portal, fazia a chave parecer um valor a
 * ESCOLHER dentro de um conjunto conhecido. Ela não é: `menu_id` é uma coluna de
 * texto do serviço, e quem cadastra o item decide o que escrever nela.
 *
 * O que sobrou é a única exigência que o serviço realmente faz: a chave não pode
 * ser vazia, e é única em `profile_menu`. Nenhuma forma é imposta — nem a
 * convenção `departamento.pagina` de `profileMenuKeys`, que continua sendo o que
 * o portal LÊ para agrupar, e não o que ele obriga a escrever.
 */

/**
 * Confere o rascunho inteiro e devolve o que será enviado, já aparado.
 *
 * A ordem das conferências é a da leitura do formulário, de cima para baixo:
 * assim a primeira recusa apontada é sempre a do campo mais alto que está
 * errado, e quem corrige não precisa descer e subir a cada tentativa.
 *
 * `editingId` é null na criação. Na edição, ele é o que permite ao item manter a
 * própria chave sem que ela conte como duplicada.
 */
export function checkProfileMenuDraft(
  draft: ProfileMenuDraft,
  menus: readonly CoreProfileMenu[],
  editingId: string | null,
): ProfileMenuDraftCheck {
  const name = draft.name.trim()
  if (name === '') return { ok: false, reason: 'invalid-name' }

  // Só a ausência recusa: a chave é obrigatória no serviço. Qualquer texto que
  // sobre depois de aparar as pontas é chave válida.
  const menuKey = draft.menuKey.trim()
  if (menuKey === '') return { ok: false, reason: 'invalid-menu-key' }

  const chaveEmUso = menus.some((menu) => menu.id !== editingId && menu.menu_id === menuKey)
  if (chaveEmUso) return { ok: false, reason: 'menu-key-taken' }

  // `Number` em vez de `parseInt`: `parseInt('3abc')` devolveria 3 e gravaria
  // uma posição que ninguém digitou.
  const position = Number(draft.position.trim())
  if (draft.position.trim() === '' || !Number.isInteger(position) || position < 0) {
    return { ok: false, reason: 'invalid-position' }
  }

  if (draft.parentId !== null) {
    if (draft.parentId === editingId) return { ok: false, reason: 'parent-is-self' }

    const parent = menus.find((menu) => menu.id === draft.parentId)
    if (parent === undefined) return { ok: false, reason: 'unknown-parent' }
    if (parent.profile_menu_id !== null) return { ok: false, reason: 'parent-not-root' }

    if (editingId !== null && hasChildren(menus, editingId)) {
      return { ok: false, reason: 'parent-of-parent' }
    }
  }

  return {
    ok: true,
    input: { name, menuKey, position, icon: draft.icon.trim(), parentId: draft.parentId },
  }
}
