import { createContext, useContext } from 'react'

import type { UserProfile } from '../../../types/access'

/**
 * Valores em reais da Visão Geral Comercial, escondidos por padrão.
 *
 * Regra do Mário em 28/09/2026:
 *
 * - Administrador e Executivo têm um olho no card Valor Vendas Ativadas, e o
 *   clique nele mostra ou esconde TODOS os R$ da página de uma vez: card,
 *   painéis, rankings, a linha de valor da Evolução mensal, as listas de
 *   contratos e a coluna de valor das planilhas;
 * - Analista não tem o olho e nunca vê o valor;
 * - a página sempre abre com os valores escondidos.
 *
 * ISTO NÃO É SEGURANÇA. O serviço continua mandando o valor ao navegador, e
 * quem souber procurar acha. Esconder de verdade é o serviço não mandar o
 * valor para o Analista, pedido que depende do serviço.
 */

/** O que aparece no lugar de um valor em reais escondido. */
export const HIDDEN_MONEY = 'R$ •••••'

/** Perfis que podem abrir os valores com o olho. */
export function canRevealMoney(profile: UserProfile | null | undefined): boolean {
  return profile === 'Administrador' || profile === 'Executivo'
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
