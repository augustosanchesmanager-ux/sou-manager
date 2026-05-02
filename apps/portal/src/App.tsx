import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Headphones,
  Mail,
  MessageCircle,
  Quote,
  ShieldCheck,
} from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5511982073536';
const CONTACT_EMAIL = 'contato@soumanager.com';
const BARBER_URL = 'https://barber.soumanager.com';

const solutions = [
  {
    name: 'SMG Barber',
    description: 'Agenda, PDV, equipe, financeiro, recorrencia e operacao diaria para barbearias.',
    status: 'Disponivel',
  },
  {
    name: 'SMG AutoControl',
    description: 'Gestao operacional para negocios automotivos e rotinas de atendimento.',
    status: 'Em preparacao',
  },
  {
    name: 'SMG Club',
    description: 'Assinaturas, beneficios e relacionamento continuo para clubes e memberships.',
    status: 'Em preparacao',
  },
];

function App() {
  const handlePortalLogin = () => {
    window.location.assign(BARBER_URL);
  };

  return (
    <main className="page-shell">
      <header className="site-header" aria-label="Navegacao principal">
        <a className="brand" href="#home" aria-label="Sou Manager home">
          <span className="brand-mark">SMG</span>
          <span>
            <strong>Sou Manager</strong>
            <small>Portal institucional</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="Secoes">
          <a href="#solucoes">Solucoes</a>
          <a href="#acesso">Login</a>
          <a href="#contato">Contato</a>
        </nav>
      </header>

      <section id="home" className="hero">
        <div className="hero-copy">
          <span className="eyebrow">SMG - Sou Manager</span>
          <h1>Entrada central para os produtos que movem sua operacao.</h1>
          <p>
            Um portal institucional simples para conhecer a plataforma, falar com o time e acessar o app
            contratado com clareza.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={handlePortalLogin}>
              Login do cliente
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="secondary-action" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              <MessageCircle size={18} aria-hidden="true" />
              WhatsApp
            </a>
            <a className="text-action" href="#cotacao">
              Solicitar cotacao
            </a>
          </div>
        </div>

        <aside className="access-panel" id="acesso" aria-label="Acesso aos apps">
          <ShieldCheck size={32} aria-hidden="true" />
          <h2>Login central em preparacao</h2>
          <p>
            Neste PR o portal ainda nao autentica usuarios. O proximo passo sera identificar o contrato
            ativo e redirecionar para o app correto.
          </p>
          <button type="button" onClick={handlePortalLogin}>
            Acessar SMG Barber
          </button>
        </aside>
      </section>

      <section className="section-grid" id="solucoes">
        <div className="section-heading">
          <span className="eyebrow">Solucoes</span>
          <h2>Apps separados, marca centralizada.</h2>
          <p>
            O dominio principal apresenta a Sou Manager. Os produtos operacionais vivem em subdominios
            dedicados, como barber.soumanager.com.
          </p>
        </div>

        <div className="solution-grid">
          {solutions.map((solution) => (
            <article className="solution-card" key={solution.name}>
              <div className="card-icon">
                <Building2 size={22} aria-hidden="true" />
              </div>
              <div>
                <span>{solution.status}</span>
                <h3>{solution.name}</h3>
                <p>{solution.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="redirect-band">
        <CalendarCheck size={34} aria-hidden="true" />
        <div>
          <h2>Depois do login, cada usuario vai para o app contratado.</h2>
          <p>
            Exemplo: clientes do SMG Barber serao direcionados para barber.soumanager.com. Essa
            autenticacao central sera implementada em etapa futura.
          </p>
        </div>
      </section>

      <section className="contact-section" id="contato">
        <div>
          <span className="eyebrow">Contato</span>
          <h2>Fale com a Sou Manager</h2>
          <p>
            Tire duvidas, solicite suporte ou peca uma cotacao para entender qual app combina com sua
            operacao.
          </p>
        </div>

        <div className="contact-actions" id="cotacao">
          <a href={`mailto:${CONTACT_EMAIL}?subject=Cotacao%20Sou%20Manager`}>
            <Quote size={18} aria-hidden="true" />
            Cotacao
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            WhatsApp
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Suporte%20Sou%20Manager`}>
            <Headphones size={18} aria-hidden="true" />
            Suporte
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`}>
            <Mail size={18} aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;
