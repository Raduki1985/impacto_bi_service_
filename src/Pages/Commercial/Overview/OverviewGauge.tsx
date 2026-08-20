import type { Theme } from '../../../contexts/PreferencesContextCore'
import {
  commercialDeltaColors,
  commercialSemanticTextClass,
} from '../components/commercialCardModel'
import {
  GAUGE_GEOMETRY,
  GAUGE_SCALE,
  gaugeArcPath,
  gaugeLabelPoint,
  gaugePoint,
  type GaugeTone,
  type OverviewGaugeModel,
} from './overviewGaugeModel'

/** Triângulo preenchido, no lugar do ícone de seta. */
const TRIANGLE = { up: '▲', down: '▼' } as const

/**
 * Altura útil do desenho.
 *
 * A comparação com o período anterior saiu do SVG e virou o texto comparativo
 * do card comercial, renderizado em HTML logo abaixo do arco. Sem aquele texto,
 * o elemento mais baixo passa a ser a linha dos limites da escala, e o viewBox
 * encurta na mesma medida para não deixar uma faixa vazia entre o velocímetro e
 * a comparação. A geometria do arco não mudou.
 */
const GAUGE_VIEWBOX = '0 0 200 94'

/**
 * Cor da distância até a meta, por tom e por tema.
 *
 * Sai da MESMA paleta da comparação com o período anterior, e não de valores
 * próprios: os dois textos dizem a mesma coisa em posições diferentes do card,
 * e o vermelho `#d32744` que estava aqui não era o vermelho semântico do
 * portal. Uma segunda tabela de cores fazia os dois divergirem em silêncio.
 *
 * O tom neutro também vem da paleta, em vez de `--text-secondary`: assim os
 * três estados do rodapé pertencem à mesma escala e mudam juntos por tema.
 */
function toneTextColor(tone: GaugeTone, theme: Theme): string {
  const palette = commercialDeltaColors[theme === 'dark' ? 'dark' : 'light']
  if (tone === 'positive') return palette.favoravel
  if (tone === 'negative') return palette.desfavoravel

  return palette.neutro
}

/**
 * Velocímetro semicircular de 0% a 150%, em SVG puro.
 *
 * A composição é: arco com trilho, progresso medido, risco radial de 100% com o
 * rótulo no topo dele, marcador do resultado e percentual central. Os limites
 * 0% e 150% ficam ao lado das pontas do arco.
 *
 * A comparação com o período anterior NÃO é desenhada aqui: ela é um texto
 * simples, posicionado em HTML logo abaixo do arco pelo card comercial. Manter
 * as duas formas mostraria o mesmo percentual duas vezes. O modelo continua
 * sendo a fonte da comparação, e o card apenas a exibe.
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

  return (
    <svg
      aria-hidden="true"
      className="mx-auto mt-1 block w-full max-w-[190px]"
      preserveAspectRatio="xMidYMid meet"
      viewBox={GAUGE_VIEWBOX}
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
 * Os dois cards usam esta MESMA composição, com os mesmos tokens de tipografia
 * nos rótulos e nos valores laterais: o que muda entre eles é só o conteúdo. O
 * bloco esquerdo fica alinhado à esquerda, o direito à direita e a situação no
 * centro, e as duas laterais dividem a sobra em partes iguais, para o texto
 * central cair no meio geométrico do card mesmo com `SUPERMETA` sendo mais
 * larga que `META`.
 *
 * O arranjo é decidido pela largura REAL do card, não pela do monitor, por um
 * `container query` declarado em `styles.css`. A grade executiva passa a cinco
 * colunas em `xl`, então 1280 px produz cards MENORES que 1024 px: uma regra
 * por `@media` inverteria justamente o caso mais apertado. Enquanto o card é
 * estreito, Realizado e objetivo dividem a primeira linha e a situação ocupa
 * uma linha inteira abaixo; a partir do piso do container o rodapé volta às
 * três áreas em uma linha só.
 *
 * Foi esse arranjo que permitiu subir a situação de 8,5 px até os 11 px do token
 * semântico compartilhado, que é o mesmo corpo da comparação com o período
 * anterior. Nas três áreas em uma linha o pior caso é o recorte Corporativo, em
 * que `Corporativo` e `Não se aplica` ocupam as laterais e sobra pouco para
 * `Indicador consolidado`: nos tamanhos novos a palavra `consolidado` não
 * caberia em 1280 px e o texto seria partido no meio. Duas linhas de 11 px com
 * entrelinha 1,25 medem 27,5 px e continuam cabendo nos 28 px reservados ao
 * rodapé, então a altura da dupla de cards não muda.
 *
 * O `break-words` continua como último recurso, para o texto quebrar em vez de
 * invadir as colunas vizinhas caso algum recorte futuro traga uma palavra ainda
 * maior.
 *
 * O `-mx-2` devolve ao rodapé parte do padding lateral do card. Só ele precisa
 * dessa largura extra, então o recuo fica aqui em vez de afinar o padding do
 * card inteiro e desalinhar o cabeçalho dos cinco cards.
 */
export function OverviewGaugeFooter({
  model,
  theme,
}: {
  model: OverviewGaugeModel
  theme: Theme
}) {
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
          className={`overview-gauge-footer-status min-w-0 break-words text-center ${commercialSemanticTextClass}`}
          style={{ color: toneTextColor(model.gap.tone, theme) }}
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
