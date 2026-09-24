import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'

import { bindCategoryClick, type CategoryClickHandler } from './categoryClick'

/**
 * Manipulador de evento do ECharts. O parâmetro chega sem tipo estável da
 * biblioteca, então quem consome faz a própria checagem.
 */
export type ChartEventHandler = (params: unknown) => void

type ChartProps = {
  option: EChartsOption
  height?: number
  minWidth?: number
  /**
   * Eventos do ECharts, por nome (`legendselectchanged`, `click`, ...).
   *
   * Opcional e sem efeito nos gráficos que não passam nada: os consumidores
   * atuais continuam exatamente como estavam.
   */
  onEvents?: Readonly<Record<string, ChartEventHandler>>
  /**
   * Clique no FUNDO da faixa de uma categoria do eixo X, fora de barra, ponto
   * e rótulo, com a posição da categoria (ver `categoryClick.ts`). Barra,
   * ponto e rótulo seguem com o `click` de `onEvents`.
   *
   * Opcional e sem efeito nos gráficos que não passam nada, como `onEvents`.
   */
  onCategoryClick?: CategoryClickHandler
}

/**
 * Único ponto do portal que desenha um gráfico ECharts.
 *
 * Além de `notMerge` e `lazyUpdate`, ele resolve sozinho, desde 24/09/2026,
 * o problema das fontes: o ECharts mede os rótulos dos eixos no PRIMEIRO
 * layout, com a fonte que o navegador tiver naquele instante, e não refaz a
 * medida quando a IBM Plex chega. Num repaint posterior o texto sai mais
 * largo do que a faixa reservada e é amputado à esquerda. Até então cada
 * página lembrava de forçar um redesenho ao fim do carregamento das fontes
 * (a Visão Geral de OS e a Gestão de Técnicos tinham o mesmo efeito copiado);
 * agora o gráfico redesenha as opções em vigor quando `document.fonts`
 * termina, e página nova não precisa saber que isso existe.
 *
 * O redesenho pega o gráfico que está NA TELA naquele instante, pela
 * referência do componente da biblioteca, e não um guardado antes: a
 * biblioteca monta um gráfico provisório, mede o espaço, descarta e monta o
 * definitivo, e descarta de novo ao sair da página. Com um gráfico guardado,
 * o redesenho caía às vezes num já descartado (visto no navegador em
 * 24/09/2026, trocando de tema e de página em seguida).
 */
export function Chart({ option, height = 300, minWidth, onEvents, onCategoryClick }: ChartProps) {
  // O clique no fundo é ligado quando o gráfico fica pronto; a referência
  // entrega a ele o manipulador da última renderização, com o recorte atual
  // da página.
  const categoryClick = useRef(onCategoryClick)
  // As opções da última renderização, para o redesenho depois das fontes usar
  // o que está na tela, e não o que estava na montagem.
  const latestOption = useRef(option)
  const chartRef = useRef<ReactECharts>(null)
  useEffect(() => {
    categoryClick.current = onCategoryClick
    latestOption.current = option
  })

  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return

    let active = true
    void document.fonts.ready.then(() => {
      if (!active) return
      // Sem gráfico ainda, ou já descartado, não há o que refazer: o próximo
      // a nascer mede com as fontes prontas.
      const chart = chartRef.current?.getEchartsInstance()
      if (chart !== undefined && !chart.isDisposed()) chart.setOption(latestOption.current, true)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="w-full overflow-x-auto">
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        onEvents={onEvents}
        onChartReady={(chart) => bindCategoryClick(chart, () => categoryClick.current)}
        ref={chartRef}
        style={{ height, minWidth: minWidth ? `${minWidth}px` : undefined }}
      />
    </div>
  )
}
