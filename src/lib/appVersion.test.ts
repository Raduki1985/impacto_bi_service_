import { describe, expect, it } from 'vitest'

import { version as packageVersion } from '../../package.json'
import { APP_VERSION, buildVersionLabel, isNewerVersion } from './appVersion'

/**
 * O que estes cenários guardam é a regra de leitura da linha de versão: em
 * produção o número aparece limpo, e fora dela o ambiente vem junto, sempre.
 * Um build de homologação que se apresentasse como produção mandaria alguém
 * conferir um número no ambiente errado.
 */
describe('buildVersionLabel', () => {
  it('mostra só o número em produção', () => {
    expect(buildVersionLabel('1.4.2', 'production')).toBe('1.4.2')
  })

  it('identifica homologação e a máquina de desenvolvimento', () => {
    expect(buildVersionLabel('1.4.2', 'staging')).toBe('1.4.2 - homolog')
    expect(buildVersionLabel('1.4.2', 'development')).toBe('1.4.2 - dev')
  })

  it('não inventa sufixo para um modo desconhecido', () => {
    // Modo novo no `Dockerfile` não pode virar um rótulo errado na tela: até
    // alguém decidir como ele se chama, o número aparece sozinho.
    expect(buildVersionLabel('1.4.2', 'preview')).toBe('1.4.2')
  })
})

describe('APP_VERSION', () => {
  it('vem do package.json, e não de uma constante copiada', () => {
    // O valor exato muda a cada versão; o que não pode mudar é a origem dele.
    // Sem isto, alguém sobe a versão no `package.json`, o portal continua
    // exibindo a antiga, e ninguém percebe.
    expect(APP_VERSION).toBe(packageVersion)
  })
})

/**
 * A regra que decide se o aviso de versão nova aparece. O erro caro aqui não é
 * o aviso que demora um ciclo: é o aviso INDEVIDO, que manda recarregar para
 * receber exatamente a mesma tela, e o próximo ciclo manda de novo.
 */
describe('isNewerVersion', () => {
  it('reconhece a versão publicada mais nova', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('0.1.10', '0.1.9')).toBe(true)
  })

  it('não avisa sobre a mesma versão', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
  })

  it('não avisa quando a publicada é mais antiga', () => {
    // O caso do rollback em produção. Uma comparação por texto diferente
    // mandaria "atualizar" para uma versão mais velha, em laço.
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false)
    expect(isNewerVersion('0.1.9', '0.1.10')).toBe(false)
  })

  it('compara número a número, e não texto a texto', () => {
    // `'0.1.10' > '0.1.9'` é falso em ordem alfabética: o 1 vem antes do 9.
    expect(isNewerVersion('0.1.10', '0.1.9')).toBe(true)
  })

  it('trata número faltando como zero', () => {
    expect(isNewerVersion('0.2', '0.1.7')).toBe(true)
    expect(isNewerVersion('0.1', '0.1.0')).toBe(false)
  })

  it('não avisa quando algum dos lados não é uma versão', () => {
    // Vem do que o servidor devolveu: um corpo estranho, um número com sufixo
    // de pré-lançamento, uma parte vazia. Sem afirmar, sem avisar.
    expect(isNewerVersion('', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.2.0-rc1', '0.1.0')).toBe(false)
    expect(isNewerVersion('0..2', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.2.0', 'desconhecida')).toBe(false)
  })
})
