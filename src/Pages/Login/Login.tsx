import { BarChart3 } from 'lucide-react'

import { Button } from '../../components/ui/button'

type LoginProps = {
  onLogin: () => void
}

export function Login({ onLogin }: LoginProps) {
  return (
    <main className="flex min-h-screen bg-white text-[#101828]">
      <section className="hidden flex-1 flex-col justify-between bg-[#101828] px-[60px] py-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--accent)]">
            <BarChart3 size={20} aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <div className="font-bold">Impacto Businness Intelligence</div>
            <div className="text-xs text-[#8891a5]">Business Intelligence</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-[480px] text-[32px] font-bold leading-tight tracking-normal">
            Inteligência operacional para acompanhar sua rede.
          </h1>
          <p className="mt-3.5 max-w-[430px] text-sm leading-6 text-[#9aa3b5]">
            Acompanhe produtividade, qualidade e gargalos das ordens de serviço em tempo real.
          </p>
          <div className="mt-9 flex gap-9">
            <div><div className="font-mono text-2xl font-semibold">1.8k</div><div className="text-[11.5px] text-[#8891a5]">OS / trimestre</div></div>
            <div><div className="font-mono text-2xl font-semibold">12</div><div className="text-[11.5px] text-[#8891a5]">técnicos ativos</div></div>
            <div><div className="font-mono text-2xl font-semibold">91%</div><div className="text-[11.5px] text-[#8891a5]">taxa de conclusão</div></div>
          </div>
        </div>
        <div className="text-[11.5px] text-[#5b6478]">© 2026 Impacto Businness Intelligence</div>
      </section>
      <section className="flex w-full items-center justify-center px-8 py-10 lg:w-[452px]">
        <div className="w-full max-w-[326px]">
          <h2 className="text-[22px] font-bold">Entrar</h2>
          <p className="mb-6 mt-1 text-[13px] text-[#98a2b3]">Acesse o painel com suas credenciais.</p>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">E-mail</label>
          <input className="mb-4 w-full rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-weak)]" defaultValue="carla.mendes@provedor.com.br" type="email" />
          <label className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Senha</label>
          <input className="mb-4 w-full rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-weak)]" defaultValue="demo-senha-123" type="password" />
          <div className="mb-5 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[#475467]">
              <input className="h-4 w-4 accent-[var(--accent)]" defaultChecked type="checkbox" />
              Lembrar-me
            </label>
            <button className="text-[12.5px] font-medium text-[var(--accent)]" type="button">
              Esqueci minha senha
            </button>
          </div>
          <Button className="w-full" onClick={onLogin}>Entrar</Button>
          <p className="mt-5 text-center text-[11.5px] text-[#b0b6c3]">Tela de demonstração - autenticação a implementar</p>
        </div>
      </section>
    </main>
  )
}
