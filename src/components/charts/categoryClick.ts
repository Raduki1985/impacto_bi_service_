/**
 * Clique na FAIXA inteira de uma categoria do eixo X, e não só na barra.
 *
 * Nasceu no `Volume diário de OS` em 24/09/2026: num dia com duas OS a barra
 * tem poucos pixels, e o Mário não conseguia abrir o dia. O ECharts só avisa
 * clique em barra, ponto ou rótulo; o fundo da área é da camada de desenho
 * dele, a zrender, e é nela que este clique é ouvido. A faixa é a mesma que o
 * ponteiro do tooltip já pinta quando o mouse passa sobre a categoria.
 *
 * Vive fora de `Chart.tsx` para ser testado sem navegador: o gráfico entra
 * pelo tipo mínimo abaixo, que o ECharts real atende e um falso de teste
 * também.
 */

/** Recebe a posição da categoria clicada, 0 para a primeira do eixo. */
export type CategoryClickHandler = (index: number) => void

/** O que o clique na faixa lê do evento da zrender. */
export type CategoryPointerEvent = {
  /** Elemento sob o ponteiro; vazio no fundo da área do gráfico. */
  readonly target?: unknown
  readonly offsetX: number
  readonly offsetY: number
}

/** O pedaço do ECharts que o clique na faixa usa. */
export type CategoryClickChart = {
  containPixel(finder: 'grid', point: number[]): boolean
  convertFromPixel(finder: { xAxisIndex: number }, value: number): number
  getZr(): {
    on(eventName: 'click' | 'mousemove', handler: (event: CategoryPointerEvent) => void): unknown
    setCursorStyle(cursorStyle: string): void
  }
}

/**
 * Posição da categoria sob o ponteiro, ou null quando o ponto não é fundo da
 * área do gráfico.
 *
 * Com elemento sob o ponteiro (barra, ponto, rótulo), o clique é de quem
 * escuta `onEvents`, que sabe também a SÉRIE clicada; contar aqui abriria a
 * mesma coisa duas vezes. Fora da grade (legenda, eixos, margens) não existe
 * categoria. Na borda direita exata da grade o arredondamento do ECharts passa
 * da última categoria: quem recebe a posição confere se ela existe.
 */
export function categoryIndexAt(
  chart: CategoryClickChart,
  event: CategoryPointerEvent,
): number | null {
  if (event.target) return null
  if (!chart.containPixel('grid', [event.offsetX, event.offsetY])) return null

  const index = chart.convertFromPixel({ xAxisIndex: 0 }, event.offsetX)
  if (!Number.isInteger(index) || index < 0) return null

  // Na metade esquerda da primeira faixa o arredondamento dá -0, que serve de
  // posição mas não é igual a 0 em toda comparação.
  return index === 0 ? 0 : index
}

/**
 * Liga o clique na faixa ao gráfico recém-criado.
 *
 * O manipulador é lido a CADA evento, e não guardado na ligação: o gráfico
 * vive mais que uma renderização da página, e o clique precisa abrir o recorte
 * atual, não o do dia em que o gráfico nasceu. Sem manipulador nada acontece,
 * nem a mão do cursor, e o gráfico fica como sempre foi.
 */
export function bindCategoryClick(
  chart: CategoryClickChart,
  currentHandler: () => CategoryClickHandler | undefined,
): void {
  const zr = chart.getZr()

  zr.on('click', (event) => {
    const handler = currentHandler()
    if (handler === undefined) return

    const index = categoryIndexAt(chart, event)
    if (index !== null) handler(index)
  })
  // A mão aparece na faixa inteira, e não só em cima da barra: é ela que diz
  // que o fundo do dia também abre. A zrender devolve o cursor ao padrão a
  // cada movimento, antes de chamar este ouvinte, então sair da faixa não
  // deixa a mão para trás.
  zr.on('mousemove', (event) => {
    if (currentHandler() !== undefined && categoryIndexAt(chart, event) !== null) {
      zr.setCursorStyle('pointer')
    }
  })
}
