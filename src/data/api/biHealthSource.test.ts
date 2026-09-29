import { describe, expect, it } from 'vitest'

import { buildHealthUrl, fetchBiApiVersion, readApiVersion } from './biHealthSource'

/**
 * Dois pontos guardados aqui, e são os dois em que a linha de versão do menu do
 * usuário já poderia falhar calada:
 *
 * - o endereço, porque `/health` não mora dentro do `/v1` das rotas de BI;
 * - a leitura do corpo, porque o serviço chama o campo de `version` e o
 *   contrato combinado o chama de `apiVersion`.
 */
describe('buildHealthUrl', () => {
  it('sobe um nível quando a base termina na versão da API', () => {
    expect(buildHealthUrl('https://business.impactotelecom.com/api/bi/v1')).toBe(
      'https://business.impactotelecom.com/api/bi/health',
    )
  })

  it('aceita uma base que já esteja na raiz das rotas de BI', () => {
    expect(buildHealthUrl('http://localhost:8000/api/bi')).toBe(
      'http://localhost:8000/api/bi/health',
    )
  })

  it('não confunde um caminho que só parece uma versão', () => {
    // `/v1` sai; `/bi` fica. A regra é o segmento de versão no fim, e não
    // qualquer último segmento curto.
    expect(buildHealthUrl('http://localhost:8000/api/v2')).toBe('http://localhost:8000/api/health')
    expect(buildHealthUrl('http://localhost:8000/api/bi')).not.toContain('/api/health')
  })
})

describe('readApiVersion', () => {
  it('prefere apiVersion, o nome do contrato', () => {
    expect(readApiVersion({ apiVersion: '2.1.0', version: '0.0.1' })).toBe('2.1.0')
  })

  it('aceita version, que é o que o serviço devolve hoje', () => {
    expect(
      readApiVersion({ status: 'ok', service: 'impacto-bi-service', version: '0.0.1' }),
    ).toBe('0.0.1')
  })

  it('recusa corpo sem versão utilizável', () => {
    // Cada um destes já apareceu em algum momento de um health check: sem o
    // campo, com ele vazio, com ele em outro tipo, e um corpo que nem é objeto
    // (o HTML de um 502 de proxy, por exemplo).
    expect(readApiVersion({ status: 'ok' })).toBeNull()
    expect(readApiVersion({ version: '   ' })).toBeNull()
    expect(readApiVersion({ version: 3 })).toBeNull()
    expect(readApiVersion('<html></html>')).toBeNull()
    expect(readApiVersion(null)).toBeNull()
  })
})

describe('fetchBiApiVersion', () => {
  it('não vai à rede sem endereço configurado', async () => {
    // É o estado da suíte inteira: o `vite.config.ts` zera `VITE_BI_API_URL`
    // para nenhum teste tocar o serviço. Aqui isso é o próprio cenário.
    await expect(fetchBiApiVersion()).resolves.toBeNull()
  })
})
