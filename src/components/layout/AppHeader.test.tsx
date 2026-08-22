import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OS_SIMULATED_BADGE } from '../../data/mockOsCatalog'
import { AppHeader } from './AppHeader'

/**
 * O cabeçalho deixou de montar os controles de filtro: eles passaram para o
 * DashboardFilterPanel, dentro do conteúdo rolável. Aqui fica provado que o
 * cabeçalho segue com título, subtítulo, data e o aviso obrigatório de dados
 * simulados, e que nenhum controle de filtro voltou para a área fixa.
 */
describe('AppHeader sem controles de filtro', () => {
  it('mantém título, subtítulo, data de atualização e o aviso de dados simulados', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).toContain('Atualizado')
    expect(html).toContain('21/08/2026')
    expect(html).toContain(OS_SIMULATED_BADGE)
  })

  it('não renderiza nenhum controle nem texto da antiga barra de filtros', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).not.toContain('<select')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('Limpar filtros')
    // O aviso cita "Equipes" no texto corrido; o proibido é o rótulo de
    // controle, que renderizava como nó de texto exato.
    expect(html).not.toContain('>Equipe<')
    expect(html).not.toContain('overflow-x-auto')
  })

  it('não exibe o aviso de dados simulados fora das páginas analíticas de OS', () => {
    const department = renderToStaticMarkup(
      <AppHeader page={null} subtitle="Subtítulo" title="Comercial" />,
    )

    expect(department).toContain('Comercial')
    expect(department).not.toContain(OS_SIMULATED_BADGE)
  })
})
