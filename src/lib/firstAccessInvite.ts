import type { User } from '../data/dashboardTypes'

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
 * A validade vem do serviço em `users.set_password_expire` e chega ao portal
 * como `firstAccessExpiresAt`. O token em si nunca sai do e-mail, e o portal
 * não o conhece: aqui só se compara uma data com o relógio.
 *
 * Módulo puro, sem relógio próprio: quem chama passa o instante da avaliação. É
 * o que permite testar os três estados sem esperar dez minutos.
 */

export type FirstAccessInviteState =
    /** Já definiu a senha. Não existe primeiro acesso a reenviar. */
    | 'not-applicable'
    /** Convite enviado e ainda dentro do prazo: reenviar derrubaria o link em uso. */
    | 'pending'
    /** Prazo vencido, ou nenhum convite registrado. O reenvio é o caminho. */
    | 'expired'

/**
 * Situação do convite de um usuário no instante informado.
 *
 * Usuário `Ativo` é sempre `not-applicable`: ele já definiu a senha e entra no
 * portal, então um e-mail de PRIMEIRO acesso não tem o que fazer ali. Quem
 * esqueceu a senha usa a recuperação, que é o outro fluxo e parte da tela de
 * entrada.
 *
 * Validade ausente, nula ou ilegível em um usuário inativo conta como
 * `expired`, e não como `pending`: sem data não há link vivo a proteger, e
 * travar o botão deixaria a pessoa sem nenhum caminho para entrar.
 */
export function firstAccessInviteState(user: User, now: Date): FirstAccessInviteState {
    if (user.status === 'Ativo') return 'not-applicable'

    const expiresAt = user.firstAccessExpiresAt
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return 'expired'

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return 'expired'

    return deadline.getTime() > now.getTime() ? 'pending' : 'expired'
}

/** `HH:mm` no fuso local, para dizer até que horas o link atual ainda vale. */
export function formatInviteDeadline(expiresAt: string | null | undefined): string | null {
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return null

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return null

    return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
}
