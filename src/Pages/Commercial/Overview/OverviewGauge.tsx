import {
  GAUGE_GEOMETRY,
  GAUGE_SCALE,
  gaugeArcPath,
  gaugeLabelPoint,
  gaugePoint,
  type GaugeTone,
  type OverviewGaugeModel,
} from './overviewGaugeModel'

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
 * Velocímetro semicircular de 0% a 150%, em SVG puro.
 *
 * A composição é: arco com trilho, progresso medido, risco radial de 100% com o
 * rótulo no topo dele, marcador do resultado, percentual central e, mais
 * abaixo, a comparação com o período anterior. Os limites 0% e 150% ficam ao
 * lado das pontas do arco, o que libera a faixa central inferior para a
 * comparação sem nenhuma sobreposição.
 *
 * O progresso inteiro usa a cor do indicador, do zero até onde o resultado
 * chegou: azul na Meta Comercial e roxo na Supermeta Total, inclusive acima de
 * 100%. O arco responde "quanto", e a identidade do card não muda no meio do
 * caminho. Quem comunica resultado positivo é o texto, em verde, com o
 * triângulo e a leitura acessível junto. O modelo continua separando o trecho
 * até 100% do trecho de superação, porque essa separação é a regra do
 * indicador; aqui os dois apenas compartilham a mesma cor.
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
    limitEndX,
    limitStartX,
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
      {/* Mesma cor do trecho anterior. As pontas arredondadas dos dois caminhos
          se sobrepõem exatamente em 100%, dentro da própria espessura do traço,
          então o arco fica contínuo: nem emenda, nem engrossamento. */}
      {over === '' ? null : (
        <path
          d={over}
          fill="none"
          stroke={baseColor}
          strokeLinecap="round"
          strokeWidth={trackWidth}
        />
      )}

      {/* Referência principal da escala: risco cinza em 100% mais o rótulo.
          Risco e rótulo saem do mesmo token dos limites 0% e 150%, então os
          quatro têm exatamente a mesma cor e o mesmo peso. */}
      <line
        stroke={GAUGE_SCALE.color}
        strokeLinecap="round"
        strokeWidth={GAUGE_SCALE.tickWidth}
        x1={referenceStart.x}
        x2={referenceEnd.x}
        y1={referenceStart.y}
        y2={referenceEnd.y}
      />
      <text
        fill={GAUGE_SCALE.color}
        fontSize={GAUGE_SCALE.fontSize}
        fontWeight={GAUGE_SCALE.fontWeight}
        textAnchor="middle"
        x={referenceLabel.x}
        y={referenceLabel.y}
      >
        100%
      </text>

      {/* O marcador acompanha o arco: sempre a cor do indicador, abaixo,
          exatamente em e acima de 100%. */}
      {marker === null ? null : (
        <circle
          cx={marker.x}
          cy={marker.y}
          fill={baseColor}
          r={6.5}
          stroke="var(--surface)"
          strokeWidth={2.4}
        />
      )}

      {/* Percentual central no tamanho aprovado. Só os textos que não são
          percentual usam o corpo menor: `Não se aplica` e `Sem meta` são
          largos demais para 25 na fonte monoespaçada e invadiriam o arco. */}
      <text
        className="font-mono"
        fill="var(--text-heading)"
        fontSize={model.kind === 'neutral' || model.percentLabel.length > 8 ? 14 : 25}
        fontWeight={700}
        textAnchor="middle"
        x={centerX}
        y={GAUGE_GEOMETRY.percentBaseline}
      >
        {model.percentLabel}
      </text>

      {/* Comparação com o período anterior, imediatamente abaixo do percentual.
          Os textos neutros longos, como `Sem comparação neste recorte`, caem um
          corpo: no tamanho cheio eles encostariam nas bordas do viewBox. */}
      <text
        fill={toneColor(model.comparison.tone)}
        fontSize={model.comparison.label.length > 22 ? 11.5 : 13.5}
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
        fill={GAUGE_SCALE.color}
        fontSize={GAUGE_SCALE.fontSize}
        fontWeight={GAUGE_SCALE.fontWeight}
        textAnchor="start"
        x={limitStartX}
        y={GAUGE_GEOMETRY.limitBaseline}
      >
        0%
      </text>
      <text
        fill={GAUGE_SCALE.color}
        fontSize={GAUGE_SCALE.fontSize}
        fontWeight={GAUGE_SCALE.fontWeight}
        textAnchor="end"
        x={limitEndX}
        y={GAUGE_GEOMETRY.limitBaseline}
      >
        150%
      </text>
    </svg>
  )
}

/**
 * Rodapé do velocímetro: Realizado, situação da meta e Meta/Supermeta.
 *
 * O arranjo é decidido pela largura REAL do card, não pela do monitor, por um
 * `container query` declarado em `styles.css`. A grade executiva passa a cinco
 * colunas em `xl`, então 1280 px produz cards MENORES que 1024 px: uma regra
 * por `@media` inverteria justamente o caso mais apertado. Enquanto o card é
 * estreito, Realizado e objetivo dividem a primeira linha e a situação ocupa
 * uma linha inteira abaixo; a partir do piso do container o rodapé volta às
 * três áreas em uma linha só.
 *
 * Foi esse arranjo que permitiu subir a situação de 8,5 px para 10,5 px. Nas
 * três colunas fixas o pior caso é o recorte Corporativo, em que `Corporativo`
 * e `Não se aplica` ocupam as laterais e sobra pouco para `Indicador
 * consolidado`: nos tamanhos novos a palavra `consolidado` não caberia em
 * 1280 px e o texto seria partido no meio.
 *
 * O `break-words` continua como último recurso, para o texto quebrar em vez de
 * invadir as colunas vizinhas caso algum recorte futuro traga uma palavra ainda
 * maior.
 *
 * O `-mx-2` devolve ao rodapé parte do padding lateral do card. Só ele precisa
 * dessa largura extra, então o recuo fica aqui em vez de afinar o padding do
 * card inteiro e desalinhar o cabeçalho dos cinco cards.
 */
export function OverviewGaugeFooter({ model }: { model: OverviewGaugeModel }) {
  const { left, right } = model.footer
  const triangle = model.gap.direction === null ? null : TRIANGLE[model.gap.direction]

  return (
    <div className="overview-gauge-footer -mx-2 mt-auto border-t border-[var(--divider)] pt-2">
      <div className="overview-gauge-footer-grid">
        <div>
          <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]">
            {left.term}
          </p>
          <p className="text-[10.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]">
            {left.value}
          </p>
        </div>

        <p
          className={`overview-gauge-footer-status min-w-0 text-center text-[10.5px] font-semibold leading-[1.25] break-words ${toneTextClass(model.gap.tone)}`}
        >
          {triangle === null ? null : <span aria-hidden="true">{triangle} </span>}
          {model.gap.directionText === null ? null : (
            <span className="sr-only">{model.gap.directionText} </span>
          )}
          {model.gap.label}
        </p>

        <div className="text-right">
          <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]">
            {right.term}
          </p>
          <p className="text-[10.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]">
            {right.value}
          </p>
        </div>
      </div>
    </div>
  )
}
