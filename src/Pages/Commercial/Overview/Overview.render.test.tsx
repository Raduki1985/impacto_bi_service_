import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../../../contexts/AuthContextCore'
import { PreferencesProvider } from '../../../contexts/PreferencesContext'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { getCommercialDataset } from '../../../data/mockCommercialData'
import type { AuthUser } from '../../../types/user/userTypes'
import {
  commercialDeltaColors,
  // Volta com os testes do velocímetro dentro da página:
  // commercialSemanticTextClass as semanticToken,
} from '../components/commercialCardModel'
import { Overview } from './Overview'
import { OverviewGaugeFooter } from './OverviewGauge'
import { buildOverviewGaugeModel, type OverviewGaugeModel } from './overviewGaugeModel'

/**
 * Teste de fumaça da Visão Geral.
 *
 * Existe por causa da componentização dos cards e da comparação com o período
 * anterior: ele prova que os cinco cards continuam completos, que os valores de
 * negócio não mudaram e que a comparação aparece só onde foi aprovada.
 */
function authAs(profileCode: string): AuthContextValue {
  const user: AuthUser = {
    id: 'teste',
    name: 'Pessoa de teste',
    email: 'teste@impactotelecom.com',
    status: 'active',
    isActive: true,
    lastAccess: null,
    profileSystemId: 'teste-perfil-sistema',
    accessProfileId: 'teste-perfil-acesso',
    profileType: { id: 'teste-perfil-sistema', code: profileCode, name: profileCode },
    access: { id: 'teste-perfil-acesso', name: 'Perfil de teste' },
    setPasswordExpire: null,
    createdAt: '',
    updatedAt: '',
    departmentPageAccess: [],
  }

  return { user, login: async () => ({ ok: true }), logout: () => {}, hasPermission: () => true }
}

/** A página com quem entrou: Administrador por padrão, que tem o olho dos R$. */
function render(profile: string = 'adm') {
  return renderToStaticMarkup(
    <AuthContext.Provider value={authAs(profile)}>
      <PreferencesProvider>
        <Overview />
      </PreferencesProvider>
    </AuthContext.Provider>,
  )
}

/** Trecho de um único card, do rótulo dele até o fim do próprio `article`. */
function cardOf(html: string, label: string): string {
  const start = html.indexOf(label)
  expect(start).toBeGreaterThan(-1)

  return html.slice(start, html.indexOf('</article>', start))
}

describe('cards executivos da Visão Geral', () => {
  it('mantém os cinco cards, cada um como botão de leitura gerencial', () => {
    getCommercialDataset()

    const html = render()

    for (const label of [
      'Vendas ativadas',
      'Valor Vendas Ativadas',
      'Novos Clientes',
      'Tempo até a ativação',
      'Bloqueio ou cancelamento em 90 dias',
    ]) {
      expect(html).toContain(label)
    }
    // O card dos 90 dias ocupou a vaga do Aguardando Ativação em 28/09/2026,
    // decisão do Mário: a fila já aparece na Safra e na faixa Hoje ao vivo.
    expect(html).not.toContain('Aguardando Ativação')

    // A Supermeta Total saiu da coleção por decisão de gerência; a vaga dela
    // foi de Aguardando pagamento até 15/09/2026 e hoje é de Novos Clientes.
    expect(html).not.toContain('Supermeta Total')
    expect(html).not.toContain('Aguardando pagamento')
    // A Meta Comercial foi suspensa em 15/09/2026, decisão do Mário: a empresa
    // ainda não tem a regra do número. O Tempo até a ativação ocupou a vaga.
    expect(html).not.toContain('Meta Comercial')

    // Só os `article` dos cards entram na conta: a faixa de filtros da página
    // também publica um `aria-expanded="false"`, no botão de expandir.
    expect((html.match(/<article[^>]*aria-expanded="false"/g) ?? []).length).toBe(5)
    expect((html.match(/Leitura gerencial/g) ?? []).length).toBe(5)
    expect((html.match(/OBSERVAR/g) ?? []).length).toBe(5)
  })

  it('preserva os valores e os textos operacionais do recorte padrão', () => {
    getCommercialDataset()

    const html = render()

    // Julho de 2026: 883 vendas ativadas no recorte de abertura da base local.
    expect(html).toContain('883')
    // Sem a Meta Comercial, o rodapé do velocímetro saiu junto.
    expect(html).not.toContain('Realizado')
    expect(html).not.toMatch(/\d+ vendas? abaixo|Meta atingida|\d+ vendas? acima/)

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('não põe minigráfico nem frase na base, e mantém as composições em barra', () => {
    getCommercialDataset()

    const html = render()

    // Nenhum minigráfico: sem escala comum, cards vizinhos mostravam formas
    // parecidas para grandezas diferentes.
    expect(html).not.toContain('executive-spark-')
    // Nenhuma frase na base: ela saiu de todos os cards em 16/09/2026, porque o
    // rótulo e a leitura gerencial já dizem o que o indicador é.
    expect((html.match(/<p class="mt-auto pt-2 /g) ?? []).length).toBe(0)
    expect(html).not.toContain('vendas ativadas no recorte, base da taxa de ativação')
    expect(html).not.toContain('soma do valor mensal das vendas ativadas')
    // A ausência de dado continua explicada, mas só dentro da leitura gerencial.
    expect(html).toContain('A fonte em uso não diz quem já era cliente.')
    expect(html).toContain('A fonte em uso não diz quando a venda foi fechada.')
    // O card dos 90 dias depende do histórico de bloqueio, que a base
    // sintética não tem: ele diz isso na leitura, e não mostra zero.
    expect(html).toContain('Sem a situação no 90º dia para este recorte.')
    expect(html).not.toContain('Em aprovação')
    // A taxa de ativação saiu do card de Vendas ativadas em 16/09/2026, e o
    // Aguardando Ativação, que a narrava pela data da venda, saiu em 28/09.
    expect(html).not.toContain('taxa de ativação')
    expect(html).not.toContain('vendidos no período aguardam ativação')
    // A linha de detalhe com a origem das ativações, de 18/09/2026, depende de
    // uma medida que só o serviço manda: nesta base ela não é inventada.
    expect(cardOf(html, 'Vendas ativadas')).not.toContain('de vendas anteriores')
  })
})

/**
 * A comparação com o período anterior entra nos dois cards que a possuem na
 * base sintética. Novos Clientes, Tempo até a ativação e o card dos 90 dias
 * ficam de fora pela falta do dado nesta base: sem número, não há o que
 * comparar.
 */
/**
 * Olho dos valores em reais (regra do Mário em 28/09/2026, em
 * `moneyVisibility`). A página sempre abre com os R$ escondidos; o olho só
 * existe para Administrador e Executivo. O que muda com o olho aberto é
 * coberto nas funções que a página chama com os R$ à vista.
 */
describe('valores em reais escondidos na Visão Geral', () => {
  it('abre com os R$ escondidos em toda a página, sem nenhum valor à vista', () => {
    getCommercialDataset()

    const html = render()

    expect(cardOf(html, 'Valor Vendas Ativadas')).toContain('R$ •••••')
    expect(html).not.toMatch(/R\$\s?\d/)
  })

  it('Administrador e Executivo têm o olho no card de valor, fechado', () => {
    getCommercialDataset()

    for (const profile of ['adm', 'executive'] as const) {
      const card = cardOf(render(profile), 'Valor Vendas Ativadas')

      expect(card).toContain('aria-label="Mostrar os valores em reais da página"')
      expect(card).toMatch(/aria-pressed="false"[^>]*title="Mostrar os valores em reais da página"/)
    }
  })

  it('Analista não tem o olho e continua sem ver o valor', () => {
    getCommercialDataset()

    const html = render('analyst')

    expect(html).not.toContain('valores em reais da página')
    expect(cardOf(html, 'Valor Vendas Ativadas')).toContain('R$ •••••')
    expect(html).not.toMatch(/R\$\s?\d/)
  })
})

describe('comparações com o período anterior na Visão Geral', () => {
  it('publica exatamente duas comparações', () => {
    getCommercialDataset()

    const html = render()
    // A faixa da comparação só é montada quando o card tem `delta`.
    const faixas = html.match(/flex h-\[24px\] items-center/g) ?? []

    expect(faixas).toHaveLength(2)
  })

  it('apresenta a comparação só como texto, sem badge', () => {
    getCommercialDataset()

    const html = render()

    // Nenhum resto do badge: nem a superfície, nem o contorno arredondado.
    expect(html).not.toContain('inline-flex max-w-full items-center self-start')
    expect(html).not.toContain('rounded-md border')
    // As cores semânticas continuam vindo só do texto.
    expect(html).toMatch(/color:#(00844d|b51d38|475467|5b6779)/)
  })

  it('diz com o que compara e mantém a forma completa acessível', () => {
    getCommercialDataset()

    const html = render()

    // Desde 25/09/2026 o card nomeia a janela, como na Visão Geral de OS:
    // julho inteiro, o recorte da base sintética, compara com junho inteiro.
    expect(html).toContain('vs. junho')
    expect(html).toContain('versus junho')
    expect(html).not.toContain('vs. período anterior')
    expect(html).toContain('Resultado')
  })

  it('anuncia cada comparação uma única vez no foco do card', () => {
    getCommercialDataset()

    const html = render()
    const articleTags = html.match(/<article[^>]*>/g) ?? []

    // Só os dois cards de volume ligam a descrição acessível da comparação.
    expect(articleTags.filter((tag) => tag.includes('aria-describedby')).length).toBe(2)
    // Card sem número no recorte não anuncia comparação nenhuma.
    const tag = articleTags.find((candidate) =>
      candidate.includes('aria-label="Tempo até a ativação'),
    )
    expect(tag).toBeDefined()
    expect(tag).not.toContain('aria-describedby')
  })

  it('não coloca comparação no card de Tempo até a ativação sem dado', () => {
    getCommercialDataset()

    const card = cardOf(render(), 'Tempo até a ativação')

    // A base sintética guarda a data do evento e a da ativação, nunca a data
    // em que o contrato foi fechado, então não existe espera para medir.
    expect(card).toContain('Sem dado')
    expect(card).not.toContain('vs. período anterior')
    expect(card).not.toContain('versus período anterior')
  })

  it('não coloca comparação nem barra no card dos 90 dias sem dado', () => {
    getCommercialDataset()

    const card = cardOf(render(), 'Bloqueio ou cancelamento em 90 dias')

    // A base sintética não tem histórico de bloqueio: sem número, sem
    // comparação e sem a barra de bloqueio e cancelamento.
    expect(card).toContain('Sem dado')
    expect(card).not.toContain('vs. junho')
    expect(card).not.toContain('Em bloqueio')
    expect(card).toContain('Bloqueio ou cancelamento em 90 dias: Sem dado. Ative para ver a leitura gerencial."')
  })

  it('não coloca comparação no card de Novos Clientes sem dado', () => {
    getCommercialDataset()

    const html = render()
    const card = cardOf(html, 'Novos Clientes')

    // Na base sintética o card não tem número, então também não tem o que
    // comparar. Ligado ao serviço, ele ganha a comparação como os outros.
    expect(card).not.toContain('vs. período anterior')
    expect(card).not.toContain('versus período anterior')
    expect(card).toContain('Sem dado')
    // Sem mix não há parcelas: a grade da frente acompanha o número, e sem
    // número ela mostraria dois zeros que a fonte não sustenta.
    expect(card).not.toContain('Clientes da base')
    expect(card).not.toContain('Retornaram')
  })

  it('mostra o ticket médio na frente do card de Valor Vendas Ativadas', () => {
    getCommercialDataset()

    const card = cardOf(render(), 'Valor Vendas Ativadas')

    // A página abre com os R$ escondidos (28/09/2026): o ticket continua na
    // frente do card, mascarado, e o nome acessível diz que está escondido.
    expect(card).toContain('Ticket médio de R$ •••••')
    expect(card).toContain('Ticket médio de valor escondido')
    // O ticket não é fração do total, então o nome acessível não usa a frase
    // `equivalentes a` das participações.
    expect(card).not.toContain('equivalentes a Ticket')
    expect(card).not.toContain('sem ativações')
  })

  /* Suspensos com a Meta Comercial em 15/09/2026: os dois medem o velocímetro
     dentro da página, e hoje nenhum card da Visão Geral tem um.

  it('mantém a comparação na mesma faixa e posição do velocímetro', () => {
    getCommercialDataset()

    const meta = cardOf(render(), 'Meta Comercial')

    // Faixa de altura fixa, centralizada, com uma única comparação.
    expect((meta.match(/flex h-\[24px\] items-center mt-1 justify-center/g) ?? []).length).toBe(1)
    expect(meta).toContain('vs. período anterior')
  })

  it('tira a comparação de dentro do velocímetro para não duplicar o percentual', () => {
    getCommercialDataset()

    const html = render()

    // O viewBox encurtou junto com o texto de comparação saindo do SVG.
    expect((html.match(/viewBox="0 0 200 94"/g) ?? []).length).toBe(1)
    expect(html).not.toContain('viewBox="0 0 200 116"')
  })
  */
})

/**
 * Rodapé do velocímetro.
 *
 * A padronização é estrutural: mesma grade, mesmos tokens de tipografia e a
 * mesma linguagem no centro. Com a saída da Supermeta Total sobrou um único
 * velocímetro, e o contrato visual dele continua sendo verificado aqui, para
 * que o card volte a acompanhar qualquer outro velocímetro futuro.
 */
describe('rodapé padronizado de Meta Comercial', () => {
  /* Os quatro testes abaixo medem o velocímetro DENTRO da página, e a Meta
     Comercial foi suspensa em 15/09/2026. Voltam com ela. O teste da paleta
     semântica continua ativo: ele monta o rodapé direto, sem passar pela
     página, e é o que protege o contrato visual para o próximo velocímetro.

  const labelToken =
    'whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]'
  const valueToken =
    'text-[10.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]'

  it('usa a composição e os tokens aprovados do rodapé', () => {
    getCommercialDataset()

    const meta = cardOf(render(), 'Meta Comercial')

    expect((meta.match(/overview-gauge-footer-grid/g) ?? []).length).toBe(1)
    expect((meta.match(/overview-gauge-footer-status/g) ?? []).length).toBe(1)
    // Dois rótulos e dois valores laterais, com os mesmos tokens.
    expect((meta.match(new RegExp(escapeClass(labelToken), 'g')) ?? []).length).toBe(2)
    expect((meta.match(new RegExp(escapeClass(valueToken), 'g')) ?? []).length).toBe(2)
    // Divisor superior e bloco direito alinhado à direita.
    expect(meta).toContain('mt-auto border-t border-[var(--divider)] pt-2')
    expect((meta.match(/<div class="text-right">/g) ?? []).length).toBe(1)

    expect(meta).toContain('>Realizado</p>')
    // O rótulo do objetivo diz de que mês é a meta: o recorte de abertura da
    // base local é julho de 2026 inteiro.
    expect(meta).toContain('>Meta Jul/26</p>')
  })

  it('mantém a situação como texto centralizado, sem badge', () => {
    getCommercialDataset()

    const meta = cardOf(render(), 'Meta Comercial')

    expect(meta).toMatch(
      new RegExp(
        `overview-gauge-footer-status min-w-0 break-words text-center ${escapeClass(semanticToken)}`,
      ),
    )
    // Nem pílula, nem fundo, nem contorno na situação da meta.
    expect(meta).not.toMatch(/overview-gauge-footer-status[^"]*rounded/)
    expect(meta).not.toMatch(/overview-gauge-footer-status[^"]*bg-/)
    expect(meta).not.toMatch(/overview-gauge-footer-status[^"]*border/)
  })

  it('usa no centro do rodapé o mesmo token tipográfico da comparação', () => {
    getCommercialDataset()

    const html = render()

    // Um token só, e não duas definições parecidas: a comparação com o período
    // anterior e a distância até a meta são a mesma categoria de informação.
    expect(semanticToken).toBe('text-[11px] font-semibold leading-[1.25]')
    expect(html).toContain(`max-w-full truncate ${semanticToken}`)
    expect(html).toContain(`break-words text-center ${semanticToken}`)
    // O corpo antigo do texto central saiu de vez.
    expect(html).not.toMatch(/overview-gauge-footer-status[^"]*text-\[10\.5px\]/)
  })
  */

  it('usa no rodapé a mesma paleta semântica da comparação, nos dois temas', () => {
    const gaugeOf = (achieved: number, target: number) =>
      buildOverviewGaugeModel({
        indicator: 'Meta Comercial',
        targetTerm: 'Meta',
        achieved,
        target,
        previousAchieved: null,
        corporateOnly: false,
      })
    const renderFooter = (model: OverviewGaugeModel, theme: Theme) =>
      renderToStaticMarkup(<OverviewGaugeFooter model={model} theme={theme} />)

    const abaixo = gaugeOf(795, 800)
    const acima = gaugeOf(883, 880)

    // Os textos e os cálculos não mudaram: só a cor deles passou a sair da
    // paleta compartilhada.
    expect(abaixo.gap.label).toBe('5 vendas abaixo')
    expect(acima.gap.label).toBe('3 vendas acima')

    expect(renderFooter(abaixo, 'light')).toContain(`color:${commercialDeltaColors.light.desfavoravel}`)
    expect(renderFooter(abaixo, 'light')).toContain('color:#b51d38')
    expect(renderFooter(abaixo, 'dark')).toContain('color:#ff8fa3')
    expect(renderFooter(acima, 'light')).toContain('color:#00844d')
    expect(renderFooter(acima, 'dark')).toContain('color:#34d399')

    // O vermelho antigo não pertencia à escala semântica do portal.
    for (const theme of ['light', 'dark'] as const) {
      expect(renderFooter(abaixo, theme)).not.toContain('#d32744')
      expect(renderFooter(acima, theme)).not.toContain('#00a862')
    }
  })

  /* Também suspenso: a linguagem da situação só aparece no rodapé do
     velocímetro, que hoje nenhum card da página desenha.

  it('publica a linguagem aprovada da situação, sem a forma antiga', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toMatch(/\d+ vendas? (abaixo|acima)|(Meta|Supermeta) atingida/)
    expect(html).not.toContain('Faltam')
    expect(html).not.toContain('Falta 1 venda')
  })
  */
})

/* Escapa uma lista de classes do Tailwind para uso literal em `RegExp`.
   Só os testes do velocímetro na página precisavam disso; volta com eles.

function escapeClass(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
*/

/** Trecho de um painel, do título dele até o fim da própria `section`. */
function panelOf(html: string, title: string): string {
  const start = html.indexOf(`>${title}<`)
  expect(start).toBeGreaterThan(-1)

  return html.slice(start, html.indexOf('</section>', start))
}

/** Comprimentos declarados nas barras de um painel, na ordem em que aparecem. */
function barWidths(panel: string): number[] {
  return [...panel.matchAll(/width:([\d.]+)%/g)].map((match) => Number(match[1]))
}

/**
 * Régua das barras dos quatro rankings.
 *
 * As barras têm o mesmo desenho nos quatro painéis, então precisam medir a
 * mesma coisa: comprimento proporcional ao PRIMEIRO colocado do recorte. A
 * Origem das vendas media participação no total, o que fazia duas barras
 * iguais dizerem coisas diferentes na mesma tela.
 */
describe('barras dos rankings da Visão Geral', () => {
  it('usa a mesma régua nos quatro painéis: o primeiro colocado enche a barra', () => {
    getCommercialDataset()

    const html = render()

    for (const title of [
      'Vendas por cidade',
      'Origem das vendas',
      'Top 5 Vendedores',
      'Top 5 Planos',
    ]) {
      const larguras = barWidths(panelOf(html, title))

      expect(larguras.length).toBeGreaterThan(0)
      expect(larguras[0]).toBe(100)
      // Ordenadas do maior para o menor, sem nenhuma estourando a régua.
      expect(larguras).toEqual([...larguras].sort((a, b) => b - a))
      expect(Math.max(...larguras)).toBeLessThanOrEqual(100)
    }
  })

  it('Top 5 Vendedores deixou de ser o único ranking sem barra', () => {
    getCommercialDataset()

    const painel = panelOf(render(), 'Top 5 Vendedores')

    expect(barWidths(painel).length).toBe(5)
  })
})

describe('faixa Hoje ao vivo', () => {
  it('com a base sintética avisa que não existe hoje e não desenha caixa nenhuma', () => {
    const html = render()

    expect(html).toContain('aria-label="Hoje ao vivo"')
    expect(html).toContain('Disponível com o portal ligado ao serviço de BI')
    expect(html).not.toContain('Vendas de hoje por situação')
    expect(html).not.toContain('atualiza a cada minuto')
    // Sem leitura ao vivo, o título fica na cor de sempre, sem o ponto.
    expect(html).not.toContain('live-strip-dot')
  })

  it('vem antes dos cards do período, na moldura da faixa do portal', () => {
    const html = render()
    const strip = html.indexOf('aria-label="Hoje ao vivo"')

    expect(strip).toBeGreaterThan(html.indexOf('Filtros da análise'))
    expect(strip).toBeLessThan(html.indexOf('Vendas ativadas'))
    expect(html.slice(strip, strip + 120)).toContain('live-strip executive-panel')
  })
})

/**
 * Resultado do período (pedido do Mário em 25/09/2026), como na Visão Geral
 * de OS: o título da faixa dos cards, com o período por extenso na etiqueta.
 */
describe('faixa Resultado do período', () => {
  it('fica entre a faixa Hoje ao vivo e os cards, com o período na etiqueta', () => {
    const html = render()
    const heading = html.indexOf('>Resultado do período</h2>')

    expect(heading).toBeGreaterThan(html.indexOf('aria-label="Hoje ao vivo"'))
    expect(heading).toBeLessThan(html.indexOf('<article'))
    // A base sintética abre julho inteiro, que a etiqueta escreve pelo nome.
    expect(html.slice(heading, heading + 600)).toMatch(/impacto-chip[^>]*>Julho de 2026</)
  })

  it('sem hoje no recorte, não há aviso de dia em andamento', () => {
    expect(render()).not.toContain('inclui hoje, ainda em andamento')
  })
})

describe('painel Safra de vendas por mês', () => {
  it('entra logo abaixo dos cards, antes das comparações, com a régua da data da venda', () => {
    const html = render()
    const safra = html.indexOf('Safra de vendas por mês')

    expect(safra).toBeGreaterThan(html.indexOf('Bloqueio ou cancelamento em 90 dias'))
    expect(safra).toBeLessThan(html.indexOf('Vendas por cidade'))
    expect(html.slice(safra)).toContain('pela data da venda')
    expect(html.slice(safra)).toContain('o período não')
  })

  it('com a base sintética não convida ao clique: não há contrato para abrir', () => {
    const html = render()

    expect(html).not.toContain('para ver os contratos')
    // Nem na Evolução mensal, que abre a mesma janela.
    expect(html).not.toContain('para ver as ativações')
    // Nem a planilha do período inteiro, que também sai dos contratos.
    expect(html).not.toContain('contratos em Excel')
  })
})
