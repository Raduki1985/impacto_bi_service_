export const PASSWORD_MIN_LENGTH = 6

const SPECIAL_CHARACTER = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/

const UPPERCASE = /\p{Lu}/u
const LOWERCASE = /\p{Ll}/u
const DIGIT = /\p{Nd}/u

export type PasswordRequirement = {
    id: 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special'
    label: string
    isMet: (password: string) => boolean
}

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

export function unmetPasswordRequirements(password: string): PasswordRequirement['id'][] {
    return passwordRequirements.filter((rule) => !rule.isMet(password)).map((rule) => rule.id)
}

export function isPasswordAccepted(password: string): boolean {
    return passwordRequirements.every((rule) => rule.isMet(password))
}
