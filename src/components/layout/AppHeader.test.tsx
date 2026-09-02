import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OS_SIMULATED_BADGE, OS_SIMULATED_EXPLANATION } from '../../data/mockOsCatalog'
import { OVERVIEW_OS_SOURCE_EXPLANATION } from '../../data/overviewOsMeta'
import { AppHeader } from './AppHeader'

/**
 * O cabeçalho deixou de montar os controles de filtro: eles vivem no painel da
 * própria Visão Geral. Aqui fica provado que o cabeçalho segue com título,
 * subtítulo e data, e que o aviso de dados simulados existe SOMENTE nas
 * páginas analíticas que seguem na simulação: a Visão Geral, sobre a fonte
 * sanitizada, não carrega aviso nem espaço reservado no lugar dele.
 */
describe('AppHeader sem controles de filtro', () => {
  it('mantém título, subtítulo e data de atualização na Visão Geral', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).toContain('Visão Geral')
    expect(html).toContain('Atualizado')
    expect(html).toContain('21/08/2026')
  })

  it('não renderiza nenhum controle nem texto da antiga barra de filtros', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).not.toContain('<select')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain('>Equipe<')
    expect(html).not.toContain('overflow-x-auto')
  })
})

/**
 * O selo da direita deixou de afirmar "Atualizado" o tempo inteiro.
 *
 * Com as Visões Gerais ligadas ao serviço de BI existem dois momentos em que a
 * afirmação seria falsa: enquanto a página busca, e quando o serviço não
 * responde. Nos dois, o texto muda junto com a cor do ponto, porque a
 * informação precisa estar escrita e não só colorida.
 */
describe('selo do estado da fonte', () => {
  it('mostra a data quando a fonte está pronta', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).toContain('Atualizado · 21/08/2026')
  })

  it('troca a data por Atualizando os dados enquanto a página busca', () => {
    const html = renderToStaticMarkup(
      <AppHeader page="overview" status="loading" updatedAt="21/08/2026" />,
    )

    expect(html).toContain('Atualizando os dados')
    expect(html).not.toContain('Atualizado ·')
    expect(html).not.toContain('21/08/2026')
  })

  it('avisa que os dados estão indisponíveis quando o serviço falha', () => {
    const html = renderToStaticMarkup(
      <AppHeader page="overview" status="unavailable" updatedAt="21/08/2026" />,
    )

    expect(html).toContain('Dados indisponíveis')
    expect(html).not.toContain('Atualizado ·')
    expect(html).not.toContain('21/08/2026')
  })
})

describe('aviso de dados simulados por página', () => {
  it('a Visão Geral não mostra badge nem explicação de origem, sem espaço reservado', () => {
    const html = renderToStaticMarkup(<AppHeader page="overview" updatedAt="21/08/2026" />)

    expect(html).not.toContain(OS_SIMULATED_BADGE)
    expect(html).not.toContain(OS_SIMULATED_EXPLANATION)
    expect(html).not.toContain(OVERVIEW_OS_SOURCE_EXPLANATION)
    // Sem o aviso, o parágrafo dele nem existe: o cabeçalho termina na linha
    // do título, como nas páginas administrativas.
    expect((html.match(/<p/g) ?? []).length).toBe(1)
  })

  it('as páginas analíticas simuladas mantêm o badge e a explicação de sempre', () => {
    const html = renderToStaticMarkup(<AppHeader page="temporal" updatedAt="21/08/2026" />)

    expect(html).toContain(OS_SIMULATED_BADGE)
    expect(html).toContain(OS_SIMULATED_EXPLANATION)
    expect(html).not.toContain(OVERVIEW_OS_SOURCE_EXPLANATION)
  })

  it('páginas administrativas seguem sem o aviso', () => {
    const html = renderToStaticMarkup(<AppHeader page="users" />)

    expect(html).not.toContain(OS_SIMULATED_BADGE)
  })

  it('páginas departamentais (page null) seguem sem o aviso', () => {
    const department = renderToStaticMarkup(
      <AppHeader page={null} subtitle="Subtítulo" title="Comercial" />,
    )

    expect(department).toContain('Comercial')
    expect(department).not.toContain(OS_SIMULATED_BADGE)
  })
})
