import type {UserTypes} from '../types/user/userTypes'

/**
 * Quando o reenvio do convite de primeiro acesso fica disponível.
 *
 * O convite é o e-mail com o link para a pessoa definir a própria senha. Ele
 * vale 10 minutos, e reenviar gera um token novo que DERRUBA o anterior. É daí
 * que sai a regra: enquanto o link atual estiver no prazo, o botão fica
 * desabilitado, porque reenviar naquele momento invalidaria um e-mail que a
 * pessoa talvez esteja abrindo agora. Passado o prazo, o link morreu e o reenvio
 * é a única saída.
 *
 * A validade vem do serviço em `users.set_password_expire`, e é ela que estas
 * funções leem. O token em si nunca sai do e-mail, e o portal não o conhece:
 * aqui só se compara uma data com o relógio.
 *
 * QUEM tem primeiro acesso a resolver é outra pergunta, e ela não se responde
 * por esta data: responde-se pela situação `pending`. A data diz apenas até
 * quando o link ATUAL vale.
 *
 * Módulo puro, sem relógio próprio: quem chama passa o instante da avaliação. É
 * o que permite testar os três estados sem esperar dez minutos.
 */

/**
 * Estado do CONVITE, e não do usuário.
 *
 * O `pending` daqui não é o status `pending` da pessoa: ele fala do link, e
 * significa "ainda no prazo". Um usuário pendente tem convite `pending`
 * enquanto o e-mail atual vale e `expired` depois disso.
 */

export type FirstAccessInviteState =
    /** Não está pendente: já tem senha, e não existe primeiro acesso a resolver. */
    | 'not-applicable'
    /** Convite enviado e ainda dentro do prazo: reenviar derrubaria o link em uso. */
    | 'pending'
    /** Prazo vencido, ou nenhum convite registrado. O reenvio é o caminho. */
    | 'expired'

/**
 * Situação do convite de um usuário no instante informado.
 *
 * SÓ `pending` tem primeiro acesso a resolver, e é a única condição avaliada
 * aqui: `active` já definiu a senha, e `inactive` é quem um Administrador
 * desativou, que também já a tem. Os dois usam a recuperação de senha da tela de
 * entrada quando a esquecem, e o serviço recusa o reenvio para ambos.
 *
 * Validade ausente, nula ou ilegível em um pendente conta como `expired`, e não
 * como `pending`: sem data não há link vivo a proteger, e travar o botão
 * deixaria a pessoa sem nenhum caminho para entrar.
 */
export function firstAccessInviteState(user: UserTypes, now: Date): FirstAccessInviteState {
    if (user.status !== 'pending') return 'not-applicable'

    const expiresAt = user.setPasswordExpire
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return 'expired'

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return 'expired'

    return deadline.getTime() > now.getTime() ? 'pending' : 'expired'
}

/**
 * true quando a conta já tem senha.
 *
 * `inactive` entra aqui junto com `active`: desativar só alcança quem já entrava
 * no portal, e quem nunca definiu senha está `pending`.
 */
export function hasDefinedPassword(user: UserTypes): boolean {
    return user.status !== 'pending'
}

/** Prazo do convite em `HH:mm` local, ou null quando não há prazo a mostrar. */
export function formatInviteDeadline(expiresAt: string | null | undefined): string | null {
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return null

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return null

    return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
}
