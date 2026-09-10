import { describe, expect, it } from 'vitest'

import {
  acceptsTyping,
  brDateFromIso,
  buildCalendarWeeks,
  clampToLimits,
  draftWithPending,
  isIsoDate,
  isoFromBrDate,
  isSelectable,
  lastDayOfMonth,
  monthHasSelectableDay,
  monthKey,
  monthOf,
  monthTitle,
  neighbourSegment,
  pickerYears,
  sameDayInMonth,
  segmentAtCursor,
  shiftMonth,
  stepSegment,
  typeInSegment,
} from './dateFieldModel'

describe('grade do mês', () => {
  it('tem sempre seis semanas de sete dias, para o calendário não mudar de altura', () => {
    for (const month of ['2026-02', '2026-08', '2026-09', '2028-02']) {
      const weeks = buildCalendarWeeks(month)

      expect(weeks).toHaveLength(6)
      for (const week of weeks) expect(week).toHaveLength(7)
    }
  })

  it('começa no domingo da semana do dia 1, com os vizinhos identificados', () => {
    // 01/09/2026 é uma terça, então a primeira semana traz 30 e 31 de agosto.
    const weeks = buildCalendarWeeks('2026-09')

    expect(weeks[0][0]).toMatchObject({ iso: '2026-08-30', day: 30, currentMonth: false })
    expect(weeks[0][1]).toMatchObject({ iso: '2026-08-31', day: 31, currentMonth: false })
    expect(weeks[0][2]).toMatchObject({ iso: '2026-09-01', day: 1, currentMonth: true })
  })

  it('cobre o mês inteiro sem pular nem repetir dia', () => {
    const dias = buildCalendarWeeks('2026-09')
      .flat()
      .filter((dia) => dia.currentMonth)
      .map((dia) => dia.iso)

    expect(dias).toHaveLength(30)
    expect(dias[0]).toBe('2026-09-01')
    expect(dias.at(-1)).toBe('2026-09-30')
    expect(new Set(dias).size).toBe(30)
  })

  it('vira o ano na primeira e na última semana', () => {
    const janeiro = buildCalendarWeeks('2026-01')
    const dezembro = buildCalendarWeeks('2026-12')

    expect(janeiro[0][0].iso).toBe('2025-12-28')
    expect(dezembro.flat().at(-1)?.iso).toBe('2027-01-09')
  })

  it('desliga o dia fora da cobertura da base, dos dois lados', () => {
    const weeks = buildCalendarWeeks('2026-09', { min: '2026-09-03', max: '2026-09-10' })
    const dia = (iso: string) => weeks.flat().find((item) => item.iso === iso)

    expect(dia('2026-09-02')?.selectable).toBe(false)
    expect(dia('2026-09-03')?.selectable).toBe(true)
    expect(dia('2026-09-10')?.selectable).toBe(true)
    expect(dia('2026-09-11')?.selectable).toBe(false)
  })

  it('sem limites, todo dia da grade pode ser escolhido', () => {
    expect(buildCalendarWeeks('2026-09').flat().every((dia) => dia.selectable)).toBe(true)
  })
})

describe('navegação entre meses', () => {
  it('anda para frente e para trás virando o ano', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('escreve o título por extenso, em português', () => {
    expect(monthTitle('2026-07')).toBe('Julho de 2026')
    expect(monthTitle('2026-03')).toBe('Março de 2026')
    expect(monthTitle('2026-12')).toBe('Dezembro de 2026')
  })

  it('lê o mês de uma data', () => {
    expect(monthOf('2026-07-31')).toBe('2026-07')
  })
})

describe('troca de mês com o mesmo dia, a regra do Mário', () => {
  it('quem está no dia 15 vai para o dia 15', () => {
    expect(sameDayInMonth('2026-08-15', '2026-09')).toBe('2026-09-15')
    expect(sameDayInMonth('2026-08-15', '2026-07')).toBe('2026-07-15')
    expect(sameDayInMonth('2026-12-15', '2027-01')).toBe('2027-01-15')
  })

  it('quem está no último dia vai para o último dia do destino', () => {
    expect(sameDayInMonth('2026-02-28', '2026-03')).toBe('2026-03-31')
    expect(sameDayInMonth('2026-02-28', '2026-01')).toBe('2026-01-31')
    expect(sameDayInMonth('2026-03-31', '2026-04')).toBe('2026-04-30')
    expect(sameDayInMonth('2026-01-31', '2026-02')).toBe('2026-02-28')
    expect(sameDayInMonth('2028-02-29', '2028-03')).toBe('2028-03-31')
  })

  it('um dia que o destino não tem cai no último dele', () => {
    expect(sameDayInMonth('2026-04-30', '2026-02')).toBe('2026-02-28')
    expect(sameDayInMonth('2026-01-30', '2026-02')).toBe('2026-02-28')
    expect(sameDayInMonth('2026-05-31', '2026-06')).toBe('2026-06-30')
  })

  it('o dia 1 é sempre o dia 1', () => {
    expect(sameDayInMonth('2026-08-01', '2026-09')).toBe('2026-09-01')
    expect(sameDayInMonth('2026-03-01', '2026-02')).toBe('2026-02-01')
  })

  it('sabe o último dia de cada mês, com o ano bissexto em conta', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-09')).toBe('2026-09-30')
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31')
  })

  it('prende à cobertura o dia que sairia dela', () => {
    expect(clampToLimits('2026-08-25', '2026-04-06', '2026-08-21')).toBe('2026-08-21')
    expect(clampToLimits('2026-04-02', '2026-04-06', '2026-08-21')).toBe('2026-04-06')
    expect(clampToLimits('2026-06-10', '2026-04-06', '2026-08-21')).toBe('2026-06-10')
    expect(clampToLimits('2030-01-01')).toBe('2030-01-01')
  })
})

describe('seletor de ano e mês', () => {
  const limites = { min: '2026-04-06', max: '2026-08-21' }

  it('só oferece mês com ao menos um dia na cobertura', () => {
    expect(monthHasSelectableDay('2026-03', limites)).toBe(false)
    expect(monthHasSelectableDay('2026-04', limites)).toBe(true)
    expect(monthHasSelectableDay('2026-08', limites)).toBe(true)
    expect(monthHasSelectableDay('2026-09', limites)).toBe(false)
    expect(monthHasSelectableDay('2031-01')).toBe(true)
  })

  it('lista os anos da cobertura, e dez para cada lado quando não há cobertura', () => {
    expect(pickerYears('2026-08', limites)).toEqual([2026])
    expect(pickerYears('2026-08', { min: '2024-03-01', max: '2027-01-31' })).toEqual([
      2024, 2025, 2026, 2027,
    ])
    const livre = pickerYears('2026-08')
    expect(livre[0]).toBe(2016)
    expect(livre.at(-1)).toBe(2036)
    expect(livre).toHaveLength(21)
  })

  it('monta a chave do mês a partir do ano e do número', () => {
    expect(monthKey(2026, 3)).toBe('2026-03')
    expect(monthKey(2026, 12)).toBe('2026-12')
  })
})

describe('texto colado', () => {
  it('recusa o que passaria de oito números, em vez de embaralhar', () => {
    // Foi o que apareceu na tela quando o campo aceitava digitação livre: com
    // `01/09/2026` escrito e o cursor no começo, um `0` a mais virava
    // `00/10/9202`. Hoje a digitação é por partes, e a regra guarda a colagem.
    expect(acceptsTyping('01/09/2026')).toBe(true)
    expect(acceptsTyping('001/09/2026')).toBe(false)
    expect(acceptsTyping('')).toBe(true)
    expect(acceptsTyping('07/09')).toBe(true)
  })
})

describe('edição por partes, como no campo do navegador', () => {
  it('sabe em que parte o cursor caiu, para o clique escolher onde editar', () => {
    expect(segmentAtCursor(0)).toBe('day')
    expect(segmentAtCursor(2)).toBe('day')
    expect(segmentAtCursor(3)).toBe('month')
    expect(segmentAtCursor(5)).toBe('month')
    expect(segmentAtCursor(6)).toBe('year')
    expect(segmentAtCursor(10)).toBe('year')
  })

  it('anda entre as partes e para nas pontas', () => {
    expect(neighbourSegment('day', 1)).toBe('month')
    expect(neighbourSegment('month', 1)).toBe('year')
    expect(neighbourSegment('year', 1)).toBe('year')
    expect(neighbourSegment('day', -1)).toBe('day')
  })

  it('soma dentro da parte, dando a volta sem mexer no resto', () => {
    // Medido no campo nativo: dia 30 mais um vira 01, e o mês fica onde está.
    expect(stepSegment('2026-09-02', 'day', 1)).toBe('2026-09-03')
    expect(stepSegment('2026-09-30', 'day', 1)).toBe('2026-09-01')
    expect(stepSegment('2026-09-01', 'day', -1)).toBe('2026-09-30')
    expect(stepSegment('2026-09-02', 'month', 1)).toBe('2026-10-02')
    expect(stepSegment('2026-12-02', 'month', 1)).toBe('2026-01-02')
    expect(stepSegment('2026-09-02', 'year', 1)).toBe('2027-09-02')
  })

  it('encaixa o dia no mês que o recebe', () => {
    expect(stepSegment('2026-01-31', 'month', 1)).toBe('2026-02-28')
  })

  it('para de andar quando o resultado sairia da cobertura', () => {
    // Foi o que o campo nativo fez: com o teto em 10/09, somar no mês não anda.
    const limites = { min: '2026-09-01', max: '2026-09-10' }

    expect(stepSegment('2026-09-02', 'month', 1, limites)).toBe('2026-09-02')
    expect(stepSegment('2026-09-02', 'day', 1, limites)).toBe('2026-09-03')
    // Descer no dia 1 daria a volta para 30/09, que está acima do teto.
    expect(stepSegment('2026-09-01', 'day', -1, limites)).toBe('2026-09-01')
    // Dentro da cobertura, andar continua livre.
    expect(stepSegment('2026-09-02', 'day', -1, limites)).toBe('2026-09-01')
  })

  it('o número digitado preenche a parte e passa adiante quando ela enche', () => {
    const zero = typeInSegment('2026-09-15', 'day', '', '0')
    expect(zero).toMatchObject({ isoDate: '2026-09-15', pending: '0', done: false })

    const sete = typeInSegment('2026-09-15', 'day', '0', '7')
    expect(sete).toMatchObject({ isoDate: '2026-09-07', pending: '', done: true })
  })

  it('fecha a parte na hora quando o número seguinte não caberia', () => {
    // Não existe dia começando em 7, nem mês começando em 2.
    expect(typeInSegment('2026-09-15', 'day', '', '7')).toMatchObject({
      isoDate: '2026-09-07',
      done: true,
    })
    expect(typeInSegment('2026-09-15', 'month', '', '2')).toMatchObject({
      isoDate: '2026-02-15',
      done: true,
    })
    // Com 1 ainda cabe outro número: dezembro existe.
    expect(typeInSegment('2026-09-15', 'month', '', '1')).toMatchObject({
      pending: '1',
      done: false,
    })
    expect(typeInSegment('2026-09-15', 'month', '1', '2')).toMatchObject({
      isoDate: '2026-12-15',
      done: true,
    })
  })

  it('o ano espera os quatro números', () => {
    let estado = typeInSegment('2026-09-15', 'year', '', '2')
    expect(estado.done).toBe(false)
    estado = typeInSegment('2026-09-15', 'year', estado.pending, '0')
    estado = typeInSegment('2026-09-15', 'year', estado.pending, '2')
    expect(estado.done).toBe(false)
    estado = typeInSegment('2026-09-15', 'year', estado.pending, '7')
    expect(estado).toMatchObject({ isoDate: '2027-09-15', done: true })
  })

  it('recusa o número que levaria para fora da cobertura', () => {
    const limites = { min: '2026-09-01', max: '2026-09-10' }
    const resultado = typeInSegment('2026-09-02', 'day', '2', '5', limites)

    expect(resultado.isoDate).toBe('2026-09-02')
  })

  it('mostra no campo os números que estão sendo digitados', () => {
    expect(draftWithPending('2026-09-15', 'day', '')).toBe('15/09/2026')
    expect(draftWithPending('2026-09-15', 'day', '0')).toBe('00/09/2026')
    expect(draftWithPending('2026-09-15', 'year', '20')).toBe('15/09/0020')
  })
})

describe('leitura do que foi digitado', () => {
  it('devolve a data em ISO quando ela existe no calendário', () => {
    expect(isoFromBrDate('31/07/2026')).toBe('2026-07-31')
    expect(isoFromBrDate('29/02/2028')).toBe('2028-02-29')
  })

  it('devolve null enquanto a data está incompleta', () => {
    expect(isoFromBrDate('')).toBeNull()
    expect(isoFromBrDate('31')).toBeNull()
    expect(isoFromBrDate('31/07/202')).toBeNull()
  })

  it('devolve null para data que não existe', () => {
    expect(isoFromBrDate('31/02/2026')).toBeNull()
    expect(isoFromBrDate('29/02/2026')).toBeNull()
    expect(isoFromBrDate('32/01/2026')).toBeNull()
    expect(isoFromBrDate('01/13/2026')).toBeNull()
  })

  it('escreve de volta no formato do Brasil, e vazio quando não há data', () => {
    expect(brDateFromIso('2026-07-31')).toBe('31/07/2026')
    expect(brDateFromIso('')).toBe('')
    expect(brDateFromIso('2026-02-30')).toBe('')
  })
})

describe('data válida', () => {
  it('reconhece o formato e o calendário', () => {
    expect(isIsoDate('2026-07-31')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('31/07/2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })

  it('compara com os limites recebidos', () => {
    expect(isSelectable('2026-09-01', '2026-09-01', '2026-09-30')).toBe(true)
    expect(isSelectable('2026-08-31', '2026-09-01', '2026-09-30')).toBe(false)
    expect(isSelectable('2026-10-01', '2026-09-01', '2026-09-30')).toBe(false)
    expect(isSelectable('2026-10-01')).toBe(true)
  })
})
