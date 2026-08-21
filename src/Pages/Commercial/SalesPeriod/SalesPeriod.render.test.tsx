import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../../contexts/PreferencesContext'
import { getCommercialDataset } from '../../../data/mockCommercialData'
import { SalesPeriod } from './SalesPeriod'

/**
 * Teste de fumaça da página.
 *
 * Não substitui a validação visual: ele garante que a árvore renderiza em cada
 * estado, que a terminologia aprovada chega à tela e que os elementos retirados
 * deste bloco não voltam por engano. A ordem dos casos importa, porque o
 * primeiro depende de a base ainda não ter sido montada neste arquivo.
 */
function render() {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <SalesPeriod />
    </PreferencesProvider>,
  )
}

describe('página Vendas por Período', () => {
  it('mostra o estado de carregamento antes de a base existir', () => {
    const html = render()

    expect(html).toContain('Carregando as vendas ativas')
    expect(html).toContain('role="status"')
  })

  it('publica os quatro indicadores com os nomes aprovados', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Vendas ativadas')
    expect(html).toContain('Valor Vendas Ativadas')
    expect(html).toContain('Ticket médio mensal')
    expect(html).toContain('Valor de Instalações')
    // Os nomes mudaram; o cálculo não. Julho continua com 883 vendas ativas.
    expect(html).toContain('883')

    // Nenhum indicador de conversão entrou junto com o novo nome, e nenhum
    // texto afirma a data em que a ativação teria acontecido.
    expect(html).not.toContain('Taxa de ativação')
    expect(html).not.toContain('ativada em')

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('não traz meta, supermeta, ranking, time nem retorno à base', () => {
    getCommercialDataset()

    const html = render()

    for (const removed of [
      'Meta e Supermeta',
      'Supermeta',
      'Meta proporcional',
      'Top 5',
      'Vendas Comercial',
      'Vendas Corporativas',
      'Retornaram à base',
      'Retornou à base',
      'Todos os times',
      'Venda direta',
      'Distribuição por status',
      'Em andamento',
    ]) {
      expect(html).not.toContain(removed)
    }

    // `Corporativo` só pode aparecer como nome de plano da base mockada, nunca
    // como time, agrupamento ou filtro.
    const corporateMentions = html.match(/Corporativo/g) ?? []
    const corporatePlanMentions = html.match(/Link Corporativo/g) ?? []

    expect(corporateMentions).toHaveLength(corporatePlanMentions.length)
  })

  it('oferece somente os filtros superiores deste bloco', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Data inicial')
    expect(html).toContain('Data final')
    expect(html).toContain('Cidade de instalação')
    expect(html).toContain('Todos os vendedores')
    expect(html).toContain('Todas as origens')
    expect(html).toContain('Todos os planos')
    expect(html).toContain('Limpar filtros')

    expect(html).not.toContain('Todos os status')
    expect(html).not.toContain('CPF indicador')
    expect(html).not.toContain('Novos e retornados')
  })
})

/**
 * Comparação com o período anterior.
 *
 * O texto visível é abreviado; a leitura completa fica no conteúdo acessível.
 */
describe('comparação dos cards com o período anterior', () => {
  it('usa a abreviação aprovada no texto visível', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('vs. p.p.')
    // A forma extensa não é usada como rótulo visível.
    expect(html).not.toContain('vs período anterior')
  })

  it('mantém a expressão completa disponível para leitor de tela', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('versus período anterior')
    expect(html).toContain('Resultado')
  })

  it('publica uma comparação por card do resumo, sem repetir o percentual', () => {
    getCommercialDataset()

    const html = render()

    // Uma faixa de comparação por card, e a leitura completa aparece uma única
    // vez por card: ela não é repetida no nome acessível.
    expect((html.match(/flex h-\[24px\] items-center/g) ?? []).length).toBe(4)
    expect((html.match(/versus período anterior/g) ?? []).length).toBe(4)
  })

  it('não deixa resto de badge na comparação', () => {
    getCommercialDataset()

    const html = render()

    expect(html).not.toContain('inline-flex max-w-full items-center self-start')
    expect(html).not.toContain('rounded-md border')
    // A diferenciação semântica vem só da cor do texto.
    expect(html).toMatch(/color:#(00844d|b51d38|475467|5b6779)/)
  })
})

/**
 * Leitura gerencial dos três cards, com o bloco `OBSERVAR` na base.
 *
 * Os textos são os aprovados e descrevem o que cada minigráfico mostra: volume
 * diário, valor mensal contratado diário e ticket médio mensal diário.
 */
describe('leitura gerencial dos cards do resumo', () => {
  it('mantém os quatro cards como botão de leitura gerencial', () => {
    getCommercialDataset()

    const html = render()

    expect((html.match(/Leitura gerencial/g) ?? []).length).toBe(4)
    expect((html.match(/OBSERVAR/g) ?? []).length).toBe(4)
  })

  it('publica cada observação aprovada uma única vez', () => {
    getCommercialDataset()

    const html = render()

    for (const observe of [
      'Evolução diária do volume de vendas ativadas no período.',
      'Evolução diária do valor mensal contratado pelas vendas ativadas.',
      'Variação diária do valor médio mensal por venda ativada.',
      'Isenções e descontos aplicados nas instalações do período.',
    ]) {
      expect((html.match(new RegExp(observe.replace(/[.]/g, '\\.'), 'g')) ?? []).length).toBe(1)
    }
  })

  it('mantém os quatro minigráficos dos cards', () => {
    getCommercialDataset()

    const html = render()

    expect((html.match(/executive-spark-/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * Card `Valor de Instalações`.
 *
 * A instalação é cobrança única e mora em card próprio: ela não pode aparecer
 * somada à mensalidade nem descrita como receita recebida.
 */
describe('card de instalações', () => {
  it('usa o componente compartilhado, com valor único e comparação abreviada', () => {
    getCommercialDataset()

    const html = render()
    const cardStart = html.indexOf('Valor de Instalações')
    const card = html.slice(cardStart, html.indexOf('</article>', cardStart))

    expect(cardStart).toBeGreaterThan(-1)
    expect(card).toContain('valor único contratado nas instalações do recorte')
    expect(card).toContain('vs. p.p.')
    expect(card).toContain('OBSERVAR')
    // Mesmas faixas de altura dos demais cards do resumo.
    expect(card).toContain('flex h-[30px] items-end')
    expect(card).toContain('flex h-[24px] items-center')
  })

  it('não chama o valor de receita recebida nem o mistura à mensalidade', () => {
    getCommercialDataset()

    const html = render()

    for (const wrong of [
      'receita recebida',
      'valor recebido',
      'instalação mensal',
      'mensalidade com instalação',
    ]) {
      expect(html).not.toContain(wrong)
    }
  })

  it('mantém o aviso de dados sintéticos falando das instalações', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Os valores de instalação também são')
    expect(html).toContain('00603')
    expect(html).toContain('não representa a operação')
  })

  it('não acrescenta coluna de instalação à tabela detalhada', () => {
    getCommercialDataset()

    const html = render()

    expect((html.match(/<col style=/g) ?? []).length).toBe(9)
    expect(html).not.toContain('aria-label="Filtrar Instalação"')
    expect(html).not.toContain('>Instalação<')
  })
})

/**
 * Origem é a classificação da venda conforme o indicador, e nunca o canal pelo
 * qual o cliente entrou em contato.
 */
describe('origem das vendas', () => {
  it('mantém os nomes oficiais e as duas categorias', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Origem das vendas')
    expect(html).toContain('Indicação')
    expect(html).toContain('Vendedores')
    // O CPF do indicador nunca nomeia a origem.
    expect(html).not.toContain('Indicação 000.')
  })

  it('explica a regra pelo indicador, sem sugerir canal de aquisição', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Classificação da venda conforme o indicador')
    expect(html).toContain('com CPF de indicador, é Indicação')
    expect(html).toContain('sem indicador, é atribuída a Vendedores')

    for (const wrong of [
      'Como a venda chegou',
      'como o cliente chegou',
      'canal de aquisição',
      'Crédito da venda',
      'venda passiva',
      'prospecção',
    ]) {
      expect(html).not.toContain(wrong)
    }
  })
})

describe('tabela detalhada', () => {
  it('monta as nove colunas aprovadas com larguras fixas', () => {
    getCommercialDataset()

    const html = render()

    for (const column of [
      'Data de Início',
      'Contrato',
      'Cliente',
      'Vendedor',
      'Cidade de instalação',
      'Plano',
      'Status atual',
      'Origem',
    ]) {
      expect(html).toContain(column)
    }

    expect(html).not.toContain('>Time<')
    // Layout fixo com colgroup: as colunas param de depender do conteúdo.
    expect(html).toContain('table-fixed')
    expect((html.match(/<col style=/g) ?? []).length).toBe(9)
  })

  it('oferece filtro local nas seis colunas indicadas, e só nelas', () => {
    getCommercialDataset()

    const html = render()

    for (const column of [
      'Filtrar Cliente',
      'Filtrar Vendedor',
      'Filtrar Cidade de instalação',
      'Filtrar Plano',
      'Filtrar Valor mensal contratado',
      'Filtrar Status atual',
    ]) {
      expect(html).toContain(`aria-label="${column}"`)
    }

    expect(html).not.toContain('aria-label="Filtrar Data de Início"')
    expect(html).not.toContain('aria-label="Filtrar Contrato"')
    expect(html).not.toContain('aria-label="Filtrar Origem"')
    // Exatamente seis gatilhos, e nenhum painel aberto no primeiro render.
    expect((html.match(/aria-label="Filtrar [^"]*"/g) ?? []).length).toBe(6)
    expect(html).not.toContain('role="dialog"')
  })

  it('mantém a paginação alcançável e contando somente registros reais', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('Anterior')
    expect(html).toContain('Próxima')
    expect(html).toContain('de <b class="font-mono text-[var(--text-item)]">883</b> vendas')
    expect(html).toContain('aria-label="Paginação do detalhamento das vendas ativas iniciadas"')
    // Dez linhas reais na primeira página, sem linha falsa para completar.
    expect((html.match(/height:48px/g) ?? []).length).toBe(10)
  })

  it('reserva a altura de dez linhas para a paginação não subir', () => {
    getCommercialDataset()

    const html = render()

    // Cabeçalho de 40px mais dez linhas de 48px.
    expect(html).toContain('min-height:520px')
  })
})

describe('acessibilidade e identificação do mock', () => {
  it('publica a alternativa acessível do gráfico fora da área rolável', () => {
    getCommercialDataset()

    const html = render()
    const wrapped =
      html.match(/<div class="sr-only fixed left-0 top-0 pointer-events-none"><table>/g) ?? []

    expect(wrapped).toHaveLength(1)
    expect(html).toContain('<caption>')
    expect(html).toContain('<th scope="row">01/07/2026</th>')
    expect(html).toContain('<th scope="row">31/07/2026</th>')
  })

  it('mantém a identificação de que os dados são sintéticos', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('dados sintéticos')
    expect(html).toContain('não foram extraídos do SGI')
  })
})
