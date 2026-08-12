/**
 * Domínio Comercial.
 *
 * Tipos próprios do Comercial, separados por construção do domínio de Ordens de
 * Serviço (`dashboardTypes`). Nenhum tipo é compartilhado entre os dois: uma
 * venda não é uma OS, e misturar os dois modelos faria um filtro de OS decidir
 * meta comercial.
 *
 * A granularidade é o fato individual: cada venda é um registro com criador,
 * indicação, cidade, canal, status e as três datas que o SGI distingue. Nenhum
 * indicador desta página parte de total mensal pré-agregado — todos derivam
 * destes fatos.
 */

/** Mês do período mockado, no formato `AAAA-MM`. */
export type CommercialMonthKey =
  | '2026-01'
  | '2026-02'
  | '2026-03'
  | '2026-04'
  | '2026-05'
  | '2026-06'
  | '2026-07'

/** Cidades atendidas pela base comercial. */
export type CommercialCityId =
  | 'atibaia'
  | 'piracaia'
  | 'bom-jesus-dos-perdoes'
  | 'joanopolis'
  | 'mairipora'
  | 'terra-preta'

export type CommercialCity = {
  readonly id: CommercialCityId
  readonly name: string
}

/**
 * Segmento do vendedor.
 *
 * `interno` tem meta individual de volume; `corporativo` não tem. A distinção
 * não é cosmética: ela decide quais vendas entram no realizado da meta normal e
 * quais só entram no realizado total usado contra a supermeta.
 */
export type CommercialSegment = 'interno' | 'corporativo'

export type CommercialSeller = {
  readonly id: string
  readonly name: string
  /**
   * Cidade de alocação do vendedor interno, que é o que forma a meta local.
   * `null` no Corporativo, que atua em toda a região: o Corporativo não recebe
   * alocação inventada, e as vendas dele continuam sendo filtradas pela cidade
   * do próprio fato.
   */
  readonly cityId: CommercialCityId | null
  readonly segment: CommercialSegment
  readonly active: boolean
}

/**
 * Colaborador que indica vendas.
 *
 * Não é vendedor: não tem meta própria, não aparece no filtro Vendedor e existe
 * aqui apenas para receber o crédito das vendas indicadas. Anônimo de propósito
 * — esta página mostra somente contribuição agregada, e o código de indicação é
 * inteiramente sintético.
 */
export type CommercialPartner = {
  readonly id: string
  readonly label: string
  readonly indicationCode: string
  readonly cityId: CommercialCityId
}

/**
 * Status da assinatura/contrato, como o SGI os distingue.
 *
 * Somente `ativa` é contabilizada, e ainda assim apenas quando existe data de
 * ativação. Todos os demais existem no mock justamente para provar que ficam
 * fora do realizado.
 */
export type CommercialSaleStatus =
  | 'ativa'
  | 'pendente'
  | 'agendada'
  | 'assinada'
  | 'aguardando-aprovacao'
  | 'reprovada'
  | 'cancelada'
  | 'suspensa'
  | 'expirada'
  | 'bloqueio-administrativo'
  | 'bloqueio-financeiro'
  | 'nao-sincronizada'

/**
 * Canal da venda.
 *
 * São os dois canais com equipe entre janeiro e julho de 2026. PAP (porta a
 * porta) não está aqui porque não possui vendedores nem vendas no período, e
 * porque o tratamento dele nos indicadores ainda não foi decidido: o canal entra
 * neste tipo quando existir regra aprovada dizendo como ele participa da meta e
 * da supermeta.
 */
export type CommercialSalesChannel = 'interno' | 'corporativo'

export type CommercialSale = {
  readonly id: string
  /** Vendedor que registrou a venda. Sem indicação, é ele quem recebe o crédito. */
  readonly creatorId: string
  /** Código de indicação do colaborador, ou `null` quando a venda não foi indicada. */
  readonly indicationCode: string | null
  readonly cityId: CommercialCityId
  readonly channel: CommercialSalesChannel
  readonly status: CommercialSaleStatus
  /** Data de criação. Nunca é usada para atribuir a venda a um mês. */
  readonly createdAt: string
  /** Data da assinatura. Assinar não é ativar: também não atribui a venda a um mês. */
  readonly signedAt: string | null
  /** Data de ativação/início. É a única data que atribui a venda ao dia e ao mês. */
  readonly activatedAt: string | null
}

export type CommercialDataset = {
  /** Data da última atualização da base mockada. */
  readonly referenceDate: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly months: readonly CommercialMonthKey[]
  readonly cities: readonly CommercialCity[]
  readonly sellers: readonly CommercialSeller[]
  readonly partners: readonly CommercialPartner[]
  readonly sales: readonly CommercialSale[]
}

/**
 * Filtros da página Metas e Desempenho.
 *
 * `cityId` nulo significa todas as cidades e `sellerIds` vazio significa todos
 * os vendedores. Os dois convivem: cidade e vendedor são aplicados como
 * interseção real, e nunca um no lugar do outro.
 */
export type CommercialGoalsFilters = {
  readonly month: CommercialMonthKey
  readonly cityId: CommercialCityId | null
  readonly sellerIds: readonly string[]
}