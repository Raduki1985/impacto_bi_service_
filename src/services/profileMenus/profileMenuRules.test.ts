import { describe, it } from 'vitest'

describe.skip('profileMenuRules', () => {
    it('regras migradas para Pages/MenuItems/menuItemsModel', () => {
    })
})

// import { describe, expect, it } from 'vitest'
//
// import type { CoreProfileMenu } from '../../types/coreApi'
// import {
//   checkProfileMenuDraft,
//   deletionImpactOf,
//   nextPositionFor,
//   parentOptionsFor,
//   type ProfileMenuDraft,
// } from './profileMenuRules'
//
// /**
//  * Regras do cadastro de itens de menu.
//  *
//  * O foco é o que a gravação PRECISA recusar: a chave duplicada, que o serviço
//  * devolveria como 409 depois de uma ida à rede, e o terceiro nível, que o
//  * serviço aceitaria em silêncio e produziria um item invisível para os Perfis
//  * de Acesso.
//  *
//  * Funções puras, sem rede: a coleção é montada à mão, no formato exato que
//  * `GET /profile-menus` devolve.
//  */
//
// function menu(
//   id: string,
//   menuKey: string,
//   position: number,
//   parentId: string | null = null,
// ): CoreProfileMenu {
//   return {
//     id,
//     name: menuKey,
//     position,
//     menu_id: menuKey,
//     icon: null,
//     profile_menu_id: parentId,
//     created_at: '2026-09-23T00:00:00Z',
//     updated_at: '2026-09-23T00:00:00Z',
//   }
// }
//
// const colecao: CoreProfileMenu[] = [
//   menu('uuid-os', 'os', 1),
//   menu('uuid-os-overview', 'overview', 1, 'uuid-os'),
//   menu('uuid-os-model', 'model', 2, 'uuid-os'),
//   menu('uuid-comercial', 'comercial', 2),
// ]
//
// /** Rascunho válido de um item raiz; cada teste altera só o que investiga. */
// const rascunho: ProfileMenuDraft = {
//   name: 'Cobrança',
//   menuKey: 'cobranca',
//   position: '3',
//   icon: 'CircleDollarSign',
//   parentId: null,
// }
//
// describe('pais que um item pode receber', () => {
//   it('oferece apenas as raízes, e nunca um filho', () => {
//     expect(parentOptionsFor(colecao, null).map((item) => item.id)).toEqual([
//       'uuid-os',
//       'uuid-comercial',
//     ])
//   })
//
//   it('tira o próprio item da lista, na edição', () => {
//     expect(parentOptionsFor(colecao, 'uuid-comercial').map((item) => item.id)).toEqual(['uuid-os'])
//   })
//
//   it('não oferece pai nenhum a um item que já tem filhos', () => {
//     // Dar um pai a `os` criaria um neto, que a tradução de acesso do portal não
//     // enxerga: o item existiria no banco sem conceder nada.
//     expect(parentOptionsFor(colecao, 'uuid-os')).toEqual([])
//   })
// })
//
// describe('próxima posição sugerida', () => {
//   it('segue o maior valor entre as raízes', () => {
//     expect(nextPositionFor(colecao, null)).toBe(3)
//   })
//
//   it('segue o maior valor entre os irmãos do pai escolhido', () => {
//     expect(nextPositionFor(colecao, 'uuid-os')).toBe(3)
//   })
//
//   it('começa em 1 quando o pai ainda não tem nenhum filho', () => {
//     expect(nextPositionFor(colecao, 'uuid-comercial')).toBe(1)
//   })
// })
//
// describe('alcance da exclusão', () => {
//   it('conta os submenus que somem junto com o pai', () => {
//     expect(deletionImpactOf(colecao, 'uuid-os')).toEqual({ childCount: 2 })
//   })
//
//   it('não conta nada para uma folha', () => {
//     expect(deletionImpactOf(colecao, 'uuid-os-overview')).toEqual({ childCount: 0 })
//   })
// })
//
// describe('conferência do rascunho', () => {
//   it('aceita um item raiz completo e devolve os campos aparados', () => {
//     const check = checkProfileMenuDraft(
//       { ...rascunho, name: '  Cobrança  ', menuKey: ' cobranca ', icon: ' CircleDollarSign ' },
//       colecao,
//       null,
//     )
//
//     expect(check).toEqual({
//       ok: true,
//       input: {
//         name: 'Cobrança',
//         menuKey: 'cobranca',
//         position: 3,
//         icon: 'CircleDollarSign',
//         parentId: null,
//       },
//     })
//   })
//
//   it('recusa nome em branco', () => {
//     expect(checkProfileMenuDraft({ ...rascunho, name: '   ' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'invalid-name',
//     })
//   })
//
//   it('recusa chave em branco, que é a única forma que o serviço não aceita', () => {
//     expect(checkProfileMenuDraft({ ...rascunho, menuKey: '   ' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'invalid-menu-key',
//     })
//   })
//
//   it('aceita a chave na forma que quem cadastra escrever', () => {
//     // A recusa era por um padrão de caracteres, e ela existia para empurrar a
//     // chave para a forma do catálogo do portal. Não existe mais lista de chaves
//     // aceitas: `menu_id` é uma coluna de texto, e o item pode não corresponder a
//     // nenhuma página construída no front.
//     for (const menuKey of ['ordens de servico', 'Relatório #1', '_interno', '2026/01']) {
//       expect(checkProfileMenuDraft({ ...rascunho, menuKey }, colecao, null)).toEqual({
//         ok: true,
//         input: {
//           name: 'Cobrança',
//           menuKey,
//           position: 3,
//           icon: 'CircleDollarSign',
//           parentId: null,
//         },
//       })
//     }
//   })
//
//   it('recusa chave já cadastrada em outro item', () => {
//     expect(checkProfileMenuDraft({ ...rascunho, menuKey: 'comercial' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'menu-key-taken',
//     })
//   })
//
//   it('deixa o item manter a própria chave na edição', () => {
//     const check = checkProfileMenuDraft({ ...rascunho, menuKey: 'comercial' }, colecao, 'uuid-comercial')
//
//     expect(check.ok).toBe(true)
//   })
//
//   it('recusa posição que não é inteiro', () => {
//     expect(checkProfileMenuDraft({ ...rascunho, position: '2,5' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'invalid-position',
//     })
//   })
//
//   it('recusa posição escrita com sobra, em vez de aproveitar o número da frente', () => {
//     // `parseInt('3abc')` devolveria 3 e gravaria uma posição que ninguém digitou.
//     expect(checkProfileMenuDraft({ ...rascunho, position: '3abc' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'invalid-position',
//     })
//   })
//
//   it('recusa pai que não existe mais na coleção', () => {
//     expect(checkProfileMenuDraft({ ...rascunho, parentId: 'uuid-sumiu' }, colecao, null)).toEqual({
//       ok: false,
//       reason: 'unknown-parent',
//     })
//   })
//
//   it('recusa pai que é ele mesmo um filho', () => {
//     expect(
//       checkProfileMenuDraft({ ...rascunho, parentId: 'uuid-os-overview' }, colecao, null),
//     ).toEqual({ ok: false, reason: 'parent-not-root' })
//   })
//
//   it('recusa o item como pai de si mesmo', () => {
//     expect(
//       checkProfileMenuDraft({ ...rascunho, parentId: 'uuid-comercial' }, colecao, 'uuid-comercial'),
//     ).toEqual({ ok: false, reason: 'parent-is-self' })
//   })
//
//   it('recusa rebaixar a filho um item que já tem filhos', () => {
//     expect(
//       checkProfileMenuDraft({ ...rascunho, parentId: 'uuid-comercial' }, colecao, 'uuid-os'),
//     ).toEqual({ ok: false, reason: 'parent-of-parent' })
//   })
//
//   it('aceita um filho de uma raiz', () => {
//     const check = checkProfileMenuDraft(
//       { ...rascunho, menuKey: 'intelligence', parentId: 'uuid-os' },
//       colecao,
//       null,
//     )
//
//     expect(check).toEqual({
//       ok: true,
//       input: {
//         name: 'Cobrança',
//         menuKey: 'intelligence',
//         position: 3,
//         icon: 'CircleDollarSign',
//         parentId: 'uuid-os',
//       },
//     })
//   })
// })
//