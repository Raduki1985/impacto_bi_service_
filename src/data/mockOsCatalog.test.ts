import { describe, expect, it } from 'vitest'

import {
  OS_ACTIVE_TECHNICIANS,
  OS_CITIES,
  OS_EXPERIMENTAL_PROFESSIONALS,
  OS_RESOLUTIONS,
  OS_SERVICE_TYPES,
  OS_STATUSES,
  OS_TEAMS,
  OS_TECHNICIANS,
} from './mockOsCatalog'

/**
 * O catálogo transcreve os fatos aprovados da investigação do SGI de
 * 21/08/2026: seis equipes, 43 técnicos classificados e os valores
 * normalizados de Tipo de OS, Cidade, Status e Resolução.
 */
describe('equipes oficiais', () => {
  it('tem exatamente as seis equipes aprovadas, sem estados residuais', () => {
    expect([...OS_TEAMS]).toEqual([
      'Infra',
      'Terceirizada',
      'Câmeras',
      'Suporte Técnico',
      'Suporte Lógico',
      'Retiradas',
    ])
    expect(OS_TEAMS).not.toContain('Sem equipe')
    expect(OS_TEAMS).not.toContain('Não classificada')
  })
})

describe('técnicos classificados', () => {
  const byName = new Map(OS_TECHNICIANS.map((technician) => [technician.name, technician]))

  it('tem 43 técnicos, com identificador interno e nome únicos', () => {
    expect(OS_TECHNICIANS).toHaveLength(43)
    expect(new Set(OS_TECHNICIANS.map((technician) => technician.id)).size).toBe(43)
    expect(new Set(OS_TECHNICIANS.map((technician) => technician.name)).size).toBe(43)
  })

  it('usa identificadores locais opacos, nunca e-mail ou dado pessoal', () => {
    const emailPattern = /[\w.+-]+@[\w-]+\.[\w.-]+/

    for (const technician of OS_TECHNICIANS) {
      // Formato interno da base mockada, sem aparência de ID oficial do SGI.
      expect(technician.id).toMatch(/^mock-tech-\d{3}$/)
      expect(technician.id).not.toContain('@')
      expect(technician.id).not.toMatch(emailPattern)
    }

    // A serialização inteira do catálogo (o que chega ao bundle) não carrega
    // nenhum endereço de e-mail.
    expect(JSON.stringify(OS_TECHNICIANS)).not.toMatch(emailPattern)
  })

  it('classifica todo técnico em uma das seis equipes oficiais', () => {
    for (const technician of OS_TECHNICIANS) {
      expect(OS_TEAMS).toContain(technician.team)
    }
  })

  it('exclui completamente João Yoneyama, o perfil DEV de teste', () => {
    for (const technician of OS_TECHNICIANS) {
      expect(technician.name).not.toMatch(/yoneyama/i)
    }
  })

  it('não inclui Josué, que é supervisor e não executor', () => {
    for (const technician of OS_TECHNICIANS) {
      expect(technician.name).not.toMatch(/josu[eé]/i)
    }
  })

  it('mantém as classificações confirmadas dos critérios de aceite', () => {
    expect(byName.get('Felipe de Queiroz Homem')?.team).toBe('Suporte Lógico')
    expect(byName.get('Dener Mendes')?.team).toBe('Suporte Lógico')
    expect(byName.get('Fabio Paiva')?.team).toBe('Infra')
    expect(byName.get('Wesley Alexandre')?.team).toBe('Infra')
    expect(byName.get('Anselmo Pinheiro')?.team).toBe('Câmeras')
    expect(byName.get('Isael França Pereira')?.team).toBe('Câmeras')
    expect(byName.get('Antonio Francisco Pereira Neto')?.team).toBe('Terceirizada')
  })

  it('mantém o tamanho aprovado de cada equipe', () => {
    const count = (team: string) =>
      OS_TECHNICIANS.filter((technician) => technician.team === team).length

    expect(count('Câmeras')).toBe(10)
    expect(count('Infra')).toBe(5)
    expect(count('Terceirizada')).toBe(12)
    expect(count('Suporte Técnico')).toBe(11)
    expect(count('Suporte Lógico')).toBe(2)
    expect(count('Retiradas')).toBe(3)
  })

  it('classifica corretamente o grupo confirmado de 11 terceirizados do SGI', () => {
    const confirmados = [
      'Daniel Aparecido de Oliveira Junior',
      'Felipe de Moura',
      'Fernando Henrique Leite Pereira',
      'Francisco Fabio Bernardo',
      'Gabriel da Silva Santos',
      'Jailson Ribeiro dos Santos Paixão',
      'Jefferson Leal de Oliveira Sampaio',
      'Kelvis Leite Canuto da Silva',
      'Luis Guilherme Serafim',
      'Marcos Antonio Alves de Oliveira',
      'Thiago Andre Santana Teixeira',
    ]

    for (const name of confirmados) {
      expect(byName.get(name)?.team).toBe('Terceirizada')
    }
  })

  it('não duplica Emerson nem Henrique', () => {
    expect(OS_TECHNICIANS.filter((technician) => technician.name.startsWith('Emerson'))).toHaveLength(1)
    expect(OS_TECHNICIANS.filter((technician) => technician.name.startsWith('Henrique'))).toHaveLength(1)
  })

  it('marca como fora do período atual só os quatro profissionais confirmados', () => {
    const inactive = OS_TECHNICIANS.filter((technician) => !technician.activeInCurrentPeriod).map(
      (technician) => technician.name,
    )

    expect(inactive.sort()).toEqual([
      'Bruno França Honorato da Silva',
      'Isael França Pereira',
      'Patrick Fernandes Franco',
      'Rafael Carneiro Alves',
    ])
    expect(OS_ACTIVE_TECHNICIANS).toHaveLength(39)
  })
})

describe('profissionais experimentais', () => {
  it('ficam fora do catálogo de executores e não ganham identificador inventado', () => {
    expect(OS_EXPERIMENTAL_PROFESSIONALS).toHaveLength(5)

    const executorNames = new Set(OS_TECHNICIANS.map((technician) => technician.name))
    for (const professional of OS_EXPERIMENTAL_PROFESSIONALS) {
      expect(executorNames.has(professional.name)).toBe(false)
      expect('id' in professional).toBe(false)
      expect(OS_TEAMS).toContain(professional.team)
    }
  })

  it('mantém as pré-classificações aprovadas', () => {
    const byName = new Map(
      OS_EXPERIMENTAL_PROFESSIONALS.map((professional) => [professional.name, professional.team]),
    )

    expect(byName.get('Ademir Francisco Bento Junior')).toBe('Suporte Técnico')
    expect(byName.get('Eberson Francisley Cardoso')).toBe('Suporte Técnico')
    expect(byName.get('Isaias de Oliveira Assis Neto')).toBe('Suporte Técnico')
    expect(byName.get('Eric Dalmora Machado')).toBe('Retiradas')
    expect(byName.get('William Souza Silva')).toBe('Infra')
  })
})

describe('catálogos normalizados', () => {
  it('publica os treze status normalizados, sem valores crus nem Fechada', () => {
    expect(OS_STATUSES).toHaveLength(13)
    expect(OS_STATUSES).toContain('Encerrada')
    expect(OS_STATUSES).toContain('Técnico no Local')
    expect(OS_STATUSES).toContain('Pendente de Aprovação')

    const raw = ['Fechada', 'in_progress', 'cancelled', 'Chegou', 'Checklist', 'Aguardando Aprovação']
    for (const value of raw) {
      expect(OS_STATUSES).not.toContain(value)
    }
  })

  it('publica os sete tipos de OS e as onze cidades normalizadas', () => {
    expect(OS_SERVICE_TYPES).toHaveLength(7)
    expect(OS_SERVICE_TYPES).toContain('Instalação de Câmeras')
    expect(OS_SERVICE_TYPES).not.toContain('Câmeras')

    expect(OS_CITIES).toHaveLength(11)
    // Sem duplicidade por caixa: cada cidade é única mesmo ignorando o case.
    expect(new Set(OS_CITIES.map((city) => city.toLocaleLowerCase('pt-BR'))).size).toBe(11)
  })

  it('publica as 29 resoluções sem duplicata de caixa e sem o typo Spliter', () => {
    expect(OS_RESOLUTIONS).toHaveLength(29)
    expect(new Set(OS_RESOLUTIONS.map((value) => value.toLocaleLowerCase('pt-BR'))).size).toBe(29)
    expect(OS_RESOLUTIONS).toContain('Splitter')
    expect(OS_RESOLUTIONS).toContain('Cabo Rompido')
    expect(OS_RESOLUTIONS).not.toContain('Spliter')
    expect(OS_RESOLUTIONS).not.toContain('Cabo rompido')
  })
})
