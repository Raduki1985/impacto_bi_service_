import * as Dialog from '@radix-ui/react-dialog'
import * as Separator from '@radix-ui/react-separator'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Database,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Button } from '../../components/ui/button'

const metrics = [
  { label: 'Operacoes monitoradas', value: '128', trend: '+12%' },
  { label: 'Indicadores ativos', value: '42', trend: '+8%' },
  { label: 'SLA medio', value: '96%', trend: '+3%' },
]

const pillars = [
  {
    title: 'Operacao em tempo real',
    description: 'Acompanhe indicadores essenciais com leitura clara de ritmo, gargalos e prioridade.',
    icon: Activity,
  },
  {
    title: 'Dados confiaveis',
    description: 'Centralize fontes relevantes para reduzir retrabalho e apoiar decisoes com contexto.',
    icon: Database,
  },
  {
    title: 'Gestao orientada por BI',
    description: 'Transforme dados operacionais em visoes executivas para rotina, performance e melhoria continua.',
    icon: BarChart3,
  },
]

export function Welcome() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <LayoutDashboard size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Impacto Businness Intelligence
              </p>
              <p className="text-xs text-slate-500">Operacao orientada por dados</p>
            </div>
          </div>
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <Button variant="secondary" size="sm">
                <ShieldCheck size={16} aria-hidden="true" />
                Status
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-slate-950/35" />
              <Dialog.Content className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">
                      Ambiente preparado
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                      Base React com Tailwind e Radix UI configurada para evoluir o BI da operacao.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Fechar">
                      <X size={18} aria-hidden="true" />
                    </Button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
            <LineChart size={16} aria-hidden="true" />
            BI de dados para acompanhamento da operacao
          </div>
          <h1 className="max-w-4xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl">
            Impacto Businness Intelligence
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Projeto com BI de dados para acompanhamento da operacao, reunindo indicadores, visoes executivas e sinais de performance em uma experiencia objetiva.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button>
              Abrir dashboard
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>
            <Button variant="secondary">Ver indicadores</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Painel operacional</p>
              <h2 className="mt-1 text-xl font-semibold">Resumo do dia</h2>
            </div>
            <div className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              Online
            </div>
          </div>
          <Separator.Root className="my-5 h-px bg-slate-200" />
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-md bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase text-slate-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-bold">{metric.value}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{metric.trend}</p>
              </div>
            ))}
          </div>
          <Tabs.Root defaultValue="performance" className="mt-5">
            <Tabs.List className="grid grid-cols-3 rounded-md bg-slate-100 p-1">
              <Tabs.Trigger className="rounded px-3 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm" value="performance">
                Performance
              </Tabs.Trigger>
              <Tabs.Trigger className="rounded px-3 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm" value="rotina">
                Rotina
              </Tabs.Trigger>
              <Tabs.Trigger className="rounded px-3 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm" value="gestao">
                Gestao
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content className="mt-4 rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600" value="performance">
              Visao consolidada para acompanhar metas, desvios e tendencia dos principais indicadores.
            </Tabs.Content>
            <Tabs.Content className="mt-4 rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600" value="rotina">
              Leitura simples da operacao para apoiar reunioes, priorizacoes e planos de acao.
            </Tabs.Content>
            <Tabs.Content className="mt-4 rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600" value="gestao">
              Camada executiva para transformar dados da operacao em decisoes mensuraveis.
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 py-10 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon

            return (
              <article key={pillar.title} className="rounded-lg border border-slate-200 p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-emerald-700">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
