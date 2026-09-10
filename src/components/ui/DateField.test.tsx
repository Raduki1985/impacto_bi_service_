import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DateField } from './DateField'

/**
 * O campo é exercitado por renderização estática, como o resto da suíte: não
 * há navegador aqui, então o que se prova é o markup que ele publica. As contas
 * do calendário, inclusive a troca de mês com o mesmo dia, têm testes próprios
 * em `dateFieldModel.test.ts`.
 *
 * O calendário fica no markup mesmo fechado, como um `popover`: é o navegador
 * que o esconde. É isso que permite conferir aqui os dias que ele oferece.
 * `today` é fixo nos testes para nada aqui depender do relógio.
 */
function render(props: Partial<Parameters<typeof DateField>[0]> = {}) {
  return renderToStaticMarkup(
    <DateField
      label="Início"
      max="2026-08-21"
      min="2026-04-06"
      onChange={() => {}}
      today="2026-08-10"
      value="2026-08-01"
      {...props}
    />,
  )
}

/** O botão de um dia da grade, para conferir os atributos que ele carrega. */
function dia(html: string, iso: string): string {
  return html.match(new RegExp(`<button[^>]*data-iso="${iso}"[^>]*>`))?.[0] ?? ''
}

/** O botão de um mês na lista de anos. */
function mes(html: string, month: string): string {
  return html.match(new RegExp(`<button[^>]*data-month="${month}"[^>]*>`))?.[0] ?? ''
}

describe('campo', () => {
  const html = render()

  it('mostra a data no formato do Brasil, com rótulo ligado ao campo', () => {
    expect(html).toContain('value="01/08/2026"')
    expect(html).toContain('>Início</label>')
    expect(html).toContain('placeholder="dd/mm/aaaa"')
    expect(html).toContain('required=""')
  })

  it('digita por número, sem o seletor nativo do navegador', () => {
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('type="text"')
    expect(html).not.toContain('type="date"')
  })

  it('publica o gatilho do calendário com nome próprio', () => {
    expect(html).toContain('aria-label="Escolher Início no calendário"')
    expect(html).toContain('aria-expanded="false"')
  })
})

describe('calendário', () => {
  const html = render()

  it('abre no mês da data escolhida, com as iniciais da semana', () => {
    expect(html).toContain('Agosto de 2026')
    expect(html).toContain('popover="auto"')
    expect(html).toContain('aria-label="Calendário de Início"')
    expect((html.match(/<th scope="col">/g) ?? []).length).toBe(7)
  })

  it('o título é o botão que abre a lista de anos, como no campo que saiu', () => {
    expect(html).toContain('title="Escolher mês e ano"')
    expect(html).not.toContain('aria-label="Ano e mês"')
  })

  it('desenha seis semanas, para não mudar de altura ao trocar de mês', () => {
    expect((html.match(/data-iso=/g) ?? []).length).toBe(42)
  })

  it('marca o dia escolhido, e só ele', () => {
    expect(dia(html, '2026-08-01')).toContain('data-selected="true"')
    expect(dia(html, '2026-08-01')).toContain('aria-label="01/08/2026, selecionado"')
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1)
  })

  it('marca o dia de hoje sem confundir com o escolhido', () => {
    expect(dia(html, '2026-08-10')).toContain('data-today="true"')
    expect(dia(html, '2026-08-10')).toContain('aria-current="date"')
    expect(dia(html, '2026-08-10')).not.toContain('data-selected')
    expect(dia(html, '2026-08-01')).not.toContain('aria-current')
  })

  it('desliga o dia fora da cobertura, dos dois lados', () => {
    expect(dia(html, '2026-08-21')).not.toContain('disabled')
    expect(dia(html, '2026-08-22')).toContain('disabled')
    const abril = render({ value: '2026-04-10' })
    expect(dia(abril, '2026-04-05')).toContain('disabled')
    expect(dia(abril, '2026-04-06')).not.toContain('disabled')
  })

  it('identifica os dias de outro mês que completam a semana', () => {
    expect(dia(html, '2026-07-26')).toContain('data-outside="true"')
    expect(dia(html, '2026-08-01')).not.toContain('data-outside')
  })

  it('sem limites, nenhum dia da grade fica desligado', () => {
    const livre = render({ max: undefined, min: undefined })

    expect(livre).not.toContain('disabled=""')
  })

  it('desliga a seta do mês que não tem nenhum dia na cobertura', () => {
    // Início da cobertura em abril: no próprio abril a seta de voltar morre.
    const abril = render({ value: '2026-04-10' })

    expect(abril).toContain('aria-label="Mês anterior" class="impacto-calendar-nav" disabled=""')
    // Em agosto, com o fim em 21/08, a de avançar morre.
    expect(html).toContain('aria-label="Próximo mês" class="impacto-calendar-nav" disabled=""')
    expect(html).not.toContain('aria-label="Mês anterior" class="impacto-calendar-nav" disabled=""')
  })

  it('só o dia escolhido entra na ordem de tabulação da grade', () => {
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect(dia(html, '2026-08-01')).toContain('tabindex="0"')
  })
})

describe('botão Hoje', () => {
  it('fica vivo quando hoje cabe na cobertura', () => {
    expect(render()).toContain('class="impacto-calendar-today" type="button">Hoje</button>')
  })

  it('fica desligado quando hoje está fora da cobertura, como no campo que saiu', () => {
    const html = render({ today: '2026-09-10' })

    expect(html).toContain('class="impacto-calendar-today" disabled="" type="button">Hoje</button>')
    // E o dia de hoje não aparece marcado, porque nem está na grade.
    expect(html).not.toContain('data-today')
  })
})

describe('lista de anos com os meses', () => {
  const html = render({ defaultView: 'months' })

  it('substitui a grade de dias e as setas de mês', () => {
    expect(html).toContain('aria-label="Ano e mês"')
    expect(html).not.toContain('data-iso=')
    expect(html).not.toContain('aria-label="Mês anterior"')
  })

  it('lista só os anos da cobertura, com o ano da data aberto', () => {
    expect((html.match(/impacto-calendar-year-row/g) ?? []).length).toBe(1)
    expect(html).toContain('data-expanded="true"')
    expect((html.match(/data-month=/g) ?? []).length).toBe(12)
    for (const nome of ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']) {
      expect(html).toContain(`>${nome}</button>`)
    }
  })

  it('marca o mês da data e desliga o mês sem nenhum dia na cobertura', () => {
    expect(mes(html, '2026-08')).toContain('data-selected="true"')
    expect(mes(html, '2026-08')).not.toContain('disabled')
    expect(mes(html, '2026-04')).not.toContain('disabled')
    expect(mes(html, '2026-03')).toContain('disabled=""')
    expect(mes(html, '2026-09')).toContain('disabled=""')
    expect(mes(html, '2026-08')).toContain('aria-label="Agosto de 2026"')
  })

  it('com cobertura de vários anos, só o ano da data começa aberto', () => {
    const longa = render({
      defaultView: 'months',
      max: '2027-01-31',
      min: '2024-03-01',
      value: '2026-08-01',
    })

    expect((longa.match(/impacto-calendar-year-row/g) ?? []).length).toBe(4)
    expect((longa.match(/data-expanded="true"/g) ?? []).length).toBe(1)
    expect(longa).toContain('>2024<')
    expect(longa).toContain('>2027<')
    expect((longa.match(/data-month=/g) ?? []).length).toBe(12)
  })
})
