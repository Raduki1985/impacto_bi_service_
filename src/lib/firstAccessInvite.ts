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
 * QUEM tem primeiro acesso a resolver é outra pergunta, e ela não se responde
 * mais por esta data: responde-se pela situação `Pendente`. A data diz apenas
 * até quando o link ATUAL vale.
 *
 * Módulo puro, sem relógio próprio: quem chama passa o instante da avaliação. É
 * o que permite testar os três estados sem esperar dez minutos.
 */

/**
 * Estado do CONVITE, e não do usuário.
 *
 * O `pending` daqui não é o status `Pendente` da pessoa: ele fala do link, e
 * significa "ainda no prazo". Um usuário `Pendente` tem convite `pending`
 * enquanto o e-mail atual vale e `expired` depois disso.
 */
export type FirstAccessInviteState =
    /** Não está `Pendente`: já tem senha, e não existe primeiro acesso a resolver. */
    | 'not-applicable'
    /** Convite enviado e ainda dentro do prazo: reenviar derrubaria o link em uso. */
    | 'pending'
    /** Prazo vencido, ou nenhum convite registrado. O reenvio é o caminho. */
    | 'expired'

/**
 * Situação do convite de um usuário no instante informado.
 *
 * SÓ `Pendente` tem primeiro acesso a resolver, e é a única condição avaliada
 * aqui: `Ativo` já definiu a senha, e `Inativo` é quem um Administrador
 * desativou, que também já a tem. Os dois usam a recuperação de senha da tela de
 * entrada quando a esquecem, e o serviço recusa o reenvio para ambos.
 *
 * Antes esta decisão vinha da validade do convite, porque `Pendente` não existia
 * e o portal não tinha como separar "nunca definiu senha" de "foi desativado". O
 * palpite errava num caso real: reenviar o convite a uma conta desativada gravava
 * uma validade nova, e a tela passava a tratá-la como conta sem senha.
 *
 * Validade ausente, nula ou ilegível em um pendente conta como `expired`, e não
 * como `pending`: sem data não há link vivo a proteger, e travar o botão
 * deixaria a pessoa sem nenhum caminho para entrar.
 */
export function firstAccessInviteState(user: User, now: Date): FirstAccessInviteState {
    if (user.status !== 'Pendente') return 'not-applicable'

    const expiresAt = user.firstAccessExpiresAt
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return 'expired'

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return 'expired'

    return deadline.getTime() > now.getTime() ? 'pending' : 'expired'
}

/**
 * O usuário já definiu a própria senha?
 *
 * É a negação de `Pendente`, e nada além disso. O serviço garante a equivalência
 * com duas constraints em `users`: pendente NUNCA tem senha
 * (`ck_users_pending_without_password`) e ativo SEMPRE tem
 * (`ck_users_password_when_active`). Desativado só se alcança tendo senha.
 *
 * Isto já foi uma inferência sobre `firstAccessExpiresAt`, e ela era frágil por
 * construção: a data some quando a senha é definida, mas volta a aparecer quando
 * um convite é reenviado, e então a conta com senha era lida como conta sem. Com
 * o estado `Pendente` vindo do serviço, não há mais o que inferir.
 */
export function hasDefinedPassword(user: User): boolean {
    return user.status !== 'Pendente'
}

/** `HH:mm` no fuso local, para dizer até que horas o link atual ainda vale. */
export function formatInviteDeadline(expiresAt: string | null | undefined): string | null {
    if (expiresAt === null || expiresAt === undefined || expiresAt.trim() === '') return null

    const deadline = new Date(expiresAt)
    if (Number.isNaN(deadline.getTime())) return null

    return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
}
