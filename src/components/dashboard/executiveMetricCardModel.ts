import type { Theme } from '../../contexts/PreferencesContextCore'
import type { KpiDelta } from '../../data/dashboardTypes'
import { formatPercent } from '../../lib/formatters'

/**
 * Constantes e helpers do card executivo compartilhado.
 *
 * Nasceram na área Comercial e foram promovidos para cá quando a Visão Geral
 * de OS adotou a mesma linguagem visual: o modelo é o mesmo nas duas áreas, e
 * não duas cópias parecidas. Ficam separados do componente pelo mesmo motivo
 * de `PreferencesContextCore`: um arquivo que exporta componente e valor ao
 * mesmo tempo quebra o fast refresh. Aqui também dá para testar os helpers sem
 * renderizar nada.
 */

/**
 * Cor de identidade do indicador, usada na caixa do ícone e no visual.
 *
 * A identidade é fixa por indicador e nunca muda com o resultado: favorável ou
 * desfavorável é papel da comparação. `red` é o vermelho semântico do portal
 * (o mesmo da Improdutiva nos gráficos de OS), para indicadores cujo assunto é
 * um problema, e não um erro do card.
 */
export type ExecutiveCardTone =
  | 'green'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'cyan'
  | 'red'

export const executiveCardColors: Record<ExecutiveCardTone, string> = {
  green: '#00a862',
  blue: '#2f7de1',
  indigo: '#4263eb',
  violet: '#8b5cf6',
  amber: '#d97706',
  cyan: '#0f9689',
  red: '#e5484d',
}

export type ExecutiveCardVariant = 'spark' | 'gauge' | 'pipeline'

/**
 * Interpretação de negócio da comparação, sempre decidida por quem consome.
 *
 * O card NÃO deduz semântica a partir do sinal do número. No portal existem
 * indicadores em que crescer é piorar, como improdutividade, tempo médio e
 * inadimplência: se a comparação decidisse sozinha, um aumento de
 * improdutividade apareceria em verde. Quem conhece a regra do indicador
 * informa o tom.
 */
export type ExecutiveDeltaTone = 'favoravel' | 'desfavoravel' | 'neutro' | 'indisponivel'

/** Comparação já interpretada pelo consumidor, pronta para o card. */
export type ExecutiveCardDelta = {
  /** Texto visível, abreviado com `vs. p.p.`. */
  readonly label: string
  /** Leitura completa, com `versus período anterior` por extenso. */
  readonly accessibleLabel: string
  readonly tone: ExecutiveDeltaTone
}

/**
 * Cor do texto comparativo, por tom e por tema.
 *
 * A comparação é só texto: não existe fundo, borda, contorno nem pílula. Por
 * isso a cor precisa ser sólida e alcançar contraste sozinha, e o mesmo verde
 * não serve para superfície clara e para superfície escura.
 *
 * A informação nunca depende apenas da cor: o texto traz o triângulo de direção
 * e o conteúdo acessível traz a interpretação por extenso.
 */
export const executiveDeltaColors: Record<Theme, Record<ExecutiveDeltaTone, string>> = {
  light: {
    favoravel: '#00844d',
    desfavoravel: '#b51d38',
    neutro: '#475467',
    indisponivel: '#5b6779',
  },
  dark: {
    favoravel: '#34d399',
    desfavoravel: '#ff8fa3',
    neutro: '#cdd5df',
    indisponivel: '#aeb9c7',
  },
}

/**
 * Tipografia comum dos textos semânticos exibidos na frente dos cards.
 *
 * A comparação com o período anterior e a distância até Meta ou Supermeta são a
 * mesma categoria de informação: uma frase curta, colorida pelo tom do
 * resultado. Por isso as duas herdam a família do portal e compartilham corpo,
 * peso e entrelinha daqui, em vez de repetirem valores parecidos em cada
 * componente, que é justamente como as duas se dessincronizaram.
 *
 * A entrelinha é 1,25 e não `leading-none` porque a distância até a meta pode
 * quebrar em duas linhas no card estreito, e linhas encostadas ficariam
 * ilegíveis. Na comparação, que é sempre uma linha truncada dentro de uma faixa
 * de altura fixa e centralizada, o valor não muda nada na tela.
 */
export const executiveSemanticTextClass = 'text-[11px] font-semibold leading-[1.25]'

/**
 * Leitura do tom, anexada ao texto acessível.
 *
 * Garante que a interpretação não dependa somente da cor: quem usa leitor de
 * tela recebe a mesma informação que a paleta transmite visualmente.
 */
export const executiveDeltaReading: Record<ExecutiveDeltaTone, string> = {
  favoravel: 'Resultado favorável.',
  desfavoravel: 'Resultado desfavorável.',
  neutro: 'Resultado neutro.',
  indisponivel: 'Comparação indisponível.',
}

/** Abreviação visual do período anterior, comum a todos os cards executivos. */
export const PREVIOUS_PERIOD_SHORT = 'vs. p.p.'

/** Expressão completa, sempre disponível para tecnologia assistiva. */
export const PREVIOUS_PERIOD_LONG = 'versus período anterior'

/**
 * Comparação percentual com o período anterior.
 *
 * Vale para os indicadores em que crescer é favorável. Quem tiver indicador de
 * sentido invertido, como improdutividade ou atraso, monta o próprio
 * `ExecutiveCardDelta` (a Visão Geral de OS usa `buildDeltaFromKpi`): nem esta
 * função nem o card deduzem semântica a partir do sinal do número.
 */
export function buildExecutiveDelta(rate: number | null, subject: string): ExecutiveCardDelta {
  if (rate === null) {
    return {
      label: 'Sem período anterior',
      accessibleLabel: `${subject}: não há período anterior comparável`,
      tone: 'indisponivel',
    }
  }
  if (rate > 0) {
    return {
      label: `▲ ${formatPercent(rate)} ${PREVIOUS_PERIOD_SHORT}`,
      accessibleLabel: `${subject} cresceu ${formatPercent(rate)} ${PREVIOUS_PERIOD_LONG}`,
      tone: 'favoravel',
    }
  }
  if (rate < 0) {
    return {
      label: `▼ ${formatPercent(Math.abs(rate))} ${PREVIOUS_PERIOD_SHORT}`,
      accessibleLabel: `${subject} recuou ${formatPercent(Math.abs(rate))} ${PREVIOUS_PERIOD_LONG}`,
      tone: 'desfavoravel',
    }
  }
  return {
    label: `Estável ${PREVIOUS_PERIOD_SHORT}`,
    accessibleLabel: `${subject} ficou estável ${PREVIOUS_PERIOD_LONG}`,
    tone: 'neutro',
  }
}

/**
 * Interpretação do card sobre um `KpiDelta` do dashboard de OS.
 *
 * `direcional` confia no `positive` já calculado pelos agregados, que conhece o
 * sentido de cada indicador (`higherIsGood`): é ele que faz uma REDUÇÃO de
 * improdutividade aparecer favorável. `neutro` mantém a direção visível, mas
 * sem julgamento, para indicadores como Total de OS que não são bons nem ruins
 * sozinhos.
 */
export type KpiDeltaInterpretation = 'direcional' | 'neutro'

/**
 * Converte a comparação do dashboard de OS para o formato do card executivo.
 *
 * Sem período anterior com dados, nenhum percentual é inventado: o card mostra
 * `Sem período anterior`. O texto `+0,0%`/`-0,0%` vira `Estável`, que é a mesma
 * linguagem dos cards comerciais para variação nula. A direção sai do próprio
 * texto do delta e a interpretação sai do `positive` dos agregados, então
 * nenhuma regra de negócio é refeita aqui.
 */
export function buildDeltaFromKpi(
  kpi: KpiDelta,
  subject: string,
  interpretation: KpiDeltaInterpretation = 'direcional',
): ExecutiveCardDelta {
  if (!kpi.available) {
    return {
      label: 'Sem período anterior',
      accessibleLabel: `${subject}: não há período anterior comparável`,
      tone: 'indisponivel',
    }
  }

  const percent = kpi.text.replace(/^[+-]/, '')
  if (percent === '0,0%') {
    return {
      label: `Estável ${PREVIOUS_PERIOD_SHORT}`,
      accessibleLabel: `${subject} ficou estável ${PREVIOUS_PERIOD_LONG}`,
      tone: 'neutro',
    }
  }

  const down = kpi.text.startsWith('-')
  return {
    label: `${down ? '▼' : '▲'} ${percent} ${PREVIOUS_PERIOD_SHORT}`,
    accessibleLabel: `${subject} ${down ? 'recuou' : 'cresceu'} ${percent} ${PREVIOUS_PERIOD_LONG}`,
    tone: interpretation === 'neutro' ? 'neutro' : kpi.positive ? 'favoravel' : 'desfavoravel',
  }
}
