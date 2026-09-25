import * as Dialog from '@radix-ui/react-dialog'
import { Check, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '../../components/ui/button'
import { profileColorClasses } from '../../lib/profileColors'
import { type PreviewProfile, type PreviewUnassignedUser } from './accessProfilesPreviewModel'
import {
  chipClass,
  fieldLabelClass,
  modalOverlayClass,
  modalShellClass,
  UserAvatar,
} from './accessProfilesUi'
import { DepartmentCoverageChip } from './DepartmentCoverageChip'

/**
 * Modal de `Definir perfil`: dá um Perfil de Acesso a quem está sem nenhum.
 *
 * Uma tarefa só, e é por isso que ele existe em vez de reaproveitar o formulário
 * de usuário ou o formulário de perfil. O formulário completo de edição de usuário
 * abriria nome, e-mail, Perfil do Sistema e status para uma pessoa que só precisa
 * receber um vínculo; o formulário de perfil pediria de volta o conteúdo inteiro
 * do perfil de destino para acrescentar uma linha à lista de usuários dele.
 *
 * O que é reaproveitado é o TRAÇO, e não a lógica: overlay, superfície de modal,
 * avatar, badge de Perfil do Sistema e botões vêm das mesmas peças usadas nos
 * formulários de Perfis de acesso, então este modal não é uma tela com aparência
 * própria.
 *
 * O usuário aparece em leitura, sem nenhum campo editável: avatar, nome, e-mail e
 * o badge do Perfil do Sistema, exatamente a mesma identificação que a seção
 * `Usuários sem perfil de acesso definido` mostra na linha de onde a ação partiu.
 *
 * A lista de perfis chega pronta e já filtrada pela regra de domínio: comuns,
 * ativos e do destino que corresponde ao Perfil do Sistema da pessoa. `Acesso do
 * Sistema` não é oferecido em nenhuma hipótese, e a gravação revalida tudo de
 * novo, porque a coleção pode ter mudado depois desta leitura.
 *
 * Cada opção descreve o perfil pela COBERTURA, com os mesmos labels de
 * departamento dos cards da página: nome, fração de páginas liberadas e o
 * detalhamento interativo das páginas. Contagem de usuários não aparece: a decisão
 * aqui é sobre o que a pessoa vai poder ver.
 *
 * Sem escolha não existe ação: `Definir perfil` fica desabilitado até um perfil
 * ser selecionado. Uma recusa MANTÉM o modal aberto com a mensagem e a seleção
 * intactas, porque nada foi gravado e a tentativa pode ser repetida. Cancelar e
 * fechar não alteram nada.
 */

/**
 * Mais estreito que o formulário e mais largo que a confirmação de exclusão: o
 * conteúdo é uma leitura curta e uma lista de escolha única, e a altura acompanha
 * o conteúdo até o limite da viewport, como no modal de consulta.
 *
 * A largura acompanha os labels de cobertura: um perfil pode conceder onze
 * departamentos, e cada um deles é um label na linha da opção. No celular o modal
 * ocupa quase a tela inteira e os labels quebram em várias linhas, sem rolagem
 * horizontal.
 */
const assignModalClass = 'max-w-[calc(100vw-24px)] max-h-[92vh] sm:max-h-[88vh] sm:w-[620px]'

export function AssignAccessProfileModal({
  onOpenChange,
  onSubmit,
  options,
  user,
}: {
  onOpenChange: (open: boolean) => void
  /**
   * Grava o vínculo no serviço. Devolve a mensagem de recusa, ou null no
   * sucesso, e nesse caso quem fecha o modal é a página, ao limpar o alvo.
   */
  onSubmit: (accessProfileId: string) => Promise<string | null>
  /** Perfis que este usuário pode receber hoje, na ordem da coleção. */
  options: readonly PreviewProfile[]
  /** Usuário sem Perfil de Acesso, ou null quando o modal está fechado. */
  user: PreviewUnassignedUser | null
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={user !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className={modalOverlayClass} />
        <Dialog.Content className={`${modalShellClass} ${assignModalClass}`}>
          {user ? (
            // Trocar de usuário remonta o corpo, e com ele a escolha e a mensagem
            // de erro: o modal nunca abre mostrando a seleção da pessoa anterior.
            <AssignBody
              key={user.id}
              onClose={() => onOpenChange(false)}
              onSubmit={onSubmit}
              options={options}
              user={user}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function AssignBody({
  onClose,
  onSubmit,
  options,
  user,
}: {
  onClose: () => void
  onSubmit: (accessProfileId: string) => Promise<string | null>
  options: readonly PreviewProfile[]
  user: PreviewUnassignedUser
}) {
  const baseId = useId()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Gravação em andamento no serviço: um segundo clique não pode reenviar. */
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (selectedProfileId === null || submitting) return

    setSubmitting(true)
    try {
      // Recusa mantém tudo aberto e preenchido; o sucesso é a página quem conclui.
      setError(await onSubmit(selectedProfileId))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex flex-none items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <Dialog.Title className="text-[16px] font-bold leading-tight text-[#172033]">
            Definir Perfil de Acesso
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[11.5px] leading-4 text-[#98a2b3]">
            Escolha o Perfil de Acesso que este usuário passará a usar.
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button aria-label="Fechar" size="icon" variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </Dialog.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {/* Identificação em leitura: os mesmos quatro dados da linha de onde a
            ação partiu, e nenhum campo do cadastro do usuário. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-[#eaecf2] bg-[#f7f8fa] px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <UserAvatar initials={user.initials} profile={user.profile} />
            <span className="min-w-0">
              <span className="block break-words text-[12.5px] font-medium text-[#172033]">
                {user.name}
              </span>
              <span className="mt-0.5 block break-all text-[11.5px] leading-4 text-[#667085]">
                {user.email}
              </span>
            </span>
          </span>
          <span className={`${chipClass} flex-none ${profileColorClasses[user.profile]}`}>
            {user.profile}
          </span>
        </div>

        <div className="mt-4">
          <ProfileOptions
            baseId={baseId}
            onSelect={(profileId) => {
              setSelectedProfileId(profileId)
              setError(null)
            }}
            options={options}
            selectedProfileId={selectedProfileId}
            userProfile={user.profile}
          />
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] bg-[#f6f8fb] px-5 py-2.5">
        <span className="min-w-0 text-[11.5px] leading-4 text-[#667085]">
          {error ? (
            <span className="font-medium text-[#b42318]" role="alert">
              {error}
            </span>
          ) : (
            'Cancelar fecha sem alterar nada.'
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={onClose} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={selectedProfileId === null || submitting} onClick={handleSubmit} size="sm">
            Definir perfil
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * Escolha única entre os perfis compatíveis.
 *
 * Botões de opção NATIVOS, todos com o mesmo `name`, dentro de um `fieldset` com
 * legenda: é o que dá exclusividade real, navegação por setas e o anúncio "opção
 * 2 de 5" sem uma linha de código de foco. O desenho é quadrado, no padrão dos
 * controles de seleção desta área, e vem de `appearance-none` sobre o próprio
 * `input`: o elemento continua sendo um `radio` para o navegador e para o leitor
 * de tela, e só o formato muda. O símbolo de confirmação é decorativo e não
 * recebe ponteiro.
 *
 * Nenhuma opção vem marcada: escolher é justamente a decisão que este modal pede,
 * e uma pré-seleção convidaria a confirmar sem ler.
 */
function ProfileOptions({
  baseId,
  onSelect,
  options,
  selectedProfileId,
  userProfile,
}: {
  baseId: string
  onSelect: (profileId: string) => void
  options: readonly PreviewProfile[]
  selectedProfileId: string | null
  userProfile: PreviewUnassignedUser['profile']
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-[#f3d9a5] bg-[#fffaf0] px-4 py-3.5">
        <p className="text-[12.5px] font-semibold text-[#7a5a12]">
          Nenhum Perfil de Acesso compatível
        </p>
        <p className="mt-1 text-[12px] leading-5 text-[#8a6a2a]">
          Não existe Perfil de Acesso ativo destinado ao Perfil do Sistema{' '}
          {userProfile} neste portal. Crie um perfil com esse destino em{' '}
          <strong className="font-semibold">Novo perfil</strong> e depois defina o perfil deste
          usuário.
        </p>
      </div>
    )
  }

  return (
    <fieldset className="min-w-0">
      <legend className={fieldLabelClass}>
        Perfis de Acesso disponíveis{' '}
        <span className="font-normal text-[#667085]">(obrigatório)</span>
      </legend>
      <ul className="grid gap-1">
        {options.map((profile) => (
          <ProfileOption
            key={profile.id}
            onSelect={() => onSelect(profile.id)}
            optionId={`${baseId}-${profile.id}`}
            groupName={`${baseId}-access-profile`}
            profile={profile}
            selected={profile.id === selectedProfileId}
          />
        ))}
      </ul>
    </fieldset>
  )
}

/**
 * Uma opção do grupo: controle de seleção, nome do perfil e a cobertura dele.
 *
 * IRMÃOS, e não aninhados. O `label` cobre apenas o controle e o nome; os labels
 * de cobertura ficam fora dele, ao lado. É o que separa as duas intenções que
 * convivem na mesma linha: escolher o perfil e conferir o que ele libera. Com o
 * label envolvendo a linha inteira, tocar em um departamento para ler as páginas
 * dele selecionava o perfil de tabela, e um botão dentro de um `label` ainda
 * seria controle dentro de controle.
 *
 * A cobertura usa exatamente os mesmos labels dos cards da página: nome do
 * departamento, fração de páginas liberadas e o detalhamento interativo por
 * mouse, teclado e toque. Um por vez na tela inteira, porque
 * `CoverageTooltipProvider` envolve a página e todos os modais dela. A quantidade
 * de usuários do perfil não aparece aqui: quem está definindo o perfil de uma
 * pessoa decide pelo que o perfil libera, e o número de pessoas nele é leitura da
 * consulta do perfil.
 */
function ProfileOption({
  groupName,
  onSelect,
  optionId,
  profile,
  selected,
}: {
  groupName: string
  onSelect: () => void
  optionId: string
  profile: PreviewProfile
  selected: boolean
}) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 transition ${
        selected ? 'border-[#c7d7fe] bg-[#f5f8ff]' : 'border-[#eaecf2] bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Caixa quadrada: `appearance-none` remove o círculo do navegador e o
            `input` continua sendo o próprio controle, com a área de clique e o
            anel de foco dele. O símbolo fica sobreposto, decorativo e sem
            ponteiro, para não roubar o clique do controle. */}
        <span className="relative flex h-4 w-4 flex-none items-center justify-center">
          <input
            checked={selected}
            className={`absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded-[3px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[#d0d5dd] bg-white'
            }`}
            id={optionId}
            name={groupName}
            onChange={onSelect}
            type="radio"
            value={profile.id}
          />
          {selected ? (
            <Check
              aria-hidden="true"
              className="pointer-events-none relative text-white"
              size={11}
              strokeWidth={3}
            />
          ) : null}
        </span>
        {/* O nome é o rótulo do controle, e nada além dele entra aqui. */}
        <label
          className="min-w-0 flex-1 cursor-pointer break-words text-[12.5px] font-semibold text-[#172033]"
          htmlFor={optionId}
        >
          {profile.name}
        </label>
      </div>
      <ProfileCoverage profile={profile} />
    </li>
  )
}

/** Cobertura do perfil na mesma leitura dos cards: um label por departamento. */
function ProfileCoverage({ profile }: { profile: PreviewProfile }) {
  if (profile.departments.length === 0) {
    return (
      <p className="mt-1.5 pl-7 text-[11px] leading-4 text-[#98a2b3]">
        Nenhum departamento concedido
      </p>
    )
  }

  return (
    // Recuo até o eixo do nome do perfil: os labels pertencem à opção, e sem o
    // recuo eles pareciam uma segunda coluna solta.
    <div className="mt-1.5 flex flex-wrap gap-1 pl-7">
      {profile.departments.map((department) => (
        <DepartmentCoverageChip
          coverage={department.coverage}
          key={department.departmentId}
          label={department.label}
          pages={department.catalogPages}
        />
      ))}
    </div>
  )
}
