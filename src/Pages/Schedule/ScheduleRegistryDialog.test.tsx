import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../contexts/PreferencesContext'
import { makeScheduleFixture } from './scheduleFixture.testing'
import { buildRegistryLines } from './scheduleModel'
import { ScheduleRegistryPanel } from './ScheduleRegistryDialog'
import {
  buildRegistryWorkbook,
  REGISTRY_COLUMNS,
  registryFileName,
  registryFiltersText,
} from './scheduleRegistryModel'

/**
 * Teste espelho da janela do cadastro de aptidões: o painel desenhado sobre
 * a agenda sintética, dentro do contexto da janela (o título da janela só
 * existe dentro dele), as colunas, o texto do recorte e a planilha.
 */

const lines = buildRegistryLines(makeScheduleFixture())

describe('janela do cadastro de aptidões', () => {
  it('desenha o título, as colunas e uma linha por técnico e categoria', () => {
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <Dialog.Root open>
          <ScheduleRegistryPanel
            historyDays={28}
            panelContainer={null}
            readAt="2026-10-16T14:32:00-03:00"
            rows={lines}
            today="2026-10-16"
          />
        </Dialog.Root>
      </PreferencesProvider>,
    )

    expect(html).toContain('Cadastro de aptidões a corrigir no SGI')
    expect(html).toContain('últimos 28 dias')
    for (const column of REGISTRY_COLUMNS) expect(html).toContain(column.label)
    expect(html).toContain('Técnico A')
    expect(html).toContain('Equipe Sul, Equipe Norte')
    expect(html).toContain('Sem equipe')
    expect(html).toContain('Inativo')
    expect(html).toContain('5 linhas')
    expect(html).not.toContain('—')
  })

  it('escreve o recorte da lista para a planilha, ou nada sem filtro', () => {
    expect(registryFiltersText({})).toBeNull()
    expect(registryFiltersText({ teams: ['Equipe Norte'], status: ['Ativo'] }, ' cto ')).toBe(
      'Equipe: Equipe Norte · Situação: Ativo · Busca: "cto"',
    )
  })

  it('monta a planilha com as linhas e a aba de recorte, e nomeia o arquivo pelo dia', () => {
    const bytes = buildRegistryWorkbook(lines, {
      historyDays: 28,
      listFilters: null,
      readAt: '2026-10-16T14:32:00-03:00',
      generatedAt: '16/10/2026 14:40',
    })

    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(registryFileName('2026-10-16')).toBe('cadastro-aptidoes-sgi-2026-10-16.xlsx')
  })
})
