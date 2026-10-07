import {describe, expect, it} from 'vitest'

import type {AccessProfileTypes} from '../../types/accessProfile/accessProfileTypes'
import type {MenuTreeTypes, MenuTypes} from '../../types/menu/menuTypes'
import type {UserTypes} from '../../types/user/userTypes'
import {
    buildAccessProfilesModel,
    describeAccessProfileDeletionImpact,
    describeCoverage,
    describeMenuGroups,
    describeMenuSelectionState,
    menuIdsFromSelection,
    menuLabel,
    withMenuDefaults,
    withoutMenu,
} from './accessProfilesModel'

const TIMESTAMPS = {createdAt: '2026-10-01T12:00:00-03:00', updatedAt: '2026-10-01T12:00:00-03:00'}

function menu(id: string, menuId: string, name: string, position: number, parent: string | null): MenuTypes {
    return {id, menuId, name, position, icon: null, profileMenuId: parent, ...TIMESTAMPS}
}

function root(
    id: string,
    menuId: string,
    name: string,
    position: number,
    children: MenuTreeTypes[] = [],
): MenuTreeTypes {
    return {...menu(id, menuId, name, position, null), children}
}

function child(
    id: string,
    menuId: string,
    name: string,
    position: number,
    parent: string,
): MenuTreeTypes {
    return {...menu(id, menuId, name, position, parent), children: []}
}

const TREE: MenuTreeTypes[] = [
    root('uuid-comercial', 'comercial', 'Comercial', 1, [
        child('uuid-comercial-overview', 'comercial.overview', 'Visão Geral', 1, 'uuid-comercial'),
        child('uuid-comercial-sales', 'comercial.sales', 'Vendas', 2, 'uuid-comercial'),
    ]),
    root('uuid-os', 'os', 'Ordens de Serviço', 2, [
        child('uuid-os-overview', 'os.overview', 'Visão Geral', 1, 'uuid-os'),
        child('uuid-os-intelligence', 'os.intelligence', 'Inteligência (IA)', 2, 'uuid-os'),
        child('uuid-os-model', 'os.model', 'Modelo Dimensional', 3, 'uuid-os'),
    ]),
    root('uuid-financeiro', 'financeiro', 'Financeiro', 3, []),
]

function accessProfile(
    id: string,
    name: string,
    menus: MenuTypes[],
    usersCount = 0,
    description: string | null = null,
): AccessProfileTypes {
    return {id, name, description, menus, usersCount, ...TIMESTAMPS}
}

function user(id: string, name: string, accessProfileId: string, code = 'analyst'): UserTypes {
    return {
        id,
        name,
        email: `${id}@impactotelecom.com`,
        status: 'active',
        isActive: true,
        lastAccess: null,
        profileSystemId: `system-${code}`,
        accessProfileId,
        profileType: {id: `system-${code}`, code, name: code === 'adm' ? 'Administrador' : 'Analista'},
        access: {id: accessProfileId, name: 'qualquer'},
        setPasswordExpire: null,
        ...TIMESTAMPS,
    }
}

describe('menuLabel', () => {
    it('usa o nome gravado', () => {
        expect(menuLabel({name: 'Comercial', menuId: 'comercial'})).toBe('Comercial')
    })

    it('cai na chave quando o nome está em branco, para a linha não aparecer vazia', () => {
        expect(menuLabel({name: '   ', menuId: 'comercial'})).toBe('comercial')
    })
})

describe('describeCoverage', () => {
    it('escreve a fração e a porcentagem do que foi liberado', () => {
        const coverage = describeCoverage('Comercial', 1, 2)

        expect(coverage.fraction).toBe('1/2')
        expect(coverage.percent).toBe(50)
        expect(coverage.accessibleLabel).toBe('Comercial: 1 de 2 submenus liberados')
    })

    it('flexiona o texto acessível no singular', () => {
        expect(describeCoverage('Comercial', 1, 1).accessibleLabel).toBe(
            'Comercial: 1 de 1 submenu liberado',
        )
    })

    it('devolve 0% sem dividir por zero no departamento sem submenu', () => {
        const coverage = describeCoverage('Financeiro', 0, 0)

        expect(coverage.percent).toBe(0)
        expect(coverage.fraction).toBe('0/0')
        expect(coverage.accessibleLabel).toBe('Financeiro: nenhum submenu cadastrado no departamento')
    })
})

describe('describeMenuGroups', () => {
    it('devolve a árvore inteira, inclusive o que o perfil não libera', () => {
        const groups = describeMenuGroups(TREE, new Set(['uuid-comercial-overview']))

        expect(groups.map((group) => group.menuId)).toEqual(['comercial', 'os', 'financeiro'])
        expect(groups[0].coverage.fraction).toBe('1/2')
        expect(groups[1].coverage.fraction).toBe('0/3')
    })

    it('respeita a ordem de `position`, e não a de chegada', () => {
        const groups = describeMenuGroups([TREE[2], TREE[0]], new Set())

        expect(groups.map((group) => group.menuId)).toEqual(['comercial', 'financeiro'])
    })

    it('lê a chave da página sem o prefixo do pai', () => {
        const [comercial] = describeMenuGroups(TREE, new Set())

        expect(comercial.pages.map((page) => page.pageKey)).toEqual(['overview', 'sales'])
    })

    it('marca como concedido só o submenu cujo UUID está na concessão', () => {
        const [comercial] = describeMenuGroups(TREE, new Set(['uuid-comercial-sales']))

        expect(comercial.pages.map((page) => page.granted)).toEqual([false, true])
    })

    it('não conta a raiz concedida como submenu liberado', () => {
        const [comercial] = describeMenuGroups(TREE, new Set(['uuid-comercial']))

        expect(comercial.coverage.granted).toBe(0)
    })
})

describe('menuIdsFromSelection', () => {
    it('acrescenta a raiz quando algum submenu dela está marcado', () => {
        expect(menuIdsFromSelection(TREE, new Set(['uuid-comercial-sales']))).toEqual([
            'uuid-comercial',
            'uuid-comercial-sales',
        ])
    })

    it('descarta o departamento que tem submenus e está com todos desmarcados', () => {
        expect(menuIdsFromSelection(TREE, new Set(['uuid-comercial']))).toEqual([])
    })

    it('concede o departamento sem submenu pela própria raiz', () => {
        expect(menuIdsFromSelection(TREE, new Set(['uuid-financeiro']))).toEqual(['uuid-financeiro'])
    })

    it('devolve lista vazia quando nada está marcado', () => {
        expect(menuIdsFromSelection(TREE, new Set())).toEqual([])
    })

    it('descarta UUID marcado que não está mais na árvore, que o serviço recusaria com 422', () => {
        expect(menuIdsFromSelection(TREE, new Set(['uuid-que-nao-existe']))).toEqual([])
    })

    it('não repete id nenhum e mantém a ordem do serviço', () => {
        const menuIds = menuIdsFromSelection(
            TREE,
            new Set(['uuid-os-model', 'uuid-comercial-overview', 'uuid-comercial', 'uuid-financeiro']),
        )

        expect(menuIds).toEqual([
            'uuid-comercial',
            'uuid-comercial-overview',
            'uuid-os',
            'uuid-os-model',
            'uuid-financeiro',
        ])
        expect(new Set(menuIds).size).toBe(menuIds.length)
    })
})

describe('atalho de páginas padrão', () => {
    it('marca todos os submenus menos IA e Modelo Dimensional', () => {
        const selected = withMenuDefaults(new Set(), TREE[1])

        expect(selected.has('uuid-os-overview')).toBe(true)
        expect(selected.has('uuid-os-intelligence')).toBe(false)
        expect(selected.has('uuid-os-model')).toBe(false)
    })

    it('acrescenta sem desfazer a escolha manual de IA', () => {
        const selected = withMenuDefaults(new Set(['uuid-os-intelligence']), TREE[1])

        expect(selected.has('uuid-os-intelligence')).toBe(true)
        expect(selected.has('uuid-os-overview')).toBe(true)
    })

    it('não toca em outro departamento', () => {
        const selected = withMenuDefaults(new Set(['uuid-comercial-sales']), TREE[1])

        expect(selected.has('uuid-comercial-sales')).toBe(true)
    })

    it('limpa o departamento inteiro, raiz e páginas de concessão intencional incluídas', () => {
        const selected = withoutMenu(
            new Set(['uuid-os', 'uuid-os-overview', 'uuid-os-model', 'uuid-comercial-sales']),
            TREE[1],
        )

        expect([...selected]).toEqual(['uuid-comercial-sales'])
    })

    it('lê `empty`, `partial` e `complete` a partir dos submenus padrão', () => {
        expect(describeMenuSelectionState(TREE[1], new Set())).toBe('empty')
        expect(describeMenuSelectionState(TREE[1], new Set(['uuid-os-model']))).toBe('partial')
        expect(describeMenuSelectionState(TREE[1], new Set(['uuid-os-overview']))).toBe('complete')
    })
})

describe('buildAccessProfilesModel', () => {
    const profiles = [
        accessProfile(
            'access-comercial',
            'Comercial',
            [
                menu('uuid-comercial', 'comercial', 'Comercial', 1, null),
                menu('uuid-comercial-overview', 'comercial.overview', 'Visão Geral', 1, 'uuid-comercial'),
            ],
            2,
            '  Time de vendas  ',
        ),
        accessProfile('access-vazio', 'Sem acesso', [], 0),
    ]

    it('traduz os menus concedidos em departamentos, que é o que o card mostra', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: TREE})

        const [comercial] = model.profiles

        expect(comercial.groupCount).toBe(1)
        expect(comercial.groups[0].label).toBe('Comercial')
        expect(comercial.groups[0].coverage.fraction).toBe('1/2')
        expect(comercial.pageCount).toBe(1)
    })

    it('esconde do card o departamento que o perfil não libera', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: TREE})

        expect(model.profiles[0].groups.map((group) => group.menuId)).toEqual(['comercial'])
        expect(model.profiles[1].groups).toEqual([])
    })

    it('usa a contagem do serviço, e não o número de usuários lidos nesta tela', () => {
        const model = buildAccessProfilesModel({
            profiles,
            users: [user('user-1', 'Ana Souza', 'access-comercial')],
            menuTree: TREE,
        })

        expect(model.profiles[0].userCount).toBe(2)
        expect(model.profiles[0].users).toHaveLength(1)
    })

    it('lista as pessoas pelo vínculo gravado, com iniciais e Perfil do Sistema', () => {
        const model = buildAccessProfilesModel({
            profiles,
            users: [user('user-1', 'Ana Souza', 'access-comercial', 'adm')],
            menuTree: TREE,
        })

        expect(model.profiles[0].users[0]).toMatchObject({
            id: 'user-1',
            initials: 'AS',
            profileCode: 'adm',
            profileName: 'Administrador',
        })
    })

    it('conta como sem perfil quem não tem vínculo e quem aponta para perfil inexistente', () => {
        const model = buildAccessProfilesModel({
            profiles,
            users: [
                user('user-1', 'Ana Souza', 'access-comercial'),
                user('user-2', 'Bruno Lima', ''),
                user('user-3', 'Carla Dias', 'access-que-foi-excluido'),
            ],
            menuTree: TREE,
        })

        expect(model.unassignedUsers.map((item) => item.id)).toEqual(['user-2', 'user-3'])
        expect(model.unassignedUserCount).toBe(2)
    })

    it('soma os vinculados pela contagem do serviço', () => {
        const model = buildAccessProfilesModel({
            profiles,
            users: [user('user-1', 'Ana Souza', 'access-comercial')],
            menuTree: TREE,
        })

        expect(model.matchedUserCount).toBe(2)
    })

    it('mantém a ordem em que o serviço devolveu os perfis', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: TREE})

        expect(model.profiles.map((profile) => profile.id)).toEqual(['access-comercial', 'access-vazio'])
        expect(model.profileCount).toBe(2)
    })

    it('guarda os UUIDs concedidos para o formulário reabrir a seleção', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: TREE})

        expect([...model.profiles[0].grantedMenuIds]).toEqual([
            'uuid-comercial',
            'uuid-comercial-overview',
        ])
    })

    it('normaliza a descrição: nula vira vazia e o entorno é aparado', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: TREE})

        expect(model.profiles[0].description).toBe('Time de vendas')
        expect(model.profiles[1].description).toBe('')
    })

    it('não desenha departamento nenhum enquanto a árvore de menus não chegou', () => {
        const model = buildAccessProfilesModel({profiles, users: [], menuTree: []})

        expect(model.profiles[0].groups).toEqual([])
        expect(model.profiles[0].grantedMenuIds.size).toBe(2)
    })
})

describe('describeAccessProfileDeletionImpact', () => {
    it('libera a exclusão do perfil vazio', () => {
        expect(describeAccessProfileDeletionImpact(0)).toBe(
            'Este perfil não possui usuários vinculados.',
        )
    })

    it('flexiona no singular e diz o que fazer antes', () => {
        expect(describeAccessProfileDeletionImpact(1)).toContain('1 usuário.')
        expect(describeAccessProfileDeletionImpact(1)).toContain('tela Usuários')
    })

    it('flexiona no plural', () => {
        expect(describeAccessProfileDeletionImpact(4)).toContain('4 usuários.')
    })
})
