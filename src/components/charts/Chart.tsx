import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

type ChartProps = {
  option: EChartsOption
  height?: number
  minWidth?: number
}

export function Chart({ option, height = 300, minWidth }: ChartProps) {
  return (
    <div className="w-full overflow-x-auto">
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        style={{ height, minWidth: minWidth ? `${minWidth}px` : undefined }}
      />
    </div>
  )
}
