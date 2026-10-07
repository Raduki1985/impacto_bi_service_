// import type { ProfileMenuDraftFailureReason } from '../../services/profileMenus/profileMenuRules'
//
// /**
//  * Mensagem de cada recusa que o PORTAL confere, na linguagem do Administrador e
//  * apontando o campo a corrigir.
//  *
//  * Mora em um módulo próprio, e não junto do formulário, porque a MESMA recusa
//  * chega por dois caminhos: o formulário confere o rascunho a cada tecla, para
//  * manter o botão travado, e o repositório confere de novo contra a coleção
//  * recém-lida do serviço, onde uma chave pode ter sido tomada em outra aba nesse
//  * meio-tempo. Duas tabelas divergiriam na primeira alteração de texto.
//  *
//  * As recusas do SERVIÇO não passam por aqui: elas chegam com a frase pronta
//  * (`reason: 'service-failure'`) e são exibidas como vieram.
//  */
// export const draftFailureMessages: Record<ProfileMenuDraftFailureReason, string> = {
//   'invalid-name': 'Informe o nome do item de menu.',
//   'invalid-menu-key': 'Informe a chave do menu.',
//   'menu-key-taken':
//     'Esta chave já está cadastrada em outro item de menu. A chave é única em todo o serviço.',
//   'invalid-position': 'Informe a posição como um número inteiro maior ou igual a zero.',
//   'unknown-parent': 'O menu pai escolhido não existe mais. Atualize a página e escolha outro.',
//   'parent-not-root':
//     'O menu pai precisa ser um item pai. O portal reconhece apenas dois níveis de menu.',
//   'parent-is-self': 'Um item de menu não pode ser pai de si mesmo.',
//   'parent-of-parent':
//     'Este item já tem submenus e por isso só pode existir como item pai. Mova os submenus dele antes de rebaixá-lo.',
// }
//