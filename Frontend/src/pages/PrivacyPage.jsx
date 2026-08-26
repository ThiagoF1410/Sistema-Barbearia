import { Link } from 'react-router-dom'
import BrandIcon from '../components/ui/BrandIcon'

export default function PrivacyPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/cadastro"
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors mb-8"
        >
          <BrandIcon name="back" size={18} />
          Voltar ao cadastro
        </Link>

        <h1 className="font-headline text-3xl mb-8">Política de Privacidade</h1>

        <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">1. Dados Coletados</h2>
            <p>Coletamos nome, e-mail, telefone e histórico de agendamentos para oferecer nossos serviços de forma personalizada.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">2. Uso dos Dados</h2>
            <p>Utilizamos seus dados para processar agendamentos, enviar lembretes e melhorar nossos serviços. Não compartilhamos suas informações com terceiros sem seu consentimento.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">3. Armazenamento</h2>
            <p>Seus dados são armazenados de forma segura em servidores protegidos. Mantemos suas informações apenas pelo tempo necessário para prestar os serviços.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">4. Seus Direitos</h2>
            <p>Você pode solicitar a exclusão, correção ou exportação de seus dados a qualquer momento entrando em contato conosco.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">5. Cookies</h2>
            <p>Utilizamos cookies essenciais para o funcionamento da plataforma. Você pode configurar seu navegador para recusá-los, mas isso pode afetar a experiência.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
