import { createContext, useContext } from 'react'

/**
 * Valores em reais da Visão Geral Comercial, escondidos por padrão.
 *
 * Regra do Mário em 28/09/2026, revista em 08/10/2026:
 *
 * - todo perfil (Administrador, Executivo e Analista) tem o botão do olho,
 *   "Mostrar valores", na faixa de filtros da página (até 08/10/2026 ficava
 *   no card Valor Vendas Ativadas), e o clique nele mostra ou esconde TODOS
 *   os R$ da página de uma vez: card, painéis, rankings, a linha de valor das Vendas
 *   ativadas por mês, as listas de contratos e a coluna de valor das
 *   planilhas. Até 08/10/2026 o Analista não tinha o olho; o Mário reviu,
 *   porque os gestores que usam o perfil Analista precisam ver o valor;
 * - o ticket médio NÃO entra no olho: fica sempre à vista, para todos;
 * - a página sempre abre com os valores escondidos.
 *
 * Com o ticket e a quantidade de ativações à vista, o total se calcula de
 * cabeça: o olho protege a tela (projetor, reunião), não o acesso.
 *
 * ISTO NÃO É SEGURANÇA. O serviço continua mandando o valor ao navegador, e
 * quem souber procurar acha. Desde 08/10/2026 todo perfil pode abrir o valor,
 * então não há perfil de quem escondê-lo de verdade: o olho é só proteção de
 * tela.
 */

/** O que aparece no lugar de um valor em reais escondido. */
export const HIDDEN_MONEY = 'R$ •••••'

/** Perfis que podem abrir os valores com o olho: os três do portal (08/10/2026). */
export function canRevealMoney(profileCode: string | null | undefined): boolean {
  return profileCode === 'adm' || profileCode === 'executive' || profileCode === 'analyst'
}

/** O texto do valor, ou a máscara quando ele está escondido. */
export function moneyText(text: string, shown: boolean): string {
  return shown ? text : HIDDEN_MONEY
}

/**
 * Se os R$ estão à vista agora. A página é quem decide (perfil e olho) e
 * publica aqui, para painéis, listas e planilhas não receberem a regra de mão
 * em mão. Fora da página, o padrão é escondido.
 */
export const MoneyShownContext = createContext(false)

export function useMoneyShown(): boolean {
  return useContext(MoneyShownContext)
}
