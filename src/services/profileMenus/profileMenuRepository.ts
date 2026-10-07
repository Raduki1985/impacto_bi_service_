// /**
//  * Acesso central à coleção de itens de menu (`profile_menu`), que vive no
//  * `impacto-bi-service`.
//  *
//  * Não existe coleção local, semente nem armazenamento no navegador: a lista da
//  * aba Menu Itens são as linhas de `profile_menu`, e criar, editar e excluir são
//  * chamadas ao serviço. O portal não inventa um item enquanto a resposta não
//  * chega, e não guarda nada quando ela não chega.
//  *
//  * O que o portal decide antes de chamar está em `profileMenuRules`, e o que
//  * acontece aqui é só a coordenação: conferir o rascunho contra a coleção
//  * RECÉM-LIDA, montar o corpo e traduzir qualquer falha em um resultado que a
//  * tela sabe exibir. Nada é lançado para fora.
//  *
//  * Diferente do cadastro de usuários e de perfis, este não grava Histórico: o
//  * Histórico do portal descreve acessos concedidos a pessoas, e um item de menu
//  * é a estrutura que torna a concessão possível, não a concessão.
//  */
//
// import { CoreApiError } from '../../data/api/coreApiClient'
// import { ApiError } from '../apiService'
// import type { CoreProfileMenu, CoreProfileMenuCreate, CoreProfileMenuUpdate } from '../../types/coreApi'
// import { profileMenuService } from './profileMenuService'
// import { fetchProfileMenus } from './profileMenuApi'
// import {
//   checkProfileMenuDraft,
//   type ProfileMenuDraft,
//   type ProfileMenuDraftFailureReason,
// } from './profileMenuRules'
//
// /* -------------------------------------------------------------------------- */
// /* Falha do serviço                                                           */
// /* -------------------------------------------------------------------------- */
//
// /**
//  * Recusa vinda do serviço, ou falha ao falar com ele. Carrega a FRASE, e não um
//  * código, pelo mesmo motivo dos Perfis de Acesso: o serviço explica a própria
//  * recusa (`Chave de menu já cadastrada`, `Menu não encontrado`), e fechá-la em
//  * um código perderia justamente a parte útil.
//  */
// export type ProfileMenuServiceFailure = {
//   ok: false
//   reason: 'service-failure'
//   message: string
// }
//
// function serviceFailure(cause: unknown): ProfileMenuServiceFailure {
//   if (cause instanceof ApiError || cause instanceof CoreApiError) {
//     return { ok: false, reason: 'service-failure', message: cause.message }
//   }
//
//   return {
//     ok: false,
//     reason: 'service-failure',
//     message: 'Falha inesperada ao falar com o serviço do portal.',
//   }
// }
//
// /* -------------------------------------------------------------------------- */
// /* Leitura                                                                    */
// /* -------------------------------------------------------------------------- */
//
// export type ProfileMenuListResult =
//   | { ok: true; menus: CoreProfileMenu[] }
//   | ProfileMenuServiceFailure
//
// /** Coleção plana completa, pais e filhos, na ordem do serviço. */
// export async function loadProfileMenus(): Promise<ProfileMenuListResult> {
//   try {
//     return { ok: true, menus: await fetchProfileMenus() }
//   } catch (cause) {
//     return serviceFailure(cause)
//   }
// }
//
// /* -------------------------------------------------------------------------- */
// /* Gravação                                                                   */
// /* -------------------------------------------------------------------------- */
//
// export type ProfileMenuSaveResult =
//   | { ok: true; menu: CoreProfileMenu }
//   | { ok: false; reason: ProfileMenuDraftFailureReason }
//   | ProfileMenuServiceFailure
//
// /**
//  * Coleção contra a qual o rascunho é conferido.
//  *
//  * É relida a cada gravação, e de propósito: a lista que a tela tem em mãos pode
//  * ter minutos de idade, e conferir a chave duplicada contra ela deixaria passar
//  * uma chave cadastrada em outra aba nesse intervalo. O serviço confere de novo
//  * do lado dele; esta leitura é o que faz a recusa comum chegar com a frase do
//  * portal e apontando o campo.
//  */
// async function currentMenus(): Promise<
//   { ok: true; menus: CoreProfileMenu[] } | ProfileMenuServiceFailure
// > {
//   return loadProfileMenus()
// }
//
// /**
//  * Cadastra um item de menu.
//  *
//  * O item nasce raiz (um "pai") quando `parentId` é null, e filho do item
//  * escolhido quando não é. Não há um segundo campo dizendo qual dos dois: a
//  * escolha do pai É a distinção.
//  *
//  * O ícone vazio é enviado como nulo, que é o que o serviço grava para "sem
//  * ícone".
//  */
// export async function createProfileMenu(draft: ProfileMenuDraft): Promise<ProfileMenuSaveResult> {
//   const collection = await currentMenus()
//   if (!collection.ok) return collection
//
//   const check = checkProfileMenuDraft(draft, collection.menus, null)
//   if (!check.ok) return check
//
//   const payload: CoreProfileMenuCreate = {
//     name: check.input.name,
//     position: check.input.position,
//     menu_id: check.input.menuKey,
//     icon: check.input.icon === '' ? null : check.input.icon,
//     profile_menu_id: check.input.parentId,
//   }
//
//   try {
//     const menu = await profileMenuService.createProfileMenuOnApi(payload)
//     invalidateMenuCatalog()
//
//     return { ok: true, menu }
//   } catch (cause) {
//     return serviceFailure(cause)
//   }
// }
//
// /**
//  * Edita um item de menu.
//  *
//  * `profile_menu_id` vai SEMPRE no corpo, inclusive nulo: o serviço distingue
//  * "não mandei" de "mandei nulo" por `model_fields_set`, e é mandando nulo que se
//  * promove um filho a raiz. Omitir o campo preservaria o pai atual e tornaria a
//  * promoção impossível pela tela.
//  *
//  * O ícone também vai sempre, e como STRING: o serviço trata nulo como "não
//  * alterar" (`if icon is not None`), então limpar o campo exige enviar vazio.
//  */
// export async function updateProfileMenu(
//   id: string,
//   draft: ProfileMenuDraft,
// ): Promise<ProfileMenuSaveResult> {
//   const collection = await currentMenus()
//   if (!collection.ok) return collection
//
//   const check = checkProfileMenuDraft(draft, collection.menus, id)
//   if (!check.ok) return check
//
//   const payload: CoreProfileMenuUpdate = {
//     name: check.input.name,
//     position: check.input.position,
//     menu_id: check.input.menuKey,
//     icon: check.input.icon,
//     profile_menu_id: check.input.parentId,
//   }
//
//   try {
//     const menu = await profileMenuService.updateProfileMenuOnApi(id, payload)
//     invalidateMenuCatalog()
//
//     return { ok: true, menu }
//   } catch (cause) {
//     return serviceFailure(cause)
//   }
// }
//
// export type ProfileMenuDeleteResult = { ok: true } | ProfileMenuServiceFailure
//
// /**
//  * Exclui o item e, por cascata do serviço, os submenus dele e os vínculos
//  * daquele ramo com os Perfis de Acesso.
//  *
//  * Nada é conferido aqui antes: o serviço não recusa a exclusão de um menu em
//  * uso, e fingir uma recusa que ele não faz seria inventar uma regra. Quem
//  * confirma precisa saber o alcance, e é a confirmação da tela que informa
//  * quantos submenus vão junto.
//  */
// export async function deleteProfileMenu(id: string): Promise<ProfileMenuDeleteResult> {
//   try {
//     await profileMenuService.deleteProfileMenuOnApi(id)
//     invalidateMenuCatalog()
//
//     return { ok: true }
//   } catch (cause) {
//     return serviceFailure(cause)
//   }
// }
//
// /**
//  * Descarta o cache de processo da árvore de menus depois de toda gravação.
//  *
//  * `profileMenuService` guarda a árvore enquanto a aba está aberta, porque ela é
//  * consultada em toda leitura e em toda gravação de perfil e quase nunca muda.
//  * "Quase nunca" deixou de valer com esta aba: sem a invalidação, um menu
//  * cadastrado aqui continuaria invisível para o formulário de Perfis de Acesso
//  * até alguém recarregar a página, e a gravação de um perfil recusaria a página
//  * nova dizendo que o serviço não publicou menu para ela.
//  */
// function invalidateMenuCatalog(): void {
//   profileMenuService.clearMenuTreeCache()
// }
//