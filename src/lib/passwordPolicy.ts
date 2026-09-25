/**
 * Regra de composição da senha do portal, espelhada do serviço.
 *
 * A validação de verdade é a do `impacto-bi-service`, em `app/core/password.py`,
 * e é ela que recusa com `422`. Esta cópia existe para a TELA: quem está
 * definindo a senha precisa ver o que falta enquanto digita, e não descobrir a
 * exigência depois de enviar um formulário que já gastou a ida ao serviço.
 *
 * As duas precisam dizer a mesma coisa. Se um dia divergirem, quem manda é o
 * serviço, e a tela vai mostrar uma recusa que ela mesma não previu.
 *
 * Exigências, iguais dos dois lados:
 *
 * - no mínimo 6 caracteres;
 * - ao menos uma letra maiúscula;
 * - ao menos uma letra minúscula;
 * - ao menos um número;
 * - ao menos um caractere especial.
 */

/** Mínimo de caracteres. Vale junto com as demais exigências, não no lugar delas. */
export const PASSWORD_MIN_LENGTH = 6

/**
 * Pontuação ASCII imprimível, o mesmo conjunto do `string.punctuation` do Python
 * que o serviço usa: `!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~`
 *
 * Conjunto explícito, e não "tudo que não é letra nem número": assim uma letra
 * acentuada (á, ç) continua sendo letra, e não passa por caractere especial. É
 * exatamente o que o serviço faz, e é o que evita a tela aprovar uma senha que
 * o serviço vai recusar.
 */
const SPECIAL_CHARACTER = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/

// `\p{Lu}` e `\p{Ll}` em vez das faixas A-Z e a-z para que `Á` conte como
// maiúscula e `ç` como minúscula, como o `isupper`/`islower` do Python.
const UPPERCASE = /\p{Lu}/u
const LOWERCASE = /\p{Ll}/u
const DIGIT = /\p{Nd}/u

/** Cada exigência, com o texto que a tela mostra e o teste que a verifica. */
export type PasswordRequirement = {
  id: 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special'
  label: string
  isMet: (password: string) => boolean
}

/**
 * A lista na ordem em que aparece na tela.
 *
 * A ordem é a mesma da frase que vai no e-mail, para que a pessoa reconheça na
 * tela o que acabou de ler na mensagem.
 */
export const passwordRequirements: readonly PasswordRequirement[] = [
  {
    id: 'length',
    label: `No mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
    isMet: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'Ao menos uma letra maiúscula',
    isMet: (password) => UPPERCASE.test(password),
  },
  {
    id: 'lowercase',
    label: 'Ao menos uma letra minúscula',
    isMet: (password) => LOWERCASE.test(password),
  },
  {
    id: 'digit',
    label: 'Ao menos um número',
    isMet: (password) => DIGIT.test(password),
  },
  {
    id: 'special',
    label: 'Ao menos um caractere especial (!, @, #, $ e outros)',
    isMet: (password) => SPECIAL_CHARACTER.test(password),
  },
]

/** Os ids das exigências ainda não atendidas, na ordem da lista. */
export function unmetPasswordRequirements(password: string): PasswordRequirement['id'][] {
  return passwordRequirements.filter((rule) => !rule.isMet(password)).map((rule) => rule.id)
}

/** true quando a senha atende a TODAS as exigências. */
export function isPasswordAccepted(password: string): boolean {
  return passwordRequirements.every((rule) => rule.isMet(password))
}
