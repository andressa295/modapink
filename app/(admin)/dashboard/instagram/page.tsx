import {
  Instagram,
  MessageCircle,
  Bot,
  Inbox,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Clock,
  Lock
} from "lucide-react"

import styles from "./instagram.module.css"

export default function InstagramPage() {
  const features = [
    {
      icon: Inbox,
      title: "Solicitações de conversa",
      description:
        "Área preparada para futuramente ler e organizar mensagens que chegam como solicitação no Instagram."
    },
    {
      icon: MessageCircle,
      title: "Conversas do Direct",
      description:
        "Visualização centralizada das conversas do Instagram dentro do painel, semelhante ao WhatsApp."
    },
    {
      icon: Bot,
      title: "Respostas automáticas",
      description:
        "Base para criar menu automático, mensagens iniciais, dúvidas frequentes e fluxos de atendimento."
    },
    {
      icon: ShoppingBag,
      title: "Venda pelo Instagram",
      description:
        "Estrutura pensada para futuramente ajudar a cliente a escolher peças e avançar para compra."
    }
  ]

  const steps = [
    "Conectar conta profissional do Instagram",
    "Validar permissões da Meta",
    "Configurar mensagens e menu inicial",
    "Testar leitura de conversas e solicitações",
    "Ativar atendimento assistido no painel"
  ]

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            Integração adicional
          </span>

          <h1>
            Instagram Direct
          </h1>

          <p>
            Área preparada para a futura integração com o Instagram da loja.
            Essa função poderá centralizar mensagens, solicitações de conversa,
            respostas automáticas e atendimentos vindos do Direct.
          </p>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.primaryButton}
            >
              Solicitar instalação
            </button>

            <span className={styles.statusBadge}>
              <Lock size={14} />
              Não contratado
            </span>
          </div>
        </div>

        <div className={styles.phonePreview}>
          <div className={styles.phoneHeader}>
            <div className={styles.instagramIcon}>
              <Instagram size={24} />
            </div>

            <div>
              <strong>
                Instagram
              </strong>

              <span>
                Direct da loja
              </span>
            </div>
          </div>

          <div className={styles.chatPreview}>
            <div className={styles.messageLeft}>
              Oi, vocês vendem atacado?
            </div>

            <div className={styles.messageRight}>
              Oi, amiga 💗 Trabalhamos com atacado sim!
            </div>

            <div className={styles.messageLeft}>
              Tem pedido mínimo?
            </div>

            <div className={styles.messageRight}>
              Sim! Posso te mostrar as informações de compra.
            </div>
          </div>

          <div className={styles.previewFooter}>
            <Sparkles size={15} />
            Atendimento automático preparado
          </div>
        </div>
      </div>

      <div className={styles.noticeCard}>
        <div className={styles.noticeIcon}>
          <ShieldCheck size={22} />
        </div>

        <div>
          <h2>
            Módulo disponível sob contratação
          </h2>

          <p>
            A integração com Instagram não faz parte da instalação atual.
            Ela pode ser implementada como funcionalidade adicional, com
            configuração própria, testes e orçamento separado.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {features.map((feature) => {
          const Icon =
            feature.icon

          return (
            <div
              key={feature.title}
              className={styles.featureCard}
            >
              <div className={styles.featureIcon}>
                <Icon size={22} />
              </div>

              <h3>
                {feature.title}
              </h3>

              <p>
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <span>
              Planejamento
            </span>

            <h2>
              Como essa instalação funcionaria
            </h2>

            <p>
              A estrutura visual já está preparada no painel. Para ativar,
              será necessário contratar a implementação e conectar a conta
              profissional da loja.
            </p>
          </div>

          <div className={styles.steps}>
            {steps.map((step, index) => (
              <div
                key={step}
                className={styles.stepItem}
              >
                <span>
                  {index + 1}
                </span>

                <p>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panelCard}>
          <div className={styles.cardHeader}>
            <span>
              Status
            </span>

            <h2>
              Ainda não instalado
            </h2>

            <p>
              Esse módulo está reservado para expansão do sistema. Quando a
              loja contratar, essa área poderá mostrar conversas, solicitações,
              automações e histórico do Instagram.
            </p>
          </div>

          <div className={styles.statusList}>
            <div>
              <Clock size={18} />
              <span>
                Aguardando contratação
              </span>
            </div>

            <div>
              <Lock size={18} />
              <span>
                Integração bloqueada
              </span>
            </div>

            <div>
              <Instagram size={18} />
              <span>
                Conta do Instagram ainda não conectada
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}