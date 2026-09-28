import type { User } from '../data/dashboardTypes'

/**
 * Fonte de verdade das cores da situação do usuário, compartilhada pelo badge da
 * tabela de Usuários e pelo chip da lista de usuários dos Perfis de acesso.
 *
 * Existe pelo mesmo motivo de `profileColorClasses`: as duas telas já diziam
 * usar "as mesmas cores da tabela de Usuários" e cada uma escrevia os literais
 * por conta própria. Quando `Pendente` entrou, só uma delas ganhou a cor nova, e
 * a outra passou a pintar de cinza um estado que não é cinza. Com um mapa só,
 * uma situação nova aparece nas duas telas de uma vez, ou em nenhuma.
 *
 * A leitura das cores:
 *
 * - verde é quem ENTRA no portal;
 * - âmbar é o cadastro que falta terminar, e não uma falha: é o mesmo âmbar do
 *   indicador "Sem perfil definido" da aba Perfis de acesso;
 * - cinza é quem está fora por decisão de um Administrador.
 *
 * Classes estáticas e literais, como em `profileColorClasses`: o Tailwind só
 * inclui no CSS final o que consegue ler no código.
 */
export const userStatusColorClasses: Record<User['status'], string> = {
  Ativo: 'bg-[#dcfce7] text-[#16794a]',
  Pendente: 'bg-[#fef0c7] text-[#b54708]',
  Inativo: 'bg-[#f1f3f7] text-[#98a2b3]',
}
