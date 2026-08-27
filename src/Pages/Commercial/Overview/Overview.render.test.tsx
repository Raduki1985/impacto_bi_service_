import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../../contexts/PreferencesContext'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  commercialDeltaColors,
  commercialSemanticTextClass as semanticToken,
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
function render() {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <Overview />
    </PreferencesProvider>,
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
      'Meta Comercial',
      'Supermeta Total',
      'Contratos em fluxo',
    ]) {
      expect(html).toContain(label)
    }

    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(5)
    expect((html.match(/Leitura gerencial/g) ?? []).length).toBe(5)
    expect((html.match(/OBSERVAR/g) ?? []).length).toBe(5)
  })

  it('preserva os valores e os textos operacionais do recorte padrão', () => {
    getCommercialDataset()

    const html = render()

    // Julho de 2026: 883 ativadas, realizado da meta 795 e supermeta 883.
    expect(html).toContain('883')
    expect(html).toContain('795 vendas')
    expect(html).toContain('Realizado')
    expect(html).toContain('Meta')
    expect(html).toContain('Supermeta')
    // Rodapé dos velocímetros preservado.
    expect(html).toMatch(/\d+ vendas? abaixo|Meta atingida|\d+ vendas? acima/)

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('troca o minigráfico dos cards de volume pela definição e mantém a composição do fluxo', () => {
    getCommercialDataset()

    const html = render()

    // Nenhum minigráfico: sem escala comum, cards vizinhos mostravam formas
    // parecidas para grandezas diferentes.
    expect(html).not.toContain('executive-spark-')
    // No lugar dele, a definição do indicador na base dos dois cards de volume.
    expect((html.match(/<p class="mt-auto pt-2 /g) ?? []).length).toBe(2)
    expect(html).toContain('vendas ativadas no recorte, base da taxa de ativação')
    expect(html).toContain('soma do valor mensal das vendas ativadas')
    // Velocímetro e funil ficam: os dois têm escala própria e dizem algo que o
    // número sozinho não diz. Quatro etapas do fluxo continuam nomeadas.
    for (const stage of ['Pendente', 'Assinada', 'Agendada', 'Em aprovação']) {
      expect(html).toContain(stage)
    }
  })
})

/**
 * A comparação com o período anterior entra nos quatro cards que a possuem.
 * Contratos em fluxo fica de fora porque o percentual dele é participação no
 * total de contratos, e não variação.
 */
describe('comparações com o período anterior na Visão Geral', () => {
  it('publica exatamente quatro comparações', () => {
    getCommercialDataset()

    const html = render()
    // A faixa da comparação só é montada quando o card tem `delta`.
    const faixas = html.match(/flex h-\[24px\] items-center/g) ?? []

    expect(faixas).toHaveLength(4)
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

  it('usa a abreviação aprovada e mantém a forma completa acessível', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toContain('vs. p.p.')
    expect(html).toContain('versus período anterior')
    expect(html).toContain('Resultado')
    // A forma longa não é usada como rótulo visível.
    expect(html).not.toContain('vs período anterior')
  })

  it('anuncia cada comparação uma única vez no foco do card', () => {
    getCommercialDataset()

    const html = render()
    const articleTags = html.match(/<article[^>]*>/g) ?? []

    // Só os dois cards de volume ligam a descrição acessível da comparação.
    expect(articleTags.filter((tag) => tag.includes('aria-describedby')).length).toBe(2)
    // Os velocímetros já trazem a comparação dentro do próprio nome acessível,
    // então não recebem a descrição: senão o percentual sairia em dobro.
    for (const label of ['Meta Comercial', 'Supermeta Total']) {
      const tag = articleTags.find((candidate) => candidate.includes(`aria-label="${label}`))
      expect(tag).toBeDefined()
      expect(tag).not.toContain('aria-describedby')
      expect(tag).toContain('período anterior')
    }
  })

  it('não coloca comparação no card de contratos em fluxo', () => {
    getCommercialDataset()

    const html = render()
    const pipelineStart = html.indexOf('Contratos em fluxo')
    const pipelineCard = html.slice(pipelineStart)

    expect(pipelineStart).toBeGreaterThan(-1)
    expect(pipelineCard).not.toContain('vs. p.p.')
    expect(pipelineCard).not.toContain('versus período anterior')
    expect(pipelineCard).toContain('dos contratos')
  })

  it('mantém a comparação na mesma faixa e posição nos dois velocímetros', () => {
    getCommercialDataset()

    const html = render()
    const meta = cardOf(html, 'Meta Comercial')
    const supermeta = cardOf(html, 'Supermeta Total')

    // Mesma faixa de altura, mesma centralização e uma comparação por card.
    ;[meta, supermeta].forEach((card) => {
      expect((card.match(/flex h-\[24px\] items-center mt-1 justify-center/g) ?? []).length).toBe(
        1,
      )
      expect(card).toContain('vs. p.p.')
    })
  })

  it('tira a comparação de dentro do velocímetro para não duplicar o percentual', () => {
    getCommercialDataset()

    const html = render()

    // O viewBox encurtou junto com o texto de comparação saindo do SVG.
    expect((html.match(/viewBox="0 0 200 94"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('viewBox="0 0 200 116"')
  })
})

/**
 * Rodapé dos dois velocímetros.
 *
 * A padronização é estrutural: mesma grade, mesmos tokens de tipografia e a
 * mesma linguagem no centro. O que muda entre os cards é apenas o conteúdo.
 */
describe('rodapé padronizado de Meta Comercial e Supermeta Total', () => {
  const labelToken =
    'whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.3px] text-[var(--text-secondary)]'
  const valueToken =
    'text-[10.5px] font-semibold leading-[1.2] break-words text-[var(--text-item)]'

  it('usa a mesma composição e os mesmos tokens nos dois cards', () => {
    getCommercialDataset()

    const html = render()
    const meta = cardOf(html, 'Meta Comercial')
    const supermeta = cardOf(html, 'Supermeta Total')

    ;[meta, supermeta].forEach((card) => {
      expect((card.match(/overview-gauge-footer-grid/g) ?? []).length).toBe(1)
      expect((card.match(/overview-gauge-footer-status/g) ?? []).length).toBe(1)
      // Dois rótulos e dois valores laterais, com os mesmos tokens.
      expect((card.match(new RegExp(escapeClass(labelToken), 'g')) ?? []).length).toBe(2)
      expect((card.match(new RegExp(escapeClass(valueToken), 'g')) ?? []).length).toBe(2)
      // Divisor superior e bloco direito alinhado à direita, iguais nos dois.
      expect(card).toContain('mt-auto border-t border-[var(--divider)] pt-2')
      expect((card.match(/<div class="text-right">/g) ?? []).length).toBe(1)
    })

    expect(meta).toContain('>Realizado</p>')
    expect(supermeta).toContain('>Realizado</p>')
    expect(meta).toContain('>Meta</p>')
    expect(supermeta).toContain('>Supermeta</p>')
  })

  it('mantém a situação como texto centralizado, sem badge', () => {
    getCommercialDataset()

    const html = render()

    ;[cardOf(html, 'Meta Comercial'), cardOf(html, 'Supermeta Total')].forEach((card) => {
      expect(card).toMatch(
        new RegExp(
          `overview-gauge-footer-status min-w-0 break-words text-center ${escapeClass(semanticToken)}`,
        ),
      )
      // Nem pílula, nem fundo, nem contorno na situação da meta.
      expect(card).not.toMatch(/overview-gauge-footer-status[^"]*rounded/)
      expect(card).not.toMatch(/overview-gauge-footer-status[^"]*bg-/)
      expect(card).not.toMatch(/overview-gauge-footer-status[^"]*border/)
    })
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

  it('publica a linguagem aprovada da situação, sem a forma antiga', () => {
    getCommercialDataset()

    const html = render()

    expect(html).toMatch(/\d+ vendas? (abaixo|acima)|(Meta|Supermeta) atingida/)
    expect(html).not.toContain('Faltam')
    expect(html).not.toContain('Falta 1 venda')
  })
})

/** Escapa uma lista de classes do Tailwind para uso literal em `RegExp`. */
function escapeClass(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
