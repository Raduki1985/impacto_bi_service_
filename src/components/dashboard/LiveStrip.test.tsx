import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LiveBox, LiveNote, LiveStrip } from './LiveStrip'

/**
 * O que a moldura e a caixa da faixa ao vivo congelam para as duas páginas
 * que as usam (Visão Geral de OS e Visão Geral Comercial).
 */
describe('LiveStrip', () => {
  it('ao vivo, o título fica verde com o ponto pulsando; sem leitura ao vivo, na cor de sempre', () => {
    const live = renderToStaticMarkup(
      <LiveStrip ariaLabel="Hoje ao vivo" live subtitle="Agenda de 25/09/2026 · atualiza a cada minuto">
        <LiveNote>corpo</LiveNote>
      </LiveStrip>,
    )
    const local = renderToStaticMarkup(
      <LiveStrip ariaLabel="Hoje ao vivo" live={false} subtitle="Disponível com o serviço">
        <LiveNote>corpo</LiveNote>
      </LiveStrip>,
    )

    expect(live).toContain('aria-label="Hoje ao vivo"')
    expect(live).toContain('live-strip executive-panel')
    expect(live).toContain('live-strip-dot')
    expect(live).toContain('color:var(--live-accent)')
    expect(live).toContain('Agenda de 25/09/2026 · atualiza a cada minuto')
    expect(local).not.toContain('live-strip-dot')
    expect(local).toContain('color:var(--text-heading)')
  })

  it('a classe da página soma à da faixa, para os tokens que só ela tem', () => {
    const html = renderToStaticMarkup(
      <LiveStrip ariaLabel="Hoje ao vivo" className="os-today" live subtitle="">
        <span />
      </LiveStrip>,
    )

    expect(html).toContain('class="live-strip executive-panel')
    expect(html).toContain(' os-today"')
  })
})

describe('LiveBox', () => {
  it('é um botão que diz se está aberto e qual lista controla', () => {
    const closed = renderToStaticMarkup(
      <ul>
        <LiveBox color="#00a862" controls="lista" label="Ativadas" onToggle={() => {}} open={false} value={1234}>
          20,0% do dia
        </LiveBox>
      </ul>,
    )
    const open = renderToStaticMarkup(
      <ul>
        <LiveBox color="#00a862" controls="lista" label="Ativadas" onToggle={() => {}} open value={5}>
          20,0% do dia
        </LiveBox>
      </ul>,
    )

    expect(closed).toContain('aria-expanded="false"')
    expect(closed).not.toContain('aria-controls')
    expect(closed).toContain('1.234')
    expect(open).toContain('aria-expanded="true"')
    expect(open).toContain('aria-controls="lista"')
    expect(open).toContain('border-color:#00a862')
  })

  it('o atalho do canto é um segundo botão, cinza quando é só informação e âmbar em atenção', () => {
    const corner = {
      label: '21 de dias anteriores',
      title: 'Abrir a lista.',
      accessibleLabel: '21 ativações de vendas de dias anteriores, ver na lista',
      onClick: () => {},
    }
    const info = renderToStaticMarkup(
      <ul>
        <LiveBox color="#00a862" controls="lista" corner={{ ...corner, attention: false }} label="Ativadas" onToggle={() => {}} open={false} value={5}>
          20,0% do dia
        </LiveBox>
      </ul>,
    )
    const attention = renderToStaticMarkup(
      <ul>
        <LiveBox color="#00a862" controls="lista" corner={{ ...corner, attention: true }} label="A fazer" onToggle={() => {}} open={false} value={5}>
          20,0% do dia
        </LiveBox>
      </ul>,
    )

    expect((info.match(/<button/g) ?? []).length).toBe(2)
    expect(info).toContain('aria-label="21 ativações de vendas de dias anteriores, ver na lista"')
    expect(info).toContain('color:var(--text-secondary)')
    expect(info).not.toContain('lucide-triangle-alert')
    expect(attention).toContain('color:var(--live-attention)')
    expect(attention).toContain('lucide-triangle-alert')
    // O lugar do atalho fica reservado, invisível, na última linha da caixa.
    expect(info).toContain('invisible ml-auto')
  })

  it('aceita mais de um atalho no mesmo canto, cada um um botão, e ignora os nulos', () => {
    const base = { title: 'Abrir a lista.', onClick: () => {} }
    const html = renderToStaticMarkup(
      <ul>
        <LiveBox
          color="#0ea5e9"
          controls="lista"
          corner={[
            { ...base, label: '3 sem técnico', accessibleLabel: '3 OS sem técnico', attention: false },
            null,
            { ...base, label: '14 reagendadas', accessibleLabel: '14 OS reagendadas', attention: true },
          ]}
          label="A fazer"
          onToggle={() => {}}
          open={false}
          value={51}
        >
          40,2% do dia
        </LiveBox>
      </ul>,
    )

    expect((html.match(/<button/g) ?? []).length).toBe(3)
    expect(html).toContain('aria-label="3 OS sem técnico"')
    expect(html).toContain('aria-label="14 OS reagendadas"')
    expect(html.indexOf('3 sem técnico')).toBeLessThan(html.indexOf('14 reagendadas'))
    expect((html.match(/lucide-triangle-alert/g) ?? []).length).toBe(2)
  })

  it('sem atalho nenhum na lista, não reserva lugar nem desenha botão a mais', () => {
    const html = renderToStaticMarkup(
      <ul>
        <LiveBox color="#0ea5e9" controls="lista" corner={[null, null]} label="A fazer" onToggle={() => {}} open={false} value={51}>
          40,2% do dia
        </LiveBox>
      </ul>,
    )

    expect((html.match(/<button/g) ?? []).length).toBe(1)
    expect(html).not.toContain('invisible ml-auto')
  })
})
