import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  daysInMonth,
  formatIsoAsBrDate,
  isoDateInMonth,
  monthKeyOf,
  monthShortLabel,
} from '../../../data/commercialCalendar'
import { defaultPeriodFor, todayISO, type SourcePeriod } from '../../../data/defaultPeriod'
import { shiftISODate } from '../../../data/isoDate'
import {
  comparisonPeriodRange,
  comparisonText,
  type OverviewComparisonRange,
  type PeriodComparisonText,
} from '../../../data/overviewOsFilters'
import type { PeriodRange } from '../../../data/periodPresets'
import type {
  CommercialCityId,
  CommercialDataset,
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import {
  buildSalesPeriodSnapshot,
  type SalesPeriodFact,
  type SalesPeriodSnapshot,
  type SalesPeriodMetrics,
  type SalesPeriodSellerRank,
  type SalesPeriodTeam,
  type SalesPeriodTeamFilter,
} from '../SalesPeriod/salesPeriodModel'

/**
 * Vendedor como o filtro precisa dele: identificador e nome.
 *
 * É de propósito menor que `CommercialSeller`: o catálogo do serviço manda só
 * estes dois campos, e o seletor não precisa de mais nada. Assim a base local
 * e a API alimentam o mesmo controle sem inventar cidade, segmento nem
 * situação para quem vem do serviço.
 */
export type CommercialSellerOption = {
  readonly id: string
  readonly name: string
}

/**
 * Tipo de cliente da venda: pessoa física ou jurídica.
 *
 * Quem classifica é a fonte, pelo documento do cliente no SGI, e o documento
 * em si nunca chega ao portal. A base sintética não tem o dado, por isso o
 * seletor só funciona ligado ao serviço.
 */
export type CommercialPersonTypeFilter = 'todos' | 'pf' | 'pj'

/** Tipo de cliente como o seletor precisa dele: identificador e rótulo. */
export type CommercialPersonTypeOption = {
  readonly id: Exclude<CommercialPersonTypeFilter, 'todos'>
  readonly name: string
}

export type CommercialOverviewFilters = {
  readonly startDate: string
  readonly endDate: string
  /**
   * Cidades marcadas; lista vazia significa todas. Cidade e vendedor aceitam
   * várias opções desde 02/10/2026, como os campos da Visão Geral de OS: "ou"
   * dentro do campo, "e" entre campos.
   */
  readonly cityIds: readonly CommercialCityId[]
  readonly team: SalesPeriodTeamFilter
  /** Vendedores marcados; lista vazia significa todos os vendedores. */
  readonly sellerIds: readonly string[]
  /**
   * Tipo de cliente selecionado; `todos` soma física e jurídica.
   *
   * Só tem efeito na fonte que classifica o cliente, hoje o serviço de BI: a
   * base sintética ignora o recorte, e por isso a página desabilita o seletor
   * quando o catálogo de tipos não vem.
   */
  readonly personType: CommercialPersonTypeFilter
}

export type OverviewBreakdown = {
  readonly id: string
  readonly label: string
  readonly activeSales: number
  readonly monthlyValue: number
  readonly share: number
}

export type OverviewMonthlyPoint = {
  /**
   * Mês `AAAA-MM`. Texto, e não `CommercialMonthKey`, de propósito: a lista
   * fechada de meses é da base sintética, enquanto o serviço de BI manda os
   * meses da cobertura real do banco (janeiro a setembro em 10/09/2026, e um a
   * mais a cada mês). O adaptador da API valida a forma; a base local continua
   * entregando os meses da lista.
   */
  readonly month: string
  readonly label: string
  readonly commercialSales: number
  readonly corporateSales: number
  /**
   * Vendas ativadas sem time no mês: vendedor sem equipe reconhecida no SGI,
   * ou contrato sem vendedor registrado, o caso de toda venda anterior a
   * junho/2026. Entrou em 17/09/2026 porque, sem ela, o gráfico zerava janeiro
   * a maio e ficava abaixo do card Vendas ativadas nos meses seguintes. É
   * agrupamento provisório: o Mário decide depois o que fazer com a informação.
   */
  readonly unassignedSales: number
  /** Valor mensal ativado somente pelo Comercial naquele mês. */
  readonly commercialValue: number
  /** Valor mensal ativado somente pelo Corporativo naquele mês. */
  readonly corporateValue: number
  /** Valor mensal ativado pelas vendas sem time naquele mês. */
  readonly unassignedValue: number
  /**
   * Soma dos três grupos. Sempre igual a
   * `commercialValue + corporateValue + unassignedValue`.
   */
  readonly monthlyValue: number
}

export type OverviewPlanRank = OverviewBreakdown & { readonly position: number }

/**
 * Uma safra: o que virou cada mês VENDIDO, pela data da venda e a situação de
 * hoje. Painel Safra de vendas por mês, decisão do Mário em 18/09/2026.
 *
 * As cinco parcelas somam `sold`. `activatedLater` junta mês seguinte e mais
 * tarde: em 2026 quase tudo é o mês seguinte (de 0 a 3 por mês vão além), e
 * uma fatia separada só ocuparia legenda. `other` é o que não se encaixa
 * (reprovada, expirada, cortesia), zero na base hoje; viaja para a soma nunca
 * esconder nada e aparece só no tooltip, quando existir.
 *
 * `cancelled` é toda cancelada hoje, antes ou depois de ligar o sinal, e as
 * duas de ativou contam só quem continua cliente (decisão do Mário em
 * 28/09/2026). Até ali era `cancelledBefore`, só a cancelada sem sinal, e a
 * cancelada depois do sinal ficava escondida dentro de ativou.
 *
 * É a régua da data da venda. A Evolução mensal, ao lado, mostra os mesmos
 * meses pela outra régua, o dia do sinal ligado.
 */
export type OverviewCohortPoint = {
  readonly month: string
  readonly label: string
  readonly sold: number
  readonly activatedInMonth: number
  readonly activatedLater: number
  readonly awaiting: number
  readonly cancelled: number
  readonly other: number
}

/**
 * Etapas do card Aguardando Ativação, na ordem em que ele as apresenta.
 *
 * Esta é a ÚNICA lista de etapas da Visão Geral. Ela responde por três coisas
 * ao mesmo tempo: quais contratos entram na composição, em que ordem aparecem
 * e com que rótulo. Não existe uma segunda lista que possa divergir dela.
 *
 * O que o card conta, decisão do Mário em 16/09/2026: contrato VENDIDO no
 * período, pela data da venda, que hoje não está ativo. Três etapas são o
 * fluxo parado (pendente, assinada, agendada) e a quarta é a saída antes de
 * ativar (cancelada sem sinal ligado). `Aguardando aprovação` existe no
 * domínio do SGI mas nunca foi usado (zero em 55 mil contratos em produção,
 * medido em 16/09/2026), então soma em Pendente em vez de ocupar um quadrado
 * que ficaria sempre zerado.
 *
 * São situações atuais, não causas de permanência: o sistema guarda o status
 * de hoje, e nada aqui explica por que o contrato está nele.
 */
export const OVERVIEW_AWAITING_STAGES = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'assinada', label: 'Assinada' },
  { id: 'agendada', label: 'Agendada' },
  { id: 'cancelada', label: 'Cancelada' },
] as const satisfies readonly { id: CommercialSaleStatus; label: string }[]

export type OverviewAwaitingStageId = (typeof OVERVIEW_AWAITING_STAGES)[number]['id']

export type OverviewAwaitingStage = {
  readonly id: OverviewAwaitingStageId
  readonly label: string
  readonly count: number
  /**
   * Participação DENTRO do que aguarda, não sobre o total vendido. É o que dá
   * a largura do segmento na barra: as quatro somam 1 sempre que existe pelo
   * menos um contrato aguardando.
   */
  readonly share: number
  /**
   * Quantos desta etapa têm ordem de instalação aberta, ou seja, visita
   * marcada. É o que a leitura gerencial narra na Agendada (decisão do Mário
   * em 17/09/2026): o fluxo em ações, e não em status.
   *
   * `null` quando a fonte não mede: a base sintética não tem ordem de
   * serviço ligada à venda, e um serviço anterior a este dado não o manda.
   */
  readonly scheduledVisit: number | null
  /**
   * Quantos desta etapa tiveram visita improdutiva e estão sem nova visita
   * marcada, ou seja, precisam reagendar. Disjunto de `scheduledVisit`.
   * `null` pelos mesmos motivos.
   *
   * O que o portal NÃO lê do serviço, de propósito: `stalled`, os contratos
   * "além do prazo normal". Prazo não é assunto deste card (decisão do Mário
   * em 17/09/2026): ele mostra onde a venda está, e tempo é do card Tempo até
   * a ativação. Por isso nada aqui chama contrato de atrasado.
   */
  readonly needsReschedule: number | null
}

/**
 * Contratos vendidos no período que não viraram ativação.
 *
 * A régua é a data da venda, e não a da ativação usada pelos outros cards: é
 * a única forma de responder quanto do que foi vendido ainda não ligou o
 * sinal. `sold` é o total vendido no recorte, o mesmo Total de Vendas do
 * Relatório de Vendas do SGI, e `awaiting` é a soma das quatro etapas.
 *
 * Em mês fechado o número é o que ficou para trás. No mês em andamento ele
 * inclui venda recente que ainda vai ativar no prazo normal, e a leitura do
 * card avisa isso.
 */
export type OverviewAwaitingActivation = {
  /** Contratos vendidos no período, pela data da venda. É o denominador. */
  readonly sold: number
  /** Vendidos que não estão ativos hoje: a soma das etapas. */
  readonly awaiting: number
  /** Sempre as quatro etapas, na ordem de `OVERVIEW_AWAITING_STAGES`. */
  readonly stages: readonly OverviewAwaitingStage[]
}

/**
 * Em que etapa do card um contrato entra, ou `null` quando ele não aguarda.
 *
 * `Aguardando aprovação` soma em Pendente, pelo motivo dito na lista. A
 * cancelada só entra quando nunca ativou: cancelamento depois do sinal ligado
 * é saída da base, assunto da futura página de clientes, e não venda que não
 * aconteceu. Reprovada e expirada ficam de fora: não existem na base de
 * produção, e o card conta o que aguarda, não toda perda.
 */
export function awaitingStageOf(
  status: CommercialSaleStatus,
  activatedAt: string | null,
): OverviewAwaitingStageId | null {
  switch (status) {
    case 'pendente':
    case 'aguardando-aprovacao':
      return 'pendente'
    case 'assinada':
      return 'assinada'
    case 'agendada':
      return 'agendada'
    case 'cancelada':
      return activatedAt === null ? 'cancelada' : null
    default:
      return null
  }
}

/**
 * Composição de clientes das vendas ativadas do recorte.
 *
 * Regra decidida com o Mário em 15/09/2026: cliente é quem comprou, então o
 * indicador nasce da venda e não do cadastro. Cliente novo é aquele cuja venda
 * ativada no recorte é a PRIMEIRA ativação dele na base inteira, medida desde
 * 2019 e não apenas no ano corrente.
 *
 * As três parcelas dividem as mesmas vendas ativadas do recorte e não se
 * sobrepõem, então somam `metrics.activeSales`.
 *
 * Por que a data de cadastro do cliente ficou de fora: ela nasce junto da
 * venda em 91% dos casos, mas erra na virada do mês. Quem foi cadastrado em
 * julho e ligou a internet em agosto é cliente novo de agosto para a página e
 * cliente de julho para o cadastro; em agosto/2026 isso separava 516 de 576
 * clientes. Além disso o cadastro só tem vendedor em 23% dos registros de
 * 2026, o que deixaria o card cego ao filtro de vendedor.
 */
export type OverviewCustomerMix = {
  /** Ativações de quem nunca teve contrato antes. É o número do card. */
  readonly newCustomers: number
  /**
   * Ativações de cliente que já tinha outro contrato ativo na data. É venda
   * dentro da carteira: aumenta receita, não aumenta a base de clientes.
   */
  readonly expansion: number
  /** Ativações de quem já foi cliente, cancelou e retornou. */
  readonly returning: number
  /**
   * Variação dos clientes novos frente ao período anterior comparável. Nula
   * quando não há base anterior, como em qualquer outra comparação da página.
   */
  readonly changeRate: number | null
}

/** Parcela do mix que a frente do card Novos Clientes mostra em bloco. */
export type OverviewCustomerMixPart = {
  readonly id: 'da-base' | 'retornaram'
  /** Rótulo curto do bloco, dimensionado para a metade do card. */
  readonly label: string
  /** Nome por extenso, usado por leitor de tela e na leitura gerencial. */
  readonly accessibleLabel: string
  readonly count: number
  /** Participação da parcela nas vendas ativadas do recorte, de 0 a 1. */
  readonly share: number
}

/** O que a frente do card Novos Clientes desenha abaixo da comparação. */
export type OverviewCustomerMixFront = {
  /** Participação do cliente novo, a mesma que a linha de detalhe já diz. */
  readonly share: number
  readonly parts: readonly OverviewCustomerMixPart[]
}

/** Participação de uma parcela no total, com recorte vazio devolvendo zero. */
function mixShare(count: number, activeSales: number): number {
  return activeSales === 0 ? 0 : count / activeSales
}

/**
 * As três parcelas do mix como a frente do card as mostra.
 *
 * Cliente novo vira a barra, porque ele é o número em destaque: a barra mede o
 * quanto dele cabe nas vendas ativadas do recorte. As outras duas viram blocos
 * com contagem e participação, e é o que separa este card do Tempo até a
 * ativação e do card dos 90 dias, onde o valor em destaque é o total que a
 * barra reparte.
 *
 * O denominador dos três é `activeSales`, o número do primeiro card da
 * fileira, e não a soma interna das parcelas: os dois cards precisam falar do
 * mesmo total. Como as três somam esse total, as participações somam 100%.
 *
 * Os rótulos são curtos porque o bloco ocupa metade da largura do card. Os
 * nomes por extenso continuam na leitura gerencial e no nome acessível.
 */
export function customerMixFront(
  mix: OverviewCustomerMix,
  activeSales: number,
): OverviewCustomerMixFront {
  return {
    share: mixShare(mix.newCustomers, activeSales),
    parts: [
      {
        // "Clientes da base" no lugar de "Já tinham ponto", pedido do Mário em
        // 17/09/2026: é linguagem de quem gerencia carteira, não de instalação.
        id: 'da-base',
        label: 'Clientes da base',
        accessibleLabel: 'Clientes da base com outro contrato ativo',
        count: mix.expansion,
        share: mixShare(mix.expansion, activeSales),
      },
      {
        id: 'retornaram',
        label: 'Retornaram',
        accessibleLabel: 'Retornaram depois de cancelar',
        count: mix.returning,
        share: mixShare(mix.returning, activeSales),
      },
    ],
  }
}

export type CommercialOverviewSnapshot = {
  readonly periodLabel: string
  readonly metrics: SalesPeriodMetrics
  /**
   * Nome da janela anterior que os cards comparam (`comparisonLabelFor`).
   * `null` quando a janela não é conhecida: sem período anterior comparável,
   * caso em que o card já diz o motivo, ou serviço que não informa a janela,
   * caso em que ele volta ao genérico "vs. período anterior".
   */
  readonly comparison: PeriodComparisonText | null
  /**
   * Ativadas do período anterior comparável; `null` sem período anterior.
   * Zero é resposta: a janela existe e ficou vazia (um domingo, por exemplo),
   * e o card diz "Sem ativação no domingo 13/09" em vez de "Sem período
   * anterior".
   */
  readonly previousActiveSales: number | null
  readonly previousMonthlyValue: number | null
  readonly monthlyValueChangeRate: number | null
  /**
   * Realizado da Meta Comercial no período anterior comparável, ou seja, as
   * vendas do Comercial. É o mesmo numerador de `metrics.goalAchieved`, o que
   * mantém a comparação do card sobre a mesma base do velocímetro.
   */
  readonly previousGoalAchieved: number | null
  /**
   * Contratos vendidos no período, pela data da venda: o Total de Vendas do
   * SGI, o card que abre a fileira desde 06/10/2026 (pedido da equipe: o
   * vendido não aparecia em lugar nenhum da página). Vendido não é faturado;
   * faturado é o Vendas ativadas. É o mesmo denominador do Aguardando
   * Ativação (`awaitingActivation.sold`); `null` quando o serviço não manda
   * o número, e aí o card diz "Sem dado" em vez de zero.
   */
  readonly soldContracts: number | null
  /** Vendidos no período anterior comparável; `null` sem período anterior. Zero é resposta. */
  readonly previousSoldContracts: number | null
  readonly soldContractsChangeRate: number | null
  /**
   * Realizado da Supermeta no período anterior comparável: o total ativado de
   * Comercial e Corporativo, mesmo numerador de `metrics.superGoalAchieved`.
   */
  readonly previousSuperGoalAchieved: number | null
  /**
   * Ranking comparativo de cidades. Ignora apenas `cityIds`: data e time
   * continuam valendo. Marcar cidades destaca as linhas em vez de reduzir o
   * painel a elas.
   */
  readonly topCities: readonly OverviewBreakdown[]
  /** Total de ativações do conjunto comparativo de cidades. */
  readonly cityComparisonTotal: number
  /**
   * Comparativo dos dois times. Ignora apenas `team`: data e cidade continuam
   * valendo. `filters.team` só indica qual bloco recebe destaque.
   */
  readonly teams: readonly OverviewBreakdown[]
  /** Total de ativações do conjunto comparativo de times. */
  readonly teamComparisonTotal: number
  /**
   * Vendedores e Indicação são origens, não times. O painel mostra a
   * composição consolidada dos dois times dentro do recorte de data e cidade.
   */
  readonly origins: readonly OverviewBreakdown[]
  readonly topPlans: readonly OverviewPlanRank[]
  readonly topSellers: readonly SalesPeriodSellerRank[]
  readonly monthly: readonly OverviewMonthlyPoint[]
  /**
   * Contratos vendidos no período que não viraram ativação, com as quatro
   * etapas na ordem de `OVERVIEW_AWAITING_STAGES`, inclusive as zeradas.
   *
   * É uma fotografia da situação de hoje, não uma série: o dado guarda o
   * status atual do contrato e não o histórico das mudanças.
   *
   * `null` significa que a fonte não conta a venda pela data do contrato, e é
   * o caso de um serviço anterior a este contrato. O card escreve isso na tela
   * em vez de mostrar um zero que o dado não sustenta.
   */
  readonly awaitingActivation: OverviewAwaitingActivation | null
  /**
   * Composição de clientes do recorte, sempre vinda da fonte.
   *
   * `null` significa que a fonte não separa cliente novo de cliente antigo, e
   * é o caso da base sintética: ela gera um CPF por venda, então todo cliente
   * apareceria como novo. O card escreve isso na tela em vez de mostrar um
   * número que o dado não sustenta.
   *
   * O portal também não tem como derivar isso sozinho quando está ligado ao
   * serviço: dizer que alguém nunca comprou exige varrer o histórico inteiro
   * do cliente, e esta página recebe apenas os totais já somados do recorte.
   */
  readonly customerMix: OverviewCustomerMix | null
  /**
   * Tempo até a ativação das vendas ativadas do recorte.
   *
   * `null` significa que a fonte não traz a data em que o contrato foi
   * fechado, e é o caso da base sintética: ela guarda a data do evento e a da
   * ativação, nunca as duas pontas da espera. O card avisa isso na tela, do
   * mesmo jeito que Novos Clientes já faz.
   */
  readonly activationDays: OverviewActivationDays | null
  /**
   * Valor do meio do mesmo tempo no período anterior comparável, que é o que
   * dá a comparação do card. Nulo sem período anterior ou sem a medida nele.
   */
  readonly previousActivationDaysMedian: number | null
  /**
   * Das vendas ativadas do recorte, quantas foram vendidas antes de o período
   * começar: as herdadas de períodos anteriores. O resto é venda do próprio
   * período, e a leitura do card Vendas ativadas escreve as duas parcelas.
   *
   * Decisão do Mário em 17/09/2026, depois de medir em produção que cerca de
   * 9% das ativações de cada mês vêm de vendas do mês anterior (setembro, 1 a
   * 17: 67 de 378). É o que liga este card à régua da data da venda (o card
   * Aguardando Ativação até 28/09/2026, hoje a Safra de vendas por mês): os
   * dois números passam a se explicar.
   *
   * `null` significa fonte que não separa a origem, e é o caso da base
   * sintética, que também continua exigindo contrato ativo hoje para contar
   * a venda. Ligado ao serviço, a venda vale pelo dia do sinal ligado mesmo
   * que o contrato tenha sido cancelado ou bloqueado depois, e o serviço
   * manda este número junto.
   */
  readonly activeSalesSoldEarlier: number | null
  /**
   * Safra de vendas por mês: todos os meses da base, com cidade, time,
   * vendedor e tipo de cliente aplicados e sem recorte de período, como a
   * evolução mensal.
   *
   * `null` significa fonte que não manda o bloco, o caso de um serviço
   * anterior a 18/09/2026. O painel escreve isso em vez de desenhar um
   * gráfico vazio, e o resto da página segue inteiro.
   */
  readonly cohorts: readonly OverviewCohortPoint[] | null
  /**
   * Bloqueio ou cancelamento no 90º dia das vendas que completaram 90 dias no
   * período (`OverviewMaturity`).
   *
   * `null` quando não há medida: a base sintética não tem histórico de
   * bloqueio, o período começa antes de 01/04/2026 (julgaria ativações de
   * antes da base) ou a consulta do histórico no serviço passou do limite.
   * O card escreve isso em vez de mostrar zero.
   */
  readonly maturity: OverviewMaturity | null
  /** O mesmo bloco no período anterior comparável; `null` sem medida nele. */
  readonly previousMaturity: OverviewMaturity | null
}

/**
 * Faixas da espera até a ativação, na ordem em que o card as apresenta.
 *
 * Esta é a lista oficial do portal, como `OVERVIEW_AWAITING_STAGES` é a das
 * etapas: o serviço manda as contagens e a ordem sai daqui, então faixa vazia
 * continua aparecendo no card.
 *
 * São quatro, e não cinco, porque a grade do card tem duas colunas estreitas.
 * Elas cobrem a fila inteira sem se sobrepor, e é isso que responde a pergunta
 * que o valor do meio sozinho deixava no ar: quanto esperou a maior parte dos
 * clientes, e não só o meio e a cauda.
 *
 * A última usa o rótulo compacto `4 dias ou +` porque nas telas largas, com os
 * cinco cards lado a lado, a coluna da grade encolhe e a forma por extenso
 * quebra em duas linhas. O rótulo inteiro continua valendo na leitura
 * gerencial, que tem a largura do card todo.
 */
export const OVERVIEW_ACTIVATION_BANDS = [
  { id: 'mesmo-dia', label: 'Mesmo dia' },
  { id: '1-dia', label: '1 dia' },
  { id: '2-a-3-dias', label: '2 a 3 dias' },
  { id: '4-dias-ou-mais', label: '4 dias ou +' },
] as const

export type OverviewActivationBandId = (typeof OVERVIEW_ACTIVATION_BANDS)[number]['id']

export type OverviewActivationBand = {
  readonly id: OverviewActivationBandId
  readonly label: string
  readonly count: number
  /** Fatia da faixa dentro do total medido: as quatro somam 1. */
  readonly share: number
}

/**
 * Tempo entre o contrato fechado e o sinal ligado, em dias.
 *
 * Quem mede é o serviço, sobre as vendas ativadas do recorte, porque esta
 * página recebe totais e não os contratos um a um.
 *
 * Nenhuma das leituras é a média: contrato antigo religado depois de mais de
 * dois anos existe na base e deslocaria a média sem representar o dia a dia.
 */
export type OverviewActivationDays = {
  /** Valor do meio: metade das ativações esperou menos que isso. */
  readonly medianDays: number
  /** A fila inteira dividida em faixas, o que o card desenha na barra. */
  readonly bands: readonly OverviewActivationBand[]
}

/**
 * Como estavam, no 90º dia depois do sinal ligado, as vendas que completaram
 * 90 dias no período. Card que ocupou a vaga do Aguardando Ativação, decisão
 * do Mário em 28/09/2026.
 *
 * Quem mede é o serviço, porque a situação no 90º dia sai do histórico de
 * bloqueio e desbloqueio de cada contrato, que esta página não recebe. O
 * período recorta o 90º DIA, não o sinal: setembro julga as vendas ativadas
 * de junho, e `activatedFrom`/`activatedTo` dizem quais. Idade fixa porque a
 * situação de hoje faz o mês antigo parecer pior só por ter tido mais tempo.
 *
 * Fica fora a venda cancelada que não chegou a ser cliente (baixa prematura,
 * instalação não concluída, cancelamento sem motivo). `blocked` e
 * `cancelled` não se sobrepõem e cabem em `sales`.
 */
export type OverviewMaturity = {
  /** Idade em que a venda é julgada, em dias depois do sinal: 90. */
  readonly days: number
  /** Primeiro e último dia de sinal ligado das vendas julgadas, `aaaa-mm-dd`. */
  readonly activatedFrom: string
  readonly activatedTo: string
  /** Vendas ativadas que completaram `days` dias no período. */
  readonly sales: number
  /** Em bloqueio financeiro no último dia. */
  readonly blocked: number
  /** Canceladas até o último dia. */
  readonly cancelled: number
}

/**
 * Recorte de abertura da página para uma cobertura qualquer.
 *
 * A página abre em DIAS FECHADOS, como a Visão Geral de OS: do dia 1 do mês
 * até ONTEM (decisão do Mário em 25/09/2026, junto dos atalhos de período).
 * O dia de hoje pertence à faixa Hoje ao vivo, e o recorte de abertura passa
 * a ser o mesmo do atalho "Este mês", que nasce aceso. No dia 1 o resultado é
 * o mês anterior inteiro, o último fechado.
 *
 * O fim continua limitado ao que a fonte cobre: com a carga atrasada ele
 * recua para a última data com dado, e a base sintética, que termina em
 * 31/07/2026, segue abrindo julho inteiro.
 *
 * `today` existe para os testes fixarem a data; no portal vale o relógio.
 */
export function initialCommercialOverviewFiltersFor(
  coverage: SourcePeriod,
  today: string = todayISO(),
): CommercialOverviewFilters {
  const period = defaultPeriodFor(coverage, shiftISODate(today, -1))

  return {
    startDate: period.start,
    endDate: period.end,
    cityIds: [],
    team: 'todos',
    sellerIds: [],
    personType: 'todos',
  }
}

/** Recorte de abertura da base sintética, a cobertura de janeiro a julho. */
export function initialCommercialOverviewFilters(): CommercialOverviewFilters {
  return initialCommercialOverviewFiltersFor({
    start: COMMERCIAL_PERIOD_START,
    end: COMMERCIAL_PERIOD_END,
  })
}

/**
 * Correção do período quando a cobertura da fonte finalmente é conhecida.
 *
 * A página abre no recorte da base sintética porque a cobertura do banco só
 * chega junto da primeira resposta. Esta função diz qual é o recorte certo
 * depois dessa descoberta, mantendo cidade, time, vendedor e tipo de cliente
 * como estão.
 *
 * `null` quer dizer que não há nada a corrigir, ou seja, o período em uso já é
 * o de abertura da cobertura recebida. Quem chama decide QUANDO perguntar: a
 * correção vale uma vez só, antes de a pessoa escolher o próprio período.
 */
export function openingPeriodCorrection(
  current: CommercialOverviewFilters,
  coverage: SourcePeriod,
): CommercialOverviewFilters | null {
  const opening = initialCommercialOverviewFiltersFor(coverage)

  if (current.startDate === opening.startDate && current.endDate === opening.endDate) {
    return null
  }

  return { ...current, startDate: opening.startDate, endDate: opening.endDate }
}

/**
 * Recorte da base sintética pelas contas de Vendas por Período.
 *
 * Aquele modelo filtra uma cidade e um vendedor. Com uma opção marcada ela
 * segue para ele, como sempre; com mais de uma, as vendas fora das marcadas
 * saem da base antes e o campo segue vazio. A regra é a mesma do modelo e do
 * serviço: venda com indicação não é de vendedor nenhum. A meta tem regra só
 * para uma cidade e um vendedor, e com várias fica sem meta, como no serviço.
 */
function localSnapshot(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): SalesPeriodSnapshot {
  const { cityIds, sellerIds } = filters
  const manyCities = cityIds.length > 1
  const manySellers = sellerIds.length > 1
  const scoped =
    manyCities || manySellers
      ? {
          ...dataset,
          sales: dataset.sales.filter(
            (sale) =>
              (!manyCities || cityIds.includes(sale.cityId)) &&
              (!manySellers || (sellerIds.includes(sale.creatorId) && sale.indicationCode === null)),
          ),
        }
      : dataset
  const snapshot = buildSalesPeriodSnapshot(scoped, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    cityId: cityIds.length === 1 ? cityIds[0] : null,
    team: filters.team,
    sellerId: sellerIds.length === 1 ? sellerIds[0] : null,
  })

  return manyCities || manySellers
    ? { ...snapshot, metrics: { ...snapshot.metrics, goal: null, superGoal: null } }
    : snapshot
}

function isActive(fact: SalesPeriodFact): boolean {
  return fact.status === 'ativa' && fact.activatedAt !== null
}

/**
 * Janela anterior comparável, pela natureza do recorte: a régua da Visão
 * Geral de OS (`comparisonPeriodRange`), adotada aqui por decisão do Mário em
 * 25/09/2026. O mês até ontem compara com o mês anterior até o mesmo dia, a
 * semana com a semana anterior, o dia com o mesmo dia da semana anterior; o
 * serviço de BI aplica a mesma régua (`comparison_window`).
 *
 * `null` quando a janela começa antes da base: comparar com base parcial
 * enganaria.
 */
function previousPeriod(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): OverviewComparisonRange | null {
  const comparison = comparisonPeriodRange({ dateFrom: filters.startDate, dateTo: filters.endDate })
  if (comparison === null || comparison.range.dateFrom < dataset.periodStart) return null

  return comparison
}

/**
 * Com o que os cards comparam, escrito a partir da janela que a FONTE usou.
 *
 * A natureza vem do recorte escolhido, mas só vale se a janela recebida for
 * a que a régua daria: um serviço anterior a 25/09/2026 ainda compara com a
 * mesma duração logo antes, e aí o card escreve as datas dessa janela em vez
 * de dizer "agosto até o dia 24" sobre outra coisa.
 */
export function comparisonLabelFor(
  filters: Pick<CommercialOverviewFilters, 'startDate' | 'endDate'>,
  range: PeriodRange,
): PeriodComparisonText {
  const expected = comparisonPeriodRange({ dateFrom: filters.startDate, dateTo: filters.endDate })
  const kind =
    expected !== null &&
    expected.range.dateFrom === range.dateFrom &&
    expected.range.dateTo === range.dateTo
      ? expected.kind
      : 'custom'

  return comparisonText({ kind, range }, filters.startDate)
}

function breakdown(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
  keyOf: (fact: SalesPeriodFact) => string,
  labelOf: (fact: SalesPeriodFact) => string,
): OverviewBreakdown[] {
  const grouped = new Map<string, Omit<OverviewBreakdown, 'share'>>()

  facts.filter(isActive).forEach((fact) => {
    const id = keyOf(fact)
    const current = grouped.get(id)
    grouped.set(id, {
      id,
      label: labelOf(fact),
      activeSales: (current?.activeSales ?? 0) + 1,
      monthlyValue: (current?.monthlyValue ?? 0) + fact.monthlyValue,
    })
  })

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      share: activeTotal === 0 ? 0 : item.activeSales / activeTotal,
    }))
    .sort(
      (a, b) =>
        b.activeSales - a.activeSales ||
        b.monthlyValue - a.monthlyValue ||
        a.label.localeCompare(b.label, 'pt-BR'),
    )
}

function buildTeams(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
): OverviewBreakdown[] {
  const labels: Record<SalesPeriodTeam, string> = {
    comercial: 'Comercial',
    corporativo: 'Corporativo',
  }
  const active = facts.filter(isActive)

  return (['comercial', 'corporativo'] as const)
    .map((team) => {
      const teamFacts = active.filter((fact) => fact.team === team)
      return {
        id: team,
        label: labels[team],
        activeSales: teamFacts.length,
        monthlyValue: teamFacts.reduce((total, fact) => total + fact.monthlyValue, 0),
        share: activeTotal === 0 ? 0 : teamFacts.length / activeTotal,
      }
    })
    .filter((item) => item.activeSales > 0)
}

function buildOrigins(
  facts: readonly SalesPeriodFact[],
  activeTotal: number,
): OverviewBreakdown[] {
  const active = facts.filter(isActive)
  const direct = active.filter((fact) => fact.indicatorCpf === null)
  const indicated = active.filter((fact) => fact.indicatorCpf !== null)

  return [
    {
      id: 'vendedores',
      label: 'Vendedores',
      activeSales: direct.length,
      monthlyValue: direct.reduce((total, fact) => total + fact.monthlyValue, 0),
      share: activeTotal === 0 ? 0 : direct.length / activeTotal,
    },
    {
      id: 'indicacao',
      label: 'Indicação',
      activeSales: indicated.length,
      monthlyValue: indicated.reduce((total, fact) => total + fact.monthlyValue, 0),
      share: activeTotal === 0 ? 0 : indicated.length / activeTotal,
    },
  ].filter((item) => item.activeSales > 0)
}

/** Valor mensal ativado por um time específico, somado fato a fato. */
function teamMonthlyValue(
  facts: readonly SalesPeriodFact[],
  team: SalesPeriodTeam,
): number {
  return facts
    .filter((fact) => isActive(fact) && fact.team === team)
    .reduce((total, fact) => total + fact.monthlyValue, 0)
}

function buildMonthly(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): OverviewMonthlyPoint[] {
  return dataset.months.map((month) => {
    const snapshot = localSnapshot(dataset, {
      ...filters,
      startDate: isoDateInMonth(month, 1),
      endDate: isoDateInMonth(month, daysInMonth(month)),
    })

    // Os valores saem dos mesmos fatos ativados do mês. Nada é rateado por
    // percentual: é a soma direta de cada time, para que o gráfico possa montar
    // a linha somente com as séries visíveis. A parcela sem time é zero por
    // construção: na base sintética todo vendedor tem time (`SalesPeriodTeam`
    // não admite vazio). Quem produz essa parcela é o serviço, sobre o SGI.
    return {
      month,
      label: monthShortLabel(month),
      commercialSales: snapshot.metrics.commercialSales,
      corporateSales: snapshot.metrics.corporateSales,
      unassignedSales: 0,
      commercialValue: teamMonthlyValue(snapshot.facts, 'comercial'),
      corporateValue: teamMonthlyValue(snapshot.facts, 'corporativo'),
      unassignedValue: 0,
      monthlyValue: snapshot.metrics.monthlyRevenue,
    }
  })
}

/**
 * Aguardando Ativação na base sintética.
 *
 * A base local não tem a data da venda do SGI (`contracted_at`). O análogo
 * dela é o `createdAt` da venda, o dia em que o contrato foi registrado, que é
 * o que o SGI grava em `contracted_at`. A assinatura (`signedAt`) vem depois e
 * não é a venda, como no banco real.
 *
 * O recorte por cidade, time e vendedor é o mesmo dos outros cards: os fatos
 * saem do motor com a cobertura inteira como período, e só depois entram os
 * vendidos no intervalo pedido. Assim nenhuma regra de filtro é reescrita
 * aqui. Isso pressupõe que todo fato tem o evento dentro da cobertura, o que
 * o gerador da base garante e o teste dos sete meses confere. As etapas são
 * percorridas na ordem oficial, e não pelos fatos, para uma etapa sem contrato
 * continuar aparecendo zerada em vez de sumir do card.
 */
function buildAwaitingActivation(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): OverviewAwaitingActivation {
  const soldOn = new Map(dataset.sales.map((sale) => [sale.id, sale.createdAt]))
  const coverage = localSnapshot(dataset, {
    ...filters,
    startDate: dataset.periodStart,
    endDate: dataset.periodEnd,
  })
  const sold = coverage.facts.filter((fact) => {
    const soldAt = soldOn.get(fact.id)
    return soldAt !== undefined && soldAt >= filters.startDate && soldAt <= filters.endDate
  })
  const counts = new Map<OverviewAwaitingStageId, number>()
  sold.forEach((fact) => {
    const stage = awaitingStageOf(fact.status, fact.activatedAt)
    if (stage !== null) counts.set(stage, (counts.get(stage) ?? 0) + 1)
  })
  const awaiting = [...counts.values()].reduce((total, count) => total + count, 0)

  return {
    sold: sold.length,
    awaiting,
    stages: OVERVIEW_AWAITING_STAGES.map((stage) => {
      const count = counts.get(stage.id) ?? 0
      return {
        id: stage.id,
        label: stage.label,
        count,
        share: awaiting === 0 ? 0 : count / awaiting,
        // A base sintética não liga ordem de serviço à venda: sem visita
        // marcada nem reagendamento medidos.
        scheduledVisit: null,
        needsReschedule: null,
      }
    }),
  }
}

type CohortBucket = {
  sold: number
  activatedInMonth: number
  activatedLater: number
  awaiting: number
  cancelled: number
  other: number
}

function emptyCohortBucket(): CohortBucket {
  return { sold: 0, activatedInMonth: 0, activatedLater: 0, awaiting: 0, cancelled: 0, other: 0 }
}

/**
 * Safra por mês vendido na base sintética.
 *
 * Mesmo molde do Aguardando Ativação: a data da venda é o `createdAt` da
 * venda, os fatos saem do motor com a cobertura inteira como período, para
 * cidade, time, vendedor e tipo de cliente valerem sem reescrever regra, e o
 * período da página não recorta, porque o painel mostra todos os meses.
 *
 * Quem ativou é classificado pela data de ativação, sem olhar a situação de
 * hoje, como o serviço faz desde 17/09/2026: suspensa e bloqueada com data
 * contam como ativadas na safra. Reprovada, expirada e não sincronizada, sem
 * data, caem em "outras", como no serviço. Os meses são percorridos pela
 * lista da base, e não pelos fatos, para um mês sem venda continuar no
 * painel zerado em vez de sumir.
 */
function buildCohorts(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): OverviewCohortPoint[] {
  const soldOn = new Map(dataset.sales.map((sale) => [sale.id, sale.createdAt]))
  const coverage = localSnapshot(dataset, {
    ...filters,
    startDate: dataset.periodStart,
    endDate: dataset.periodEnd,
  })
  const buckets = new Map<string, CohortBucket>(
    dataset.months.map((month): [string, CohortBucket] => [month, emptyCohortBucket()]),
  )

  coverage.facts.forEach((fact) => {
    const soldAt = soldOn.get(fact.id)
    if (soldAt === undefined) return
    const bucket = buckets.get(monthKeyOf(soldAt))
    if (bucket === undefined) return

    bucket.sold += 1
    const stage = awaitingStageOf(fact.status, fact.activatedAt)
    if (fact.status === 'cancelada') bucket.cancelled += 1
    else if (stage !== null) bucket.awaiting += 1
    else if (fact.activatedAt === null) bucket.other += 1
    else if (monthKeyOf(fact.activatedAt) > monthKeyOf(soldAt)) bucket.activatedLater += 1
    else bucket.activatedInMonth += 1
  })

  return dataset.months.map((month) => ({
    month,
    label: monthShortLabel(month),
    ...(buckets.get(month) ?? emptyCohortBucket()),
  }))
}

export function buildCommercialOverviewSnapshot(
  dataset: CommercialDataset,
  filters: CommercialOverviewFilters,
): CommercialOverviewSnapshot {
  const snapshot = localSnapshot(dataset, filters)
  const previous = previousPeriod(dataset, filters)
  const previousSnapshot =
    previous === null
      ? null
      : localSnapshot(dataset, {
          ...filters,
          startDate: previous.range.dateFrom,
          endDate: previous.range.dateTo,
        })
  const activeTotal = snapshot.metrics.activeSales
  const previousActiveSales = previousSnapshot?.metrics.activeSales ?? 0
  // A variação das ativadas é refeita sobre a janela desta página: a que vem
  // pronta de `buildSalesPeriodSnapshot` usa a régua de Vendas por Período,
  // que continua a da mesma duração logo antes.
  const activeSalesChangeRate =
    previousSnapshot === null || previousActiveSales === 0
      ? null
      : (activeTotal - previousActiveSales) / previousActiveSales
  const monthlyValueChangeRate =
    previousSnapshot === null || previousSnapshot.metrics.monthlyRevenue === 0
      ? null
      : (snapshot.metrics.monthlyRevenue - previousSnapshot.metrics.monthlyRevenue) /
        previousSnapshot.metrics.monthlyRevenue
  const topPlans = breakdown(
    snapshot.facts,
    activeTotal,
    (fact) => fact.planName,
    (fact) => fact.planName,
  )
    .slice(0, 5)
    .map((plan, index) => ({ ...plan, position: index + 1 }))

  // Painéis comparativos. Cada um ignora somente o filtro da própria dimensão,
  // para continuar mostrando a comparação completa enquanto o controle superior
  // apenas marca a seleção. Os demais filtros seguem valendo.
  const cityScope = localSnapshot(dataset, { ...filters, cityIds: [] })
  const teamScope = localSnapshot(dataset, { ...filters, team: 'todos' })
  // Ranking de vendedores: ignora somente o filtro Vendedor, pelo mesmo motivo
  // dos painéis de cidade e de time. Com um vendedor selecionado o Top 5
  // continua sendo o Top 5 do recorte, e o painel apenas destaca a linha dele;
  // reduzir o ranking a um nome só transformaria uma comparação em um número
  // solto, e a posição dele deixaria de significar alguma coisa.
  const sellerScope = localSnapshot(dataset, { ...filters, sellerIds: [] })
  const cityComparisonTotal = cityScope.metrics.activeSales
  const teamComparisonTotal = teamScope.metrics.activeSales
  // Vendido pela data da venda, a régua do Total de Vendas: o mesmo denominador
  // do Aguardando Ativação, aqui (a mesma conta, feita uma vez) e na janela
  // anterior.
  const awaitingActivation = buildAwaitingActivation(dataset, filters)
  const soldContracts = awaitingActivation.sold
  const previousSoldContracts =
    previous === null
      ? null
      : buildAwaitingActivation(dataset, {
          ...filters,
          startDate: previous.range.dateFrom,
          endDate: previous.range.dateTo,
        }).sold
  const soldContractsChangeRate =
    previousSoldContracts === null || previousSoldContracts === 0
      ? null
      : (soldContracts - previousSoldContracts) / previousSoldContracts

  return {
    periodLabel: `${formatIsoAsBrDate(filters.startDate)} a ${formatIsoAsBrDate(filters.endDate)}`,
    metrics: { ...snapshot.metrics, activeSalesChangeRate },
    comparison: previous === null ? null : comparisonText(previous, filters.startDate),
    previousActiveSales: previousSnapshot?.metrics.activeSales ?? null,
    previousMonthlyValue: previousSnapshot?.metrics.monthlyRevenue ?? null,
    monthlyValueChangeRate,
    soldContracts,
    previousSoldContracts,
    soldContractsChangeRate,
    // Os dois realizados anteriores saem do mesmo snapshot de período anterior
    // já usado pelo valor mensal. Nenhuma janela de comparação nova é criada.
    previousGoalAchieved: previousSnapshot?.metrics.goalAchieved ?? null,
    previousSuperGoalAchieved: previousSnapshot?.metrics.superGoalAchieved ?? null,
    topCities: breakdown(
      cityScope.facts,
      cityComparisonTotal,
      (fact) => fact.cityId,
      (fact) => fact.cityName,
    ),
    cityComparisonTotal,
    teams: buildTeams(teamScope.facts, teamComparisonTotal),
    teamComparisonTotal,
    // Origem responde a data e cidade, nunca ao time: Vendedores e Indicação
    // não são times, e cruzar as duas dimensões criaria um vínculo inexistente.
    origins: buildOrigins(teamScope.facts, teamComparisonTotal),
    topPlans,
    topSellers: sellerScope.topSellers,
    monthly: buildMonthly(dataset, filters),
    // Régua própria, a data da venda: os fatos por data de evento dos outros
    // cards não servem aqui.
    awaitingActivation,
    // A base sintética dá um CPF diferente para cada venda, então ela não tem
    // como dizer quem já era cliente: todo mundo apareceria como novo. O card
    // avisa isso na tela, e o número real vem do serviço de BI.
    customerMix: null,
    // Mesma situação no tempo até a ativação: a base sintética guarda a data do
    // evento e a da ativação, e nunca a data em que o contrato foi fechado.
    // Sem as duas pontas não existe espera para medir.
    activationDays: null,
    previousActivationDaysMedian: null,
    // A base sintética não separa a venda herdada da própria, e continua
    // contando só o contrato ativo hoje: a leitura do card diz a régua dela.
    activeSalesSoldEarlier: null,
    // Régua da data da venda, como o Aguardando Ativação: os fatos por data
    // de evento dos outros painéis não servem aqui.
    cohorts: buildCohorts(dataset, filters),
    // A base sintética não tem histórico de bloqueio nem data de
    // cancelamento: a situação no 90º dia só existe ligada ao serviço.
    maturity: null,
    previousMaturity: null,
  }
}
