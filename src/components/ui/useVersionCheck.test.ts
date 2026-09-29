import { describe, expect, it } from 'vitest'

import { resolveIntervalMs } from './useVersionCheck'

/**
 * O intervalo vem de uma variável de ambiente, ou seja, de TEXTO escrito à mão
 * em um arquivo por ambiente. O que estes cenários guardam é que nenhum
 * engano ali vira um relógio disparando sem parar em cada aba aberta da
 * empresa.
 */
describe('resolveIntervalMs', () => {
  it('converte os minutos do ambiente em milissegundos', () => {
    expect(resolveIntervalMs('5')).toBe(5 * 60 * 1000)
  })

  it('usa o padrão quando o ambiente não define a variável', () => {
    // É o estado da suíte e o de qualquer `.env.local` que não a tenha.
    expect(resolveIntervalMs(undefined)).toBe(15 * 60 * 1000)
    expect(resolveIntervalMs('')).toBe(15 * 60 * 1000)
  })

  it('usa o padrão no lugar de um valor que não é número', () => {
    // `Number('quinze')` é NaN, e `setInterval(fn, NaN)` dispara na hora, em
    // laço: seria uma consulta por quadro, e não a cada quinze minutos.
    expect(resolveIntervalMs('quinze')).toBe(15 * 60 * 1000)
  })

  it('não desce abaixo de um minuto', () => {
    // Zero e negativo têm o mesmo efeito do NaN. O valor em segundos digitado
    // por engano (`30`, querendo dizer meio minuto) não é detectável, mas o
    // piso pega os dois casos que quebrariam de verdade.
    expect(resolveIntervalMs('0')).toBe(15 * 60 * 1000)
    expect(resolveIntervalMs('-5')).toBe(15 * 60 * 1000)
  })
})
