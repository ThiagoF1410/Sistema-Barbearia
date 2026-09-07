import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarServicos } from '../services/servicosService'
import { listarHorariosFuncionamento } from '../services/agendaService'
import BrandIcon from '../components/ui/BrandIcon'
import logoImg from '../assets/Logo1.avif'
import barbeariaImg from '../assets/FotoLandingPage.avif'

const diferenciais = [
  { icon: 'professional', title: 'Profissionais especializados', text: 'Técnica, atenção aos detalhes e acabamento impecável.' },
  { icon: 'shield', title: 'Higiene e cuidado', text: 'Materiais higienizados e atendimento preparado para você.' },
  { icon: 'calendar', title: 'Hora marcada', text: 'Mais organização para você aproveitar cada minuto.' },
  { icon: 'bottle', title: 'Produtos profissionais', text: 'Qualidade premium para cuidar do seu estilo.' },
]

const nomesDias = {
  0: 'Domingo',
  1: 'Segunda Feira',
  2: 'Terça Feira',
  3: 'Quarta Feira',
  4: 'Quinta Feira',
  5: 'Sexta Feira',
  6: 'Sábado',
}

function formatarPreco(preco) {
  return Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const [servicos, setServicos] = useState([])
  const [horarios, setHorarios] = useState([])

  const destinoPainel = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'profissional' ? '/profissional' : '/dashboard'
  const destinoAgendamento = isAuthenticated ? '/agendar' : '/cadastro'
  const endereco = import.meta.env.VITE_BARBEARIA_ENDERECO
  const mapaUrl = import.meta.env.VITE_BARBEARIA_MAPA_URL
  const depoimento = import.meta.env.VITE_DEPOIMENTO_TEXTO
  const autorDepoimento = import.meta.env.VITE_DEPOIMENTO_AUTOR

  useEffect(() => {
    Promise.allSettled([
      listarServicos(),
      listarHorariosFuncionamento(),
    ]).then(([resultadoServicos, resultadoHorarios]) => {
      if (resultadoServicos.status === 'fulfilled') {
        setServicos(resultadoServicos.value.filter((item) => item.tipo === 'servico').slice(0, 4))
      }
      if (resultadoHorarios.status === 'fulfilled') setHorarios(resultadoHorarios.value)
    })
  }, [])

  return (
    <div className="bg-background text-on-surface">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-primary/15 bg-black/88 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link to="/inicio" className="flex items-center gap-3 min-w-0" aria-label="O Rei da Navalha — início">
            <img src={logoImg} alt="" width="48" height="48" decoding="async" className="h-12 w-12 object-contain shrink-0" />
            <div className="hidden sm:block min-w-0">
              <p className="font-headline text-xl leading-none truncate">O Rei da Navalha</p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-primary/70 mt-1">Barbearia</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6" aria-label="Navegação principal">
            <a href="#servicos" className="hidden md:block text-sm font-medium text-white/85 hover:text-primary focus-visible:text-primary transition-colors">Serviços</a>
            <a href="#horarios" className="hidden md:block text-sm font-medium text-white/85 hover:text-primary focus-visible:text-primary transition-colors">Horários</a>
            {isAuthenticated ? (
              <Link to={destinoPainel} className="px-5 py-2.5 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:bg-primary-container transition-colors">
                Meu painel
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-white/85 hover:text-primary focus-visible:text-primary transition-colors">Entrar</Link>
                <Link to="/cadastro" className="px-4 sm:px-5 py-2.5 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:bg-primary-container transition-colors">
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen flex items-center overflow-hidden pt-18">
          <img
            src={barbeariaImg}
            alt="Interior da barbearia O Rei da Navalha"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[62%_center] md:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 md:via-black/68 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-black/5 to-black/55" />

          <div className="relative z-10 max-w-7xl w-full mx-auto px-5 sm:px-6 py-24">
            <div className="max-w-3xl space-y-7">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/30 bg-black/20 text-primary text-[10px] sm:text-xs font-label font-bold uppercase tracking-[0.2em] rounded-full backdrop-blur-sm">
                <BrandIcon name="crown" size={17} />
                Tradição, precisão e estilo
              </span>

              <h1 className="max-w-3xl font-headline text-[2.9rem] sm:text-6xl lg:text-[4.15rem] leading-[1.02] tracking-tight text-white text-balance">
                <span className="block lg:whitespace-nowrap">Seu estilo começa com</span>
                <span className="block text-primary italic mt-2">um corte de confiança.</span>
              </h1>

              <p className="text-white/80 text-sm sm:text-base leading-relaxed max-w-xl">
                Corte, barba e cuidados masculinos com atendimento profissional, ambiente premium e horário marcado.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to={destinoAgendamento} className="text-center px-7 py-3.5 bg-primary text-on-primary rounded-full text-xs font-label font-extrabold uppercase tracking-[0.16em] hover:bg-primary-container hover:-translate-y-0.5 transition-all shadow-lg shadow-black/30">
                  Agendar horário
                </Link>
                <a href="#servicos" className="text-center px-7 py-3.5 border border-white/25 bg-black/20 text-white/80 rounded-full text-xs font-label font-bold uppercase tracking-[0.16em] hover:border-primary/60 hover:text-primary transition-colors backdrop-blur-sm">
                  Ver serviços
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 max-w-2xl">
                {[
                  ['calendar', 'Atendimento', 'Com hora marcada'],
                  ['razor', 'Especialistas', 'Corte e barba'],
                  ['crown', 'Experiência', 'Ambiente premium'],
                ].map(([icon, title, text]) => (
                  <div key={title} className="flex items-center gap-3 border-l border-primary/65 pl-3 py-1.5">
                    <BrandIcon name={icon} size={22} className="text-primary shrink-0" />
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-white font-bold">{title}</p>
                      <p className="text-xs text-white/70 mt-0.5">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="servicos" className="py-20 sm:py-24 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-12">
              <div className="space-y-3">
                <span className="text-primary text-xs font-bold uppercase tracking-[0.22em]">Nossos serviços</span>
                <h2 className="font-headline text-4xl sm:text-5xl">Cuidado à altura do seu estilo</h2>
                <p className="text-on-surface-variant text-sm max-w-xl">Escolha seu serviço, confira duração e valor e reserve o melhor horário.</p>
              </div>
              {isAuthenticated && <Link to="/servicos" className="text-xs uppercase tracking-widest text-primary hover:text-primary-container">Ver catálogo completo →</Link>}
            </div>

            {servicos.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {servicos.map((servico) => (
                  <article key={servico.idservico} className="group rounded-2xl p-6 bg-surface-container-low border border-white/5 hover:border-primary/30 hover:-translate-y-1 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <BrandIcon name="razor" size={34} className="text-primary" />
                      <span className="font-headline text-xl text-primary">{formatarPreco(servico.preco)}</span>
                    </div>
                    <h3 className="font-headline text-xl text-white">{servico.nome}</h3>
                    <p className="text-xs text-on-surface-variant mt-2 min-h-8">{servico.descricao || 'Atendimento realizado com técnica e atenção aos detalhes.'}</p>
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                      <span className="text-xs text-white/45">{servico.duracao} minutos</span>
                      <Link to={destinoAgendamento} className="text-xs font-bold uppercase tracking-widest text-primary">Agendar</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
                O catálogo de serviços será exibido assim que houver serviços cadastrados.
              </div>
            )}
          </div>
        </section>

        <section className="py-20 bg-surface-container-lowest border-y border-white/5">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-primary text-xs font-bold uppercase tracking-[0.22em]">Por que escolher</span>
              <h2 className="font-headline text-4xl sm:text-5xl mt-3">Cada detalhe importa</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {diferenciais.map((item) => (
                <article key={item.title} className="p-6 rounded-2xl border border-white/5 bg-surface/60">
                  <BrandIcon name={item.icon} size={34} className="text-primary" />
                  <h3 className="font-headline text-xl mt-5">{item.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed mt-2">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {depoimento && (
          <section className="py-20">
            <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
              <BrandIcon name="quote" size={42} className="text-primary mx-auto" />
              <blockquote className="font-headline text-3xl sm:text-4xl leading-snug mt-5">“{depoimento}”</blockquote>
              {autorDepoimento && <p className="text-xs uppercase tracking-widest text-primary mt-5">— {autorDepoimento}</p>}
            </div>
          </section>
        )}

        <section id="horarios" className="py-20 sm:py-24 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-8">
            <div className="rounded-3xl p-7 sm:p-9 bg-surface-container-low border border-white/5">
              <BrandIcon name="clock" size={34} className="text-primary" />
              <h2 className="font-headline text-3xl mt-4">Horários de funcionamento</h2>
              <div className="mt-7 space-y-3">
                {horarios.length > 0 ? horarios.map((horario) => (
                  <div key={horario.dia_semana} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 text-sm">
                    <span className="text-white/70">{nomesDias[horario.dia_semana]}</span>
                    <span className={horario.ativo ? 'text-primary' : 'text-white/35'}>
                      {horario.ativo ? `${horario.hora_abertura}–${horario.hora_fechamento}` : 'Fechado'}
                    </span>
                  </div>
                )) : <p className="text-sm text-on-surface-variant">Horários em atualização.</p>}
              </div>
            </div>

            <div className="rounded-3xl p-7 sm:p-9 bg-gradient-to-br from-primary/15 to-surface-container-low border border-primary/15 flex flex-col justify-between">
              <div>
                <BrandIcon name="location" size={34} className="text-primary" />
                <h2 className="font-headline text-3xl mt-4">Venha conhecer</h2>
                <p className="text-on-surface-variant text-sm leading-relaxed mt-3">
                  {endereco || 'Configure o endereço da barbearia para exibi-lo nesta seção.'}
                </p>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {mapaUrl && <a href={mapaUrl} target="_blank" rel="noreferrer" className="text-center px-6 py-3 border border-primary/40 text-primary rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary/10">Abrir no mapa</a>}
                <Link to={destinoAgendamento} className="text-center px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary-container">Agendar horário</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 relative overflow-hidden border-t border-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 text-center space-y-6">
            <h2 className="font-headline text-4xl sm:text-5xl">Pronto para elevar seu visual?</h2>
            <p className="text-on-surface-variant text-sm">Escolha seu serviço e reserve seu horário no O Rei da Navalha.</p>
            <Link to={destinoAgendamento} className="inline-block px-8 py-3.5 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary-container">Agende agora</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/20 py-8">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-on-surface-variant text-xs">© 2026 O Rei da Navalha. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link to="/termos" className="text-on-surface-variant text-xs hover:text-primary transition-colors">Termos</Link>
            <Link to="/privacidade" className="text-on-surface-variant text-xs hover:text-primary transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
