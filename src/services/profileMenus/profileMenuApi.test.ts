import { describe, expect, it } from 'vitest'

import type { CoreProfileMenuTree } from '../../types/coreApi'
import { departmentPageAccessFromMenus, resolveMenuIds } from './profileMenuApi'

/**
 * Tradução entre o acesso do portal (`departmentId + pageKey`) e os UUIDs de
 * `profile_menu` do `impacto-bi-service`.
 *
 * É a parte da integração que pode errar em silêncio: um acesso que não casa não
 * quebra nada, só some da gravação, e a pessoa descobre depois que o perfil não
 * abre a tela prometida. Por isso o foco dos testes é o que NÃO casa.
 *
 * Funções puras, sem rede: a árvore é montada à mão, no formato exato que
 * `GET /profile-menus/tree` devolve.
 */

/** Monta um menu com os campos que a tradução usa; o resto é ruído do contrato. */
function menu(
  id: string,
  menuId: string,
  position: number,
  children: CoreProfileMenuTree[] = [],
): CoreProfileMenuTree {
  return {
    id,
    name: menuId,
    position,
    menu_id: menuId,
    icon: null,
    profile_menu_id: null,
    created_at: '2026-09-23T00:00:00Z',
    updated_at: '2026-09-23T00:00:00Z',
    children,
  }
}

const arvore: CoreProfileMenuTree[] = [
  menu('uuid-os', 'os', 1, [
    menu('uuid-os-overview', 'overview', 1),
    menu('uuid-os-model', 'model', 2),
  ]),
  menu('uuid-comercial', 'comercial', 2, [menu('uuid-comercial-overview', 'overview', 1)]),
]

describe('menus concedidos por um perfil', () => {
  it('traduz página por página e leva junto o menu do departamento', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvore, [
      { departmentId: 'os', pageKeys: ['overview'] },
    ])

    // O nó do departamento entra sozinho: sem ele o serviço guardaria uma página
    // solta, sem o grupo que a abriga na navegação.
    expect(menuIds).toEqual(['uuid-os-overview', 'uuid-os'])
    expect(unmatched).toEqual([])
  })

  it('não repete o menu do departamento quando várias páginas dele são concedidas', () => {
    const { menuIds } = resolveMenuIds(arvore, [
      { departmentId: 'os', pageKeys: ['overview', 'model'] },
    ])

    expect(menuIds).toEqual(['uuid-os-overview', 'uuid-os-model', 'uuid-os'])
  })

  it('percorre mais de um departamento na mesma concessão', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvore, [
      { departmentId: 'os', pageKeys: ['overview'] },
      { departmentId: 'comercial', pageKeys: ['overview'] },
    ])

    expect(menuIds).toEqual([
      'uuid-os-overview',
      'uuid-os',
      'uuid-comercial-overview',
      'uuid-comercial',
    ])
    expect(unmatched).toEqual([])
  })

  it('denuncia a página que o serviço não publicou, em vez de descartá-la', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvore, [
      { departmentId: 'os', pageKeys: ['overview', 'intelligence'] },
    ])

    expect(menuIds).toEqual(['uuid-os-overview', 'uuid-os'])
    expect(unmatched).toEqual(['os::intelligence'])
  })

  it('denuncia todas as páginas quando o departamento inteiro não existe no serviço', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvore, [
      { departmentId: 'cobranca', pageKeys: ['overview', 'model'] },
    ])

    // Nenhum id, e nenhum menu de departamento inventado: o que falta é dito.
    expect(menuIds).toEqual([])
    expect(unmatched).toEqual(['cobranca::overview', 'cobranca::model'])
  })

  it('não concede o menu do departamento quando nenhuma página dele casou', () => {
    const { menuIds } = resolveMenuIds(arvore, [
      { departmentId: 'os', pageKeys: ['intelligence'] },
    ])

    expect(menuIds).toEqual([])
  })

  it('devolve lista vazia para um perfil sem nenhuma concessão', () => {
    expect(resolveMenuIds(arvore, [])).toEqual({ menuIds: [], unmatched: [] })
  })
})

describe('acesso do portal a partir dos menus do serviço', () => {
  it('traduz de volta somente as folhas, agrupadas por departamento', () => {
    expect(
      departmentPageAccessFromMenus(arvore, [
        'uuid-os',
        'uuid-os-overview',
        'uuid-comercial',
        'uuid-comercial-overview',
      ]),
    ).toEqual([
      { departmentId: 'os', pageKeys: ['overview'] },
      { departmentId: 'comercial', pageKeys: ['overview'] },
    ])
  })

  it('ignora o departamento cujo menu veio sem nenhuma página', () => {
    // Concessão só do nó do grupo: não descreve nenhuma tela, então não vira
    // acesso nenhum, e muito menos uma página com a chave do departamento.
    expect(departmentPageAccessFromMenus(arvore, ['uuid-os'])).toEqual([])
  })

  it('devolve lista vazia quando o perfil não tem menus', () => {
    expect(departmentPageAccessFromMenus(arvore, [])).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Convenção real da chave                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A árvore acima usa a chave CRUA do filho (`overview`), que é a forma de
 * compatibilidade. A forma que o serviço realmente publica é a QUALIFICADA
 * (`os.overview`), porque `menu_id` é único na tabela inteira e `overview` só
 * caberia em um departamento.
 *
 * Era exatamente isso que quebrava a aba Acessos: a tradução comparava o texto
 * cru com a chave da página do portal, nenhuma casava, e todo departamento ia
 * para `unmatched`.
 */
const arvoreQualificada: CoreProfileMenuTree[] = [
  menu('uuid-os', 'os', 1, [
    menu('uuid-os-overview', 'os.overview', 1),
    menu('uuid-os-model', 'os.model', 2),
  ]),
  menu('uuid-comercial', 'comercial', 2, [
    menu('uuid-comercial-overview', 'comercial.overview', 1),
  ]),
]

describe('chave do submenu qualificada pelo departamento', () => {
  it('traduz a página concedida sem deixar nada sem correspondência', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvoreQualificada, [
      { departmentId: 'os', pageKeys: ['overview', 'model'] },
    ])

    expect(unmatched).toEqual([])
    expect([...menuIds].sort()).toEqual(['uuid-os', 'uuid-os-model', 'uuid-os-overview'])
  })

  it('não confunde a mesma página de departamentos diferentes', () => {
    const { menuIds, unmatched } = resolveMenuIds(arvoreQualificada, [
      { departmentId: 'comercial', pageKeys: ['overview'] },
    ])

    expect(unmatched).toEqual([])
    expect([...menuIds].sort()).toEqual(['uuid-comercial', 'uuid-comercial-overview'])
  })

  it('volta para o par departamento e página no caminho inverso', () => {
    expect(
      departmentPageAccessFromMenus(arvoreQualificada, [
        'uuid-os',
        'uuid-os-overview',
        'uuid-comercial-overview',
      ]),
    ).toEqual([
      { departmentId: 'os', pageKeys: ['overview'] },
      { departmentId: 'comercial', pageKeys: ['overview'] },
    ])
  })

  it('continua recusando a página que o serviço não publicou', () => {
    const { unmatched } = resolveMenuIds(arvoreQualificada, [
      { departmentId: 'os', pageKeys: ['overview', 'pagina-que-nao-existe'] },
    ])

    expect(unmatched).toEqual(['os::pagina-que-nao-existe'])
  })
})
