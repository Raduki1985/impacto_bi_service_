import { CircleCheckBig } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ExecutiveMetricCard } from '../../../components/dashboard/ExecutiveMetricCard'
import { buildCommercialDelta } from './commercialCardModel'

const delta = buildCommercialDelta(0.082, 'O volume')

function render(props: Partial<Parameters<typeof ExecutiveMetricCard>[0]> = {}) {
  return renderToStaticMarkup(
    <ExecutiveMetricCard
      accessibleText="Vendas ativadas: 883."
      icon={CircleCheckBig}
      label="Vendas ativadas"
      onToggle={() => {}}
      open={false}
      readingText="O indicador cresceu {8,2%} frente ao período anterior."
      readingTitle="883 vendas foram ativadas no recorte."
      theme="light"
      tone="green"
      value="883"
      variant="spark"
      {...props}
    />,
  )
}

describe('comparação dos cards comerciais', () => {
  it('usa o rótulo completo na tela e a expressão acessível por extenso', () => {
    expect(buildCommercialDelta(0.082, 'O volume')).toEqual({
      label: '▲ 8,2% vs. período anterior',
      accessibleLabel: 'O volume cresceu 8,2% versus período anterior',
      tone: 'favoravel',
    })
    expect(buildCommercialDelta(-0.031, 'O volume')).toEqual({
      label: '▼ 3,1% vs. período anterior',
      accessibleLabel: 'O volume recuou 3,1% versus período anterior',
      tone: 'desfavoravel',
    })
    expect(buildCommercialDelta(0, 'O volume')).toEqual({
      label: 'Estável vs. período anterior',
      accessibleLabel: 'O volume ficou estável versus período anterior',
      tone: 'neutro',
    })
  })

  it('não inventa percentual sem período anterior comparável', () => {
    const semBase = buildCommercialDelta(null, 'O volume')

    expect(semBase.tone).toBe('indisponivel')
    expect(semBase.label).toBe('Sem período anterior')
    expect(semBase.label).not.toMatch(/%/)
    expect(semBase.accessibleLabel).not.toMatch(/%/)
  })
})

describe('ExecutiveMetricCard', () => {
  it('monta a variante spark com valor, comparação e visual', () => {
    const html = render({ delta, children: <span>minigrafico</span> })

    expect(html).toContain('Vendas ativadas')
    expect(html).toContain('883')
    expect(html).toContain('▲ 8,2% vs. período anterior')
    expect(html).toContain('O volume cresceu 8,2% versus período anterior')
    expect(html).toContain('Resultado favorável.')
    expect(html).toContain('minigrafico')
  })

  it('apresenta a comparação só como texto, sem fundo, borda ou pílula', () => {
    const favoravel = render({ delta })
    const desfavoravel = render({ delta: buildCommercialDelta(-0.031, 'O volume') })
    const neutro = render({ delta: buildCommercialDelta(0, 'O volume') })
    const indisponivel = render({ delta: buildCommercialDelta(null, 'O volume') })

    // Nenhuma forma de badge sobrou: sem superfície, sem contorno e sem canto
    // arredondado envolvendo a comparação.
    for (const html of [favoravel, desfavoravel, neutro, indisponivel]) {
      expect(html).not.toContain('inline-flex max-w-full items-center self-start')
      expect(html).not.toContain('rounded-md border')
    }

    // A diferenciação semântica vem só da cor do texto, uma por tom.
    expect(favoravel).toContain('color:#00844d')
    expect(desfavoravel).toContain('color:#b51d38')
    expect(neutro).toContain('color:#475467')
    expect(indisponivel).toContain('color:#5b6779')
    // A cor nunca é a única portadora da informação.
    expect(desfavoravel).toContain('Resultado desfavorável.')
    expect(neutro).toContain('Resultado neutro.')
    expect(indisponivel).toContain('Comparação indisponível.')
  })

  it('troca a paleta da comparação entre os temas', () => {
    expect(render({ delta, theme: 'light' })).toContain('color:#00844d')
    expect(render({ delta, theme: 'dark' })).toContain('color:#34d399')
  })

  it('reserva faixas de altura fixa para valor e comparação', () => {
    const curto = render({ delta, value: '883' })
    const longo = render({ delta, value: 'R$ 132.111,70' })

    // As duas faixas existem nos dois casos, então um valor longo não empurra
    // a comparação nem o visual para outra posição.
    for (const html of [curto, longo]) {
      expect(html).toContain('flex h-[30px] items-end')
      expect(html).toContain('flex h-[24px] items-center')
    }
    // O corpo do texto cai de forma controlada, mas só ele.
    expect(curto).toContain('text-[23px]')
    expect(longo).toContain('text-[18px]')
  })

  it('centraliza a comparação na variante de velocímetro e mantém o rodapé', () => {
    const html = render({
      variant: 'gauge',
      value: undefined,
      delta,
      children: <span>velocimetro</span>,
      footer: <span>rodape</span>,
    })

    expect(html).toContain('justify-center')
    expect(html).toContain('velocimetro')
    expect(html).toContain('rodape')
    // O velocímetro desenha o próprio percentual: nenhuma faixa de valor.
    expect(html).not.toContain('flex h-[30px] items-end')
  })

  it('omite a comparação quando o indicador não tem período anterior a comparar', () => {
    const html = render({ variant: 'pipeline', children: <span>composicao</span> })

    expect(html).toContain('composicao')
    expect(html).not.toContain('vs. período anterior')
    expect(html).not.toContain('flex h-[24px] items-center')
  })

  it('publica a leitura gerencial com destaque e sem inventar OBSERVAR', () => {
    const semObserve = render({ delta })
    const comObserve = render({ delta, observe: 'Evolução do volume.' })

    expect(semObserve).toContain('Leitura gerencial')
    expect(semObserve).toContain('883 vendas foram ativadas no recorte.')
    // O trecho entre chaves vira destaque, e as chaves não chegam à tela.
    expect(semObserve).toContain('8,2%')
    expect(semObserve).not.toContain('{8,2%}')
    expect(semObserve).not.toContain('OBSERVAR')
    expect(comObserve).toContain('OBSERVAR')
    expect(comObserve).toContain('Evolução do volume.')
  })

  it('expõe o card como botão com nome acessível e estado', () => {
    const fechado = render({ delta })
    const aberto = render({ delta, open: true })

    expect(fechado).toContain('role="button"')
    expect(fechado).toContain('tabindex="0"')
    expect(fechado).toContain('aria-expanded="false"')
    expect(fechado).toContain('Vendas ativadas: 883. Ative para ver a leitura gerencial.')
    expect(aberto).toContain('aria-expanded="true"')
    expect(aberto).toContain('Ative para fechar a leitura gerencial.')
  })

  it('inverte a paleta da leitura entre os temas', () => {
    expect(render({ delta, theme: 'light' })).toContain('background:#01225c')
    expect(render({ delta, theme: 'dark' })).toContain('linear-gradient(155deg,#eef4f8,#dfe9f1)')
  })

  it('respeita a redução de movimento nas transições', () => {
    const html = render({ delta })

    expect(html).toContain('motion-reduce:transition-none')
    expect(html).toContain('motion-reduce:hover:translate-y-0')
  })
})
