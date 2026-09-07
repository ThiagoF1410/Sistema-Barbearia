import { Link } from 'react-router-dom'
import BrandIcon from '../components/ui/BrandIcon'

export default function TermsPage() {
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

        <h1 className="font-headline text-3xl mb-8">Termos de Uso</h1>

        <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">1. Aceitação dos Termos</h2>
            <p>Ao utilizar os serviços da barbearia O Rei da Navalha, você concorda com os termos e condições aqui descritos. Caso não concorde, não utilize nossos serviços.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">2. Serviços</h2>
            <p>O Rei da Navalha oferece agendamento online de serviços de barbearia. Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto dos serviços a qualquer momento.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">3. Cadastro e Conta</h2>
            <p>Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">4. Cancelamentos</h2>
            <p>Cancelamentos devem ser feitos com no mínimo 2 horas de antecedência. Cancelamentos tardios estão sujeitos a penalidades.</p>
          </section>

          <section>
            <h2 className="font-label font-bold text-on-surface text-base mb-2">5. Privacidade</h2>
            <p>Seus dados pessoais são tratados conforme descrito em nossa Política de Privacidade. Ao usar nossos serviços, você consente com a coleta e uso de suas informações.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
