import {
  GAUGE_GEOMETRY,
  gaugeArcPath,
  gaugeLabelPoint,
  gaugePoint,
  type GaugeTone,
  type OverviewGaugeModel,
} from './overviewGaugeModel'

/** Verde Impacto da superação, acima de 100%. */
const OVER_COLOR = '#00a862'
const POSITIVE_COLOR = '#00a862'
const NEGATIVE_COLOR = '#d32744'

/** Triângulo preenchido, no lugar do ícone de seta. */
const TRIANGLE = { up: '▲', down: '▼' } as const

function toneColor(tone: GaugeTone): string {
  if (tone === 'positive') return POSITIVE_COLOR
  if (tone === 'negative') return NEGATIVE_COLOR
  return 'var(--text-secondary)'
}

function toneTextClass(tone: GaugeTone): string {
  if (tone === 'positive') return 'text-[#00a862]'
  if (tone === 'negative') return 'text-[#d32744]'
  return 'text-[var(--text-secondary)]'
}

/**
 * Cinza neutro do risco de 100%.
 *
 * É o mesmo token do texto secundário, que já muda com o tema: escuro sobre a
 * superfície clara, claro sobre a escura. Nunca a cor da Meta, da Supermeta nem
 * da superação, porque o risco é escala, não resultado.
 */
const REFERENCE_COLOR = 'var(--text-secondary)'

/**
 * Velocímetro semicircular de 0% a 150%, em SVG puro.
 *
 * A composição é: arco com trilho, primeiro estágio, trecho verde de superação,
 * risco radial de 100% com o rótulo no topo dele, marcador do resultado,
 * percentual central e, mais abaixo, a comparação com o período anterior. Os
 * limites 0% e 150% ficam ao lado das pontas do arco, o que libera a faixa
 * central inferior para a comparação sem nenhuma sobreposição.
 *
 * No estado neutro só o trilho é desenhado: nenhum marcador aparece em posição
 * que possa ser lida como resultado.
 */
export function OverviewGauge({
  baseColor,
  model,
}: {
  baseColor: string
  model: OverviewGaugeModel
}) {
  const {
    centerX,
    referenceLabelOffset,
    referenceTickInset,
    referenceTickReach,
    trackWidth,
    viewBox,
  } = GAUGE_GEOMETRY
  const track = gaugeArcPath(0, 1)
  const base = model.base === null ? '' : gaugeArcPath(model.base.from, model.base.to)
  const over = model.over === null ? '' : gaugeArcPath(model.over.from, model.over.to)
  // Risco radial de 100%: começa na borda interna da barra, atravessa o traço e
  // avança para fora, além do marcador. Como os dois pontos saem do mesmo ângulo
  // da escala, ele acompanha a inclinação do arco em vez de ser uma linha reta
  // sem relação com o desenho.
  const referenceStart = gaugeLabelPoint(model.reference, -referenceTickInset)
  const referenceEnd = gaugeLabelPoint(model.reference, referenceTickReach)
  // O rótulo continua na mesma direção radial, no topo do risco, afastado do
  // arco e do marcador mesmo quando o resultado encosta em 100%.
  const referenceLabel = gaugeLabelPoint(model.reference, referenceLabelOffset)
  const marker = model.marker === null ? null : gaugePoint(model.marker)
  const comparisonTriangle =
    model.comparison.direction === null ? '' : `${TRIANGLE[model.comparison.direction]} `

  return (
    <svg
      aria-hidden="true"
      className="mx-auto mt-1 block w-full max-w-[190px]"
      preserveAspectRatio="xMidYMid meet"
      viewBox={viewBox}
    >
      <path
        d={track}
        fill="none"
        stroke="var(--divider)"
        strokeLinecap="round"
        strokeWidth={trackWidth}
      />
      {base === '' ? null : (
        <path
          d={base}
          fill="none"
          stroke={baseColor}
          strokeLinecap="round"
          strokeWidth={trackWidth}
        />
      )}
      {over === '' ? null : (
        <path
          d={over}
          fill="none"
          stroke={OVER_COLOR}
          strokeLinecap="round"
          strokeWidth={trackWidth}
        />
      )}

      {/* Referência principal da escala: risco cinza em 100% mais o rótulo. */}
      <line
        stroke={REFERENCE_COLOR}
        strokeLinecap="round"
        strokeWidth={2.6}
        x1={referenceStart.x}
        x2={referenceEnd.x}
        y1={referenceStart.y}
        y2={referenceEnd.y}
      />
      <text
        fill={REFERENCE_COLOR}
        fontSize={9}
        fontWeight={700}
        textAnchor="middle"
        x={referenceLabel.x}
        y={referenceLabel.y}
      >
        100%
      </text>

      {marker === null ? null : (
        <circle
          cx={marker.x}
          cy={marker.y}
          fill={
            model.attainment !== null && model.attainment > 1 ? OVER_COLOR : baseColor
          }
          r={6.5}
          stroke="var(--surface)"
          strokeWidth={2.4}
        />
      )}

      <text
        className="font-mono"
        fill="var(--text-heading)"
        fontSize={model.percentLabel.length > 8 ? 14 : 25}
        fontWeight={700}
        textAnchor="middle"
        x={centerX}
        y={GAUGE_GEOMETRY.percentBaseline}
      >
        {model.percentLabel}
      </text>

      {/* Comparação com o período anterior, imediatamente abaixo do percentual. */}
      <text
        fill={toneColor(model.comparison.tone)}
        fontSize={12}
        fontWeight={600}
        textAnchor="middle"
        x={centerX}
        y={GAUGE_GEOMETRY.comparisonBaseline}
      >
        {comparisonTriangle}
        {model.comparison.label}
      </text>

      {/* Limites da escala, ao lado das pontas do arco. */}
      <text
        fill="var(--text-secondary)"
        fontSize={9}
        textAnchor="start"
        x={4}
        y={GAUGE_GEOMETRY.limitBaseline}
      >
        0%
      </text>
      <text
        fill="var(--text-secondary)"
        fontSize={9}
        textAnchor="end"
        x={196}
        y={GAUGE_GEOMETRY.limitBaseline}
      >
        150%
      </text>
    </svg>
  )
}

/**
 * Rodapé de três áreas: Realizado, distância até o objetivo e Meta/Supermeta.
 *
 * As duas laterais são colunas `auto`, que se dimensionam pelo conteúdo:
 * `795 vendas` e `800 vendas` pedem a largura de que precisam e ficam em uma
 * linha, inclusive em 1280 px, onde cada card executivo tem pouco mais de
 * 180 px. Três colunas iguais espremiam justamente esses números. O centro é a
 * única coluna elástica, absorve a sobra e quebra em até duas linhas.
 *
 * O piso do centro é `min-content`, e não zero. Com `minmax(0,1fr)` a coluna
 * podia ficar mais estreita que a maior palavra do texto, e aí o `break-words`
 * partia a palavra: em 1280 px com barra de rolagem clássica sobravam 47,2 px
 * para um `consolidado` de 47,7 px, e `Indicador consolidado` virava três
 * linhas com a última letra sozinha. Com o piso, a palavra inteira sempre cabe
 * e a frase fica em duas linhas. O `break-words` continua ali como último
 * recurso: se algum dia nem o piso couber, o texto quebra em vez de invadir as
 * colunas laterais.
 *
 * O `-mx-2` devolve ao rodapé parte do padding lateral do card. Só ele precisa
 * dessa largura extra, então o recuo fica aqui em vez de afinar o padding do
 * card inteiro e desalinhar o cabeçalho dos cinco cards. São 8 px de cada lado
 * porque os 6 px anteriores deixavam o pior caso sem folga alguma: as laterais
 * do recorte Corporativo, `Corporativo` e `Não se aplica`, são os textos mais
 * largos do rodapé e é com elas que o centro precisa conviver.
 */
export function OverviewGaugeFooter({ model }: { model: OverviewGaugeModel }) {
  const { left, right } = model.footer
  const triangle = model.gap.direction === null ? null : TRIANGLE[model.gap.direction]

  return (
    <div className="-mx-2 mt-auto grid grid-cols-[auto_minmax(min-content,1fr)_auto] items-center gap-x-1 border-t border-[var(--divider)] pt-2">
      <div>
        <p className="whitespace-nowrap text-[7.5px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]">
          {left.term}
        </p>
        <p className="text-[9.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]">
          {left.value}
        </p>
      </div>

      <p
        className={`min-w-0 text-center text-[8.5px] font-semibold leading-[1.25] break-words ${toneTextClass(model.gap.tone)}`}
      >
        {triangle === null ? null : <span aria-hidden="true">{triangle} </span>}
        {model.gap.directionText === null ? null : (
          <span className="sr-only">{model.gap.directionText} </span>
        )}
        {model.gap.label}
      </p>

      <div className="text-right">
        <p className="whitespace-nowrap text-[7.5px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]">
          {right.term}
        </p>
        <p className="text-[9.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]">
          {right.value}
        </p>
      </div>
    </div>
  )
}
