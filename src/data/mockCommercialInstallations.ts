/**
 * Instalações mockadas do Comercial.
 *
 * DADOS SINTÉTICOS. Os valores existem apenas para validar visual, cálculos e
 * estados do indicador `Valor de Instalações`. Nenhum preço, desconto ou
 * condição de pagamento foi extraído do Sales ou do SGI, e a distribuição
 * abaixo NÃO representa o comportamento real da Impacto Telecom.
 *
 * O que veio confirmado do Sales DEV e do SGI, e por isso é reproduzido aqui:
 *
 * - o serviço de instalação tem código externo `00603`, tipo Avulso e
 *   preço-base de R$ 150,00;
 * - existem quantidade, desconto percentual e monetário, valor final e
 *   condição de pagamento;
 * - o Sales permite informar R$ 0,00, isentando a instalação.
 *
 * Três assinaturas recentes foram examinadas no SGI, uma ativa, uma pendente e
 * uma assinada, e nas três o valor final era R$ 0,00 por desconto de 100%.
 * Essa amostra é pequena demais para virar regra: o cenário abaixo mistura
 * cobrança integral, desconto parcial, isenção e ausência de dado justamente
 * para exercitar todos os estados da tela, e não para estimar a operação.
 *
 * Tudo é determinístico: a instalação de uma venda depende apenas do número do
 * identificador dela, então recarregar a aplicação não muda nenhum número.
 *
 * O registro pertence à venda/assinatura. Ordens de Serviço não recebem preço,
 * desconto nem condição de pagamento: o dia em que a OS precisar da instalação,
 * ela consulta por `saleId`.
 */

import type {
  CommercialInstallation,
  CommercialInstallationPaymentTerm,
  CommercialSale,
} from './commercialTypes'

/** Código externo do serviço de instalação, confirmado no Sales e no SGI. */
export const COMMERCIAL_INSTALLATION_SERVICE_CODE = '00603'

/** Nome do serviço no catálogo do Sales. */
export const COMMERCIAL_INSTALLATION_SERVICE_NAME = 'Serviços de instalação'

/** Preço-base do serviço, igual em todas as instalações do mock. */
export const COMMERCIAL_INSTALLATION_BASE_PRICE = 150

type InstallationProfile = {
  /** Valor final cobrado. Nunca maior que o preço-base. */
  readonly finalPrice: number
  /** Condição de pagamento. `null` somente quando o valor final é zero. */
  readonly paymentTerm: CommercialInstallationPaymentTerm | null
}

/**
 * Ciclo determinístico de vinte vendas.
 *
 * `null` significa venda SEM dado de instalação, que é diferente de instalação
 * com valor final zero: a primeira não entra em nenhuma contagem, a segunda é
 * uma isenção apurada.
 *
 * A composição do ciclo é arbitrária e serve só para a validação funcional:
 * seis integrais, cinco com desconto parcial, sete isentas e duas vendas sem
 * dado. As condições de pagamento variam entre as instalações cobradas para
 * que a distribuição por condição tenha mais de uma linha.
 */
const INSTALLATION_CYCLE: readonly (InstallationProfile | null)[] = [
  { finalPrice: 150, paymentTerm: 'avista' },
  { finalPrice: 150, paymentTerm: 'parcelado-2x' },
  { finalPrice: 150, paymentTerm: 'parcelado-3x' },
  { finalPrice: 150, paymentTerm: 'avista' },
  { finalPrice: 150, paymentTerm: 'parcelado-2x' },
  { finalPrice: 120, paymentTerm: 'avista' },
  { finalPrice: 105, paymentTerm: 'parcelado-2x' },
  { finalPrice: 75, paymentTerm: 'parcelado-3x' },
  { finalPrice: 112.5, paymentTerm: 'avista' },
  { finalPrice: 90, paymentTerm: 'parcelado-2x' },
  { finalPrice: 0, paymentTerm: null },
  { finalPrice: 0, paymentTerm: null },
  { finalPrice: 0, paymentTerm: null },
  { finalPrice: 0, paymentTerm: null },
  { finalPrice: 0, paymentTerm: null },
  { finalPrice: 0, paymentTerm: null },
  null,
  { finalPrice: 150, paymentTerm: 'parcelado-3x' },
  { finalPrice: 0, paymentTerm: null },
  null,
]

/** Número final do identificador da venda, que é o que dá a posição no ciclo. */
function sequenceOf(saleId: string): number | null {
  const match = saleId.match(/(\d+)$/)

  return match === null ? null : Number(match[1])
}

/**
 * Instalação de uma venda, ou `null` quando o mock não tem esse dado.
 *
 * Pura e estável: a mesma venda devolve sempre o mesmo registro.
 */
export function commercialInstallationOf(saleId: string): CommercialInstallation | null {
  const sequence = sequenceOf(saleId)
  if (sequence === null) return null

  const profile = INSTALLATION_CYCLE[sequence % INSTALLATION_CYCLE.length]
  if (profile === null) return null

  return {
    saleId,
    serviceCode: COMMERCIAL_INSTALLATION_SERVICE_CODE,
    basePrice: COMMERCIAL_INSTALLATION_BASE_PRICE,
    finalPrice: profile.finalPrice,
    paymentTerm: profile.paymentTerm,
  }
}

/** Instalações de todas as vendas que possuem esse dado no mock. */
export function buildCommercialInstallations(
  sales: readonly CommercialSale[],
): CommercialInstallation[] {
  return sales.flatMap((sale) => {
    const installation = commercialInstallationOf(sale.id)

    return installation === null ? [] : [installation]
  })
}
