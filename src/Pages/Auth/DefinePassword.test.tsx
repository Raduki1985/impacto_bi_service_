import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { passwordRequirements } from '../../lib/passwordPolicy'
import { DefinePassword } from './DefinePassword'
import { ForgotPassword } from './ForgotPassword'

/**
 * Telas de senha na primeira renderização.
 *
 * O que está sendo verificado é o estado em que a pessoa CHEGA em cada tela,
 * antes de digitar qualquer coisa: o que está escrito, o que já está bloqueado e
 * o que a regra de senha anuncia. A interação (digitar, enviar, receber a
 * resposta do serviço) não é exercitada aqui porque a suíte renderiza para
 * texto, sem estado; a regra que decide o botão está coberta em
 * `lib/passwordPolicy.test.ts`.
 */

const nada = () => undefined

describe('definição de senha', () => {
  it('mostra as cinco exigências da senha antes de qualquer digitação', () => {
    const html = renderToStaticMarkup(
      <DefinePassword mode="first-access" onGoToLogin={nada} token="abc"/>,
    )

    for (const rule of passwordRequirements) {
      expect(html).toContain(rule.label)
    }
    // Nenhuma atendida com o campo vazio.
    expect(html).not.toContain('data-met="true"')
  })

  it('nasce com o botão bloqueado: senha vazia não atende à regra', () => {
    const html = renderToStaticMarkup(
      <DefinePassword mode="reset" onGoToLogin={nada} token="abc"/>,
    )

    expect(html).toContain('disabled=""')
  })

  it('separa o texto dos dois modos', () => {
    const primeiroAcesso = renderToStaticMarkup(
      <DefinePassword mode="first-access" onGoToLogin={nada} token="abc"/>,
    )
    const redefinicao = renderToStaticMarkup(
      <DefinePassword mode="reset" onGoToLogin={nada} token="abc"/>,
    )

    // Só o primeiro acesso ativa a conta; a redefinição troca a senha de quem
    // já entrava, e prometer ativação ali seria mentira.
    expect(primeiroAcesso).toContain('Definir senha e ativar conta')
    expect(redefinicao).toContain('Salvar nova senha')
    expect(redefinicao).not.toContain('ativar conta')
  })

  it('sem token na URL não monta o formulário', () => {
    const html = renderToStaticMarkup(
      <DefinePassword mode="first-access" onGoToLogin={nada} token={null}/>,
    )

    expect(html).toContain('Link inválido')
    expect(html).not.toContain('Exigências da senha')
    expect(html).not.toContain('Repita a nova senha')
  })

  it('avisa que o link vale por dez minutos e uma vez só', () => {
    const html = renderToStaticMarkup(
      <DefinePassword mode="reset" onGoToLogin={nada} token="abc"/>,
    )

    expect(html).toContain('10 minutos')
    expect(html).toContain('uma vez')
  })
})

describe('pedido de recuperação', () => {
  it('pede o e-mail e nada mais', () => {
    const html = renderToStaticMarkup(<ForgotPassword onBackToLogin={nada}/>)

    expect(html).toContain('Recuperar senha')
    expect(html).toContain('Enviar link de recuperação')
    expect(html).toContain('type="email"')
    // Senha não se digita aqui: esta tela só dispara o e-mail.
    expect(html).not.toContain('type="password"')
  })

  it('usa o mesmo enquadramento do login, sem alterá-lo', () => {
    const html = renderToStaticMarkup(<ForgotPassword onBackToLogin={nada}/>)

    // `login-page` traz o visual do login; `auth-page` é a raiz por onde o CSS
    // próprio destas telas é escopado, e é o que impede uma regra nova de
    // alcançar a tela de entrada.
    expect(html).toContain('class="login-page auth-page"')
    expect(html).toContain('class="brand-panel"')
    expect(html).toContain('class="login-form"')
  })
})
