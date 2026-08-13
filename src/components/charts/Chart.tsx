import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

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
}

export function Chart({ option, height = 300, minWidth, onEvents }: ChartProps) {
  return (
    <div className="w-full overflow-x-auto">
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        onEvents={onEvents}
        style={{ height, minWidth: minWidth ? `${minWidth}px` : undefined }}
      />
    </div>
  )
}
