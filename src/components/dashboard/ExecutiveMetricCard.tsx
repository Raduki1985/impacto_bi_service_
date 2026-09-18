import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { Lightbulb, type LucideIcon } from 'lucide-react'

import type { Theme } from '../../contexts/PreferencesContextCore'
import {
  compactPreviousPeriod,
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
 *
 * Frente e leitura gerencial são duas faces empilhadas na mesma célula de uma
 * grade de uma coluna, e não uma camada absoluta por cima da outra. É isso
 * que faz o card ter a altura da face mais alta em qualquer largura: a
 * leitura nunca é cortada, a grade da página iguala os cards da mesma linha e
 * abrir a leitura não muda a altura de nada, porque as duas faces já estão
 * medidas o tempo todo. Nenhum piso de altura mora aqui (decisão de
 * 09/09/2026): quem precisa de piso declara `minHeight` na própria página.
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
 * No tema claro a leitura é escura, como aprovado, e usa o Azul Primário
 * institucional `#01225c` em cor chapada, o mesmo da faixa da marca no topo do
 * portal. No tema escuro ela passa a uma superfície cinza-azulada clara, e
 * todos os textos mudam junto: nada de texto branco sobre fundo claro. O verde
 * e o amarelo também escurecem no tema escuro para manterem contraste,
 * continuando reconhecíveis como verde Impacto e amarelo da lâmpada.
 *
 * `surface` aceita cor chapada ou degradê, por isso vai em `background`.
 */
const readingTheme = {
  light: {
    surface: '#01225c',
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
  /**
   * Definição do indicador, presa à BASE da frente do card.
   *
   * É o padrão da coleção executiva depois que o minigráfico saiu: a frente diz
   * o que o número conta, e a interpretação continua na leitura gerencial, a um
   * clique. Diferente de `detail`, que acompanha o valor logo abaixo dele e
   * qualifica aquele recorte, esta frase fecha o card e não se move quando o
   * valor muda de tamanho.
   *
   * Não vale para `gauge`: o velocímetro já ocupa a base com realizado e meta.
   */
  definition?: string
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
  /**
   * Piso de altura em px, opcional.
   *
   * Sem piso, o card tem a altura do conteúdo: a frente ou a leitura gerencial,
   * a que for mais alta, e a grade da página iguala os cards da mesma linha. O
   * piso existe para fileiras que precisam acompanhar um card mais alto que
   * está em OUTRA linha, como o velocímetro da Visão Geral Comercial: é uma
   * decisão da página, não do card, por isso não há valor padrão.
   */
  minHeight?: number
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
  definition,
  delta,
  deltaInAccessibleText,
  detail,
  footer,
  icon: Icon,
  label,
  minHeight,
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
   * O rótulo completo, `vs. período anterior`, é o padrão. A forma compacta só
   * aparece quando a face da frente tem menos de 156px de largura útil, que é
   * onde `▲ 100,0% vs. período anterior` (154px) deixaria de caber e sairia
   * cortado com reticências. As duas formas vão para o HTML e a largura real
   * do card, medida por container query, decide qual fica visível: nada
   * depende da largura do monitor. Rótulos sem a expressão, como
   * `Sem período anterior`, não ganham forma compacta.
   *
   * O trecho `sr-only` também é a descrição acessível do card: como o
   * `aria-label` do `article` substitui o nome calculado pelos filhos, é o
   * `aria-describedby` que faz a comparação e a interpretação chegarem ao foco.
   */
  const compactLabel = delta === undefined ? null : compactPreviousPeriod(delta.label)
  const deltaText =
    delta === undefined || compactLabel === null ? null : (
      <p
        className={`max-w-full truncate ${executiveSemanticTextClass}`}
        style={{ color: executiveDeltaColors[theme === 'dark' ? 'dark' : 'light'][delta.tone] }}
      >
        {compactLabel === delta.label ? (
          <span aria-hidden="true">{delta.label}</span>
        ) : (
          <>
            <span aria-hidden="true" className="@max-[156px]:hidden">
              {delta.label}
            </span>
            <span aria-hidden="true" className="hidden @max-[156px]:inline">
              {compactLabel}
            </span>
          </>
        )}
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
      // Grade de uma coluna: frente e leitura ocupam a mesma célula, e a altura
      // do card é a da face mais alta. O piso, quando existe, vem da página.
      className="group relative grid cursor-pointer grid-cols-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      role="button"
      style={minHeight === undefined ? undefined : { minHeight }}
      tabIndex={0}
    >
      {/* Frente do card. `@container` faz a largura útil desta face ser a
          medida que escolhe entre o rótulo completo e o compacto da
          comparação, sem depender da largura do monitor. */}
      <div className="@container col-start-1 row-start-1 flex min-w-0 flex-col px-4 py-3.5">
        <div className="flex min-h-8 items-start justify-between gap-2">
          {/* O título quebra em duas linhas em vez de truncar. Como a altura da
              linha é definida pelo ícone, duas linhas de 10,5px cabem sem mudar
              a altura do cabeçalho nem desalinhar os cards: são 24,2px dentro
              dos 32px da caixa do ícone. */}
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
          {/* Caixa do ícone: 32px desde 17/09/2026, quando o Mário pediu cards
              menos altos. Ela é o que define a altura do cabeçalho, porque o
              título tem 12px, então cada pixel aqui é um pixel na fileira. */}
          <span
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
            style={{ background: `${color}1a`, color }}
          >
            <Icon aria-hidden="true" size={16} />
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
            {/* Respiro curto entre o título e o número: a caixa do ícone já
                afasta os dois, e era daqui que vinha a sensação de card alto. */}
            <div className={`${VALUE_AREA} mt-0.5`}>
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
            {definition === undefined ? null : (
              // `mt-auto` empurra a frase para a base: os cards da fileira ficam
              // com a definição na mesma linha, mesmo quando um deles tem
              // `detail` e o outro não.
              <p className="mt-auto pt-2 text-[11px] leading-[1.35] text-[var(--text-secondary)]">
                {definition}
              </p>
            )}
            {footer}
          </>
        )}
      </div>

      {/* Leitura gerencial: a segunda face, na mesma célula da frente. Fechada,
          ela continua ocupando a célula, invisível e sem receber clique, e é
          por isso que abrir não muda a altura do card nem da fileira. */}
      <div
        aria-hidden={!open}
        className={`col-start-1 row-start-1 flex min-w-0 flex-col px-4 py-3.5 transition duration-200 motion-reduce:transition-none ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0 motion-reduce:translate-y-0'}`}
        id={readingId}
        style={{ background: reading.surface, color: reading.body }}
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

