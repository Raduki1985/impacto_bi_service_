import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { Lightbulb, type LucideIcon } from 'lucide-react'

import type { Theme } from '../../contexts/PreferencesContextCore'
import {
  executiveCardColors,
  executiveDeltaColors,
  executiveDeltaReading,
  executiveSemanticTextClass,
  type ExecutiveCardDelta,
  type ExecutiveCardTone,
  type ExecutiveCardVariant,
} from './executiveMetricCardModel'

/**
 * Card executivo de indicador, com leitura gerencial embutida.
 *
 * Nasceu na Visão Geral Comercial, foi compartilhado com Vendas por Período e
 * depois promovido para cá quando a Visão Geral de OS adotou a mesma linguagem:
 * as três páginas usam este mesmo componente, e não classes parecidas. A
 * paleta da leitura gerencial e as três variantes de conteúdo vêm juntas, pois
 * são a identidade aprovada do card, não uma decisão de cada página.
 *
 * O estado "um card aberto por vez" NÃO mora aqui: cada página controla a
 * própria coleção, passando `open` e `onToggle`. Isso mantém o componente puro
 * e permite que cada página decida quando fechar tudo.
 */

/**
 * Amarelo da leitura gerencial, igual em todos os cards.
 *
 * É o mesmo `#ffb020` registrado no portal como `--kpi-warn`. A lâmpada
 * sinaliza que existe leitura gerencial, então nunca herda o tom do indicador.
 */
const READING_LAMP = '#ffb020'

/**
 * Paleta da leitura gerencial, invertida por tema.
 *
 * No tema claro a leitura é escura, como aprovado. No tema escuro ela passa a
 * uma superfície cinza-azulada clara, e todos os textos mudam junto: nada de
 * texto branco sobre fundo claro. O verde e o amarelo também escurecem no tema
 * escuro para manterem contraste, continuando reconhecíveis como verde Impacto
 * e amarelo da lâmpada.
 */
const readingTheme = {
  light: {
    surface: 'linear-gradient(155deg,#0c2038,#081524)',
    lamp: '#ffb020',
    eyebrow: '#00a862',
    title: '#ffffff',
    body: '#b9c8dc',
    highlight: '#8ab4ff',
    divider: 'rgba(255,255,255,0.10)',
    observeLabel: '#54d98c',
    observeText: '#cad5e4',
  },
  dark: {
    surface: 'linear-gradient(155deg,#eef4f8,#dfe9f1)',
    lamp: '#c97f00',
    eyebrow: '#00774a',
    title: '#0f2942',
    body: '#3d5670',
    highlight: '#1a4fae',
    divider: 'rgba(15,41,66,0.16)',
    observeLabel: '#0a7047',
    observeText: '#3d5670',
  },
} as const

export type ExecutiveMetricCardProps = {
  /**
   * Arranjo interno do conteúdo.
   *
   * `spark` e `pipeline` abrem com valor e comparação e recebem o visual
   * abaixo. `gauge` inverte: o próprio velocímetro já desenha o percentual, e
   * a comparação vem centralizada logo abaixo dele.
   */
  variant: ExecutiveCardVariant
  icon: LucideIcon
  label: string
  tone: ExecutiveCardTone
  /** Valor principal já formatado. O velocímetro não usa, pois desenha o seu. */
  value?: string
  /** Comparação com o período anterior. Ausente em indicadores sem comparação. */
  delta?: ExecutiveCardDelta
  /** Texto curto abaixo do valor, como participação ou detalhe do recorte. */
  detail?: string
  /** Visual da variante: minigráfico, velocímetro ou composição. */
  children?: ReactNode
  /** Conteúdo fixado na base do card, hoje o rodapé do velocímetro. */
  footer?: ReactNode
  /** Nome acessível da frente do card, antes da orientação de abrir e fechar. */
  accessibleText: string
  readingTitle: string
  /** Trechos entre chaves `{...}` recebem destaque. */
  readingText: string
  /** Bloco `OBSERVAR`. Opcional: sem conteúdo confirmado, nada é inventado. */
  observe?: string
  /**
   * Declara que `accessibleText` JÁ inclui a comparação com o período anterior.
   *
   * O `aria-label` do card substitui o nome calculado pelos filhos, então a
   * comparação é anexada como descrição acessível (`aria-describedby`) para ser
   * anunciada no foco. Quem monta o próprio texto acessível com a comparação
   * dentro, como o velocímetro, declara isso aqui e a descrição não é ligada,
   * senão o mesmo percentual seria anunciado duas vezes.
   *
   * O padrão segue a variante: `gauge` usa o texto do modelo do velocímetro,
   * que já traz a comparação; `spark` e `pipeline` usam `Indicador: valor.` e
   * precisam da descrição. Um consumidor que fuja desse arranjo declara o valor
   * explicitamente, em vez de o card tentar deduzir pelo texto.
   */
  deltaInAccessibleText?: boolean
  open: boolean
  onToggle: () => void
  theme: Theme
}

/**
 * Alturas fixas das faixas do card.
 *
 * São elas que mantêm os cards alinhados entre si: cabeçalho, valor e
 * comparação ocupam sempre a mesma altura, independentemente do comprimento do
 * texto. Um valor longo pode cair de corpo, mas continua apoiado na mesma linha
 * de base, e a comparação não se move. Sem isso, `R$ 132.111,70` empurraria a
 * comparação e o visual para uma posição diferente da dos cards vizinhos.
 *
 * A faixa da comparação nasceu para o badge e continua com a mesma altura
 * depois que ele virou texto simples: é ela que preserva o alinhamento dos
 * cards, então a retirada do fundo e da borda não muda a altura de nada.
 */
const VALUE_AREA = 'flex h-[30px] items-end'
const DELTA_AREA = 'flex h-[24px] items-center'

export function ExecutiveMetricCard({
  accessibleText,
  children,
  delta,
  deltaInAccessibleText,
  detail,
  footer,
  icon: Icon,
  label,
  observe,
  onToggle,
  open,
  readingText,
  readingTitle,
  theme,
  tone,
  value,
  variant,
}: ExecutiveMetricCardProps) {
  const color = executiveCardColors[tone]
  const reading = readingTheme[theme === 'dark' ? 'dark' : 'light']
  const readingId = useId()
  const deltaDescriptionId = useId()
  // A descrição só é ligada quando existe comparação E ela ainda não faz parte
  // do nome. Sem comparação, nenhuma descrição é inventada.
  const describeDelta = delta !== undefined && !(deltaInAccessibleText ?? variant === 'gauge')
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  /**
   * Comparação com o período anterior, apenas como texto.
   *
   * Sem fundo, sem borda, sem contorno e sem formato de pílula: o que diferencia
   * favorável, desfavorável, neutro e indisponível é a cor do próprio texto. A
   * informação não fica presa à cor, porque o triângulo indica a direção na tela
   * e o conteúdo acessível traz a leitura completa mais a interpretação.
   *
   * O trecho `sr-only` também é a descrição acessível do card: como o
   * `aria-label` do `article` substitui o nome calculado pelos filhos, é o
   * `aria-describedby` que faz a comparação e a interpretação chegarem ao foco.
   */
  const deltaText =
    delta === undefined ? null : (
      <p
        className={`max-w-full truncate ${executiveSemanticTextClass}`}
        style={{ color: executiveDeltaColors[theme === 'dark' ? 'dark' : 'light'][delta.tone] }}
      >
        <span aria-hidden="true">{delta.label}</span>
        <span className="sr-only" id={deltaDescriptionId}>
          {delta.accessibleLabel}. {executiveDeltaReading[delta.tone]}
        </span>
      </p>
    )

  return (
    <article
      aria-controls={readingId}
      aria-describedby={describeDelta ? deltaDescriptionId : undefined}
      aria-expanded={open}
      aria-label={`${accessibleText} ${open ? 'Ative para fechar a leitura gerencial.' : 'Ative para ver a leitura gerencial.'}`}
      // A altura mínima acompanha o card mais alto da fileira, que é o do
      // velocímetro, então todos os cards executivos ficam do mesmo tamanho.
      className="group relative flex min-h-[206px] cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-h-9 items-start justify-between gap-2">
        {/* O título quebra em duas linhas em vez de truncar. Como a altura da
            linha é definida pelo ícone de 36px, duas linhas de 10,5px cabem sem
            mudar a altura do cabeçalho nem desalinhar os cards. */}
        <p className="flex min-w-0 items-start gap-1 text-[10.5px] font-bold uppercase leading-[1.15] tracking-[0.4px] text-[var(--text-secondary)]">
          <span className="min-w-0 break-words">{label}</span>
          {/* Indicação discreta de que existe leitura gerencial. O hover apenas
              revela a lâmpada; abrir a leitura continua sendo uma ação. O
              amarelo é fixo em todos os cards: a lâmpada identifica a leitura
              gerencial, não o indicador, então não herda a cor do card. */}
          <Lightbulb
            aria-hidden="true"
            className="mt-[-1px] flex-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            size={12}
            style={{ color: READING_LAMP }}
          />
        </p>
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
          style={{ background: `${color}1a`, color }}
        >
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>

      {variant === 'gauge' ? (
        <>
          {/* Ordem do card: título, velocímetro com o percentual, comparação
              centralizada logo abaixo dele e, por último, o rodapé. O texto
              comparativo fica na faixa livre entre o arco e o rodapé, sem cobrir
              ponteiro, escala nem os textos de realizado e meta. */}
          {children}
          {deltaText === null ? null : (
            <div className={`${DELTA_AREA} mt-1 justify-center`}>{deltaText}</div>
          )}
          {footer}
        </>
      ) : (
        <>
          <div className={`${VALUE_AREA} mt-1.5`}>
            {/* O corpo cai de forma controlada em valores longos, mas a faixa
                tem altura fixa e o texto se apoia na base dela: a linha de base
                e a posição da comparação não mudam entre os cards. */}
            <p
              className={`w-full truncate font-mono font-bold leading-none tracking-[-0.8px] text-[var(--text-heading)] ${
                (value?.length ?? 0) > 12 ? 'text-[18px]' : 'text-[23px]'
              }`}
            >
              {value}
            </p>
          </div>
          {deltaText === null ? null : (
            <div className={`${DELTA_AREA} mt-1.5`}>{deltaText}</div>
          )}
          {detail === undefined ? null : (
            <p className="mt-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              {detail}
            </p>
          )}
          {children}
          {footer}
        </>
      )}

      <div
        aria-hidden={!open}
        className={`absolute inset-0 flex flex-col px-4 py-3.5 transition duration-200 motion-reduce:transition-none ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0 motion-reduce:translate-y-0'}`}
        id={readingId}
        style={{ backgroundImage: reading.surface, color: reading.body }}
      >
        {/* Duas funções cromáticas distintas: a lâmpada continua amarela, que é
            o sinal de "existe leitura gerencial"; o título fica verde, que é a
            identidade da própria leitura. */}
        <p
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.85px]"
          style={{ color: reading.eyebrow }}
        >
          <Lightbulb
            aria-hidden="true"
            className="flex-none"
            size={11}
            style={{ color: reading.lamp }}
          />
          Leitura gerencial
        </p>
        <p className="mt-2 text-[12px] font-bold leading-[1.35]" style={{ color: reading.title }}>
          {readingTitle}
        </p>
        <p className="mt-1.5 text-[10.5px] leading-[1.4]" style={{ color: reading.body }}>
          <ExecutiveReadingText highlight={reading.highlight} text={readingText} />
        </p>
        {observe === undefined ? null : (
          <p
            className="mt-auto border-t pt-2 text-[9.8px] leading-[1.35]"
            style={{ borderColor: reading.divider, color: reading.observeText }}
          >
            <b style={{ color: reading.observeLabel }}>OBSERVAR: </b>
            {observe}
          </p>
        )}
      </div>
    </article>
  )
}

/** Converte marcações `{trecho}` em destaque, sem usar innerHTML. */
function ExecutiveReadingText({ highlight, text }: { highlight: string; text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/g).map((part, index) =>
        part.startsWith('{') && part.endsWith('}') ? (
          <b className="font-semibold" key={index} style={{ color: highlight }}>
            {part.slice(1, -1)}
          </b>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

/**
 * Minigráfico de área dos cards `spark`.
 *
 * Fica no rodapé do card, ocupando a faixa que sobra abaixo da comparação. É
 * decorativo para leitor de tela: o valor está no nome acessível do card e a
 * comparação tem a própria leitura completa.
 *
 * `null` marca dia sem base válida para a métrica, que é diferente de zero: um
 * dia sem OS concluída não tem tempo médio, e desenhá-lo como zero mentiria uma
 * queda. A linha é interrompida na lacuna e retomada depois; um ponto isolado
 * vira um marcador, para o dia não sumir. Sem nenhum ponto válido, nada é
 * desenhado e o card permanece estável.
 *
 * Recorte com UM único ponto válido: o marcador vai para o centro horizontal
 * do minigráfico, num diâmetro claramente visível. Encostado no extremo
 * esquerdo, no traço fino da linha, ele parecia um pixel defeituoso do painel,
 * e não a única observação do recorte. Nenhuma linha, tendência ou área é
 * inventada em volta dele.
 */
export function ExecutiveSparkline({
  color,
  points,
}: {
  color: string
  points: readonly (number | null)[]
}) {
  const rawId = useId()
  const gradientId = `executive-spark-${rawId.replace(/:/g, '')}`
  const width = 180
  const height = 42
  const values = points.filter((point): point is number => point !== null)
  if (values.length === 0) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)

  // Um único ponto válido no recorte inteiro: marcador centralizado e visível,
  // na mesma altura em que a série o desenharia. O traço curto com pontas
  // redondas continua sendo o que não se deforma com o `preserveAspectRatio`;
  // aqui ele apenas engrossa o suficiente para ser lido como um ponto.
  if (values.length === 1) {
    const y = height - 5 - ((values[0] - min) / range) * (height - 10)
    const dot = `${width / 2 - 0.75},${y} ${width / 2 + 0.75},${y}`
    return (
      <svg
        aria-hidden="true"
        className="absolute inset-x-4 bottom-2 h-[46px] w-[calc(100%-2rem)]"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <polyline
          fill="none"
          points={dot}
          stroke={color}
          strokeLinecap="round"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  // Trechos contíguos de pontos válidos: cada lacuna encerra um trecho e o
  // seguinte recomeça depois dela, sem ligar os dois com uma linha falsa.
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  points.forEach((point, index) => {
    if (point === null) {
      if (current.length > 0) segments.push(current)
      current = []
      return
    }
    current.push({
      x: points.length <= 1 ? 0 : (index / (points.length - 1)) * width,
      y: height - 5 - ((point - min) / range) * (height - 10),
    })
  })
  if (current.length > 0) segments.push(current)

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-4 bottom-2 h-[46px] w-[calc(100%-2rem)]"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segments.map((segment, index) => {
        // Ponto isolado entre lacunas: um traço mínimo com pontas redondas faz
        // as vezes de marcador, sem se deformar com o `preserveAspectRatio`.
        if (segment.length === 1) {
          const { x, y } = segment[0]
          const dot = `${Math.max(0, x - 0.75)},${y} ${Math.min(width, x + 0.75)},${y}`
          return (
            <polyline
              fill="none"
              key={index}
              points={dot}
              stroke={color}
              strokeLinecap="round"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
            />
          )
        }

        const line = segment.map((point) => `${point.x},${point.y}`).join(' ')
        const area = `${segment[0].x},${height} ${line} ${segment[segment.length - 1].x},${height}`
        return (
          <g key={index}>
            <polygon fill={`url(#${gradientId})`} points={area} />
            <polyline
              fill="none"
              points={line}
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}
