import Link from "next/link"
import { ArrowUpRight, Bot, Settings2, Store, Users } from "lucide-react"
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"
import styles from "./configuracoes.module.css"

export default function ConfiguracoesPage() {
  const settings = [
    {
      title: "Dados da loja",
      description: "Nome, site, pedido mínimo, SAC, Instagram, Grupo VIP e links principais.",
      link: "/dashboard/configuracoes/dados-loja",
      tag: "Base da loja",
      icon: Store,
    },
    {
      title: "Textos do bot",
      description: "Edite respostas sobre catálogo, pagamento, envio, atacado, trocas e reposição.",
      link: "/dashboard/configuracoes/textos-bot",
      tag: "Respostas automáticas",
      icon: Bot,
    },
    {
      title: "Atendimento e retirada",
      description: "Configure horários, loja física, retirada na sede, endereço e funcionamento do SAC.",
      link: "/dashboard/configuracoes/atendimento",
      tag: "Operação",
      icon: WhatsAppIcon,
    },
    {
      title: "Usuários",
      description: "Gerencie acessos da equipe, permissões, atendentes e administradores.",
      link: "/dashboard/usuarios",
      tag: "Equipe",
      icon: Users,
    },
  ]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>PREFERÊNCIAS DA LOJA</span>
        <h1 className={styles.headerTitle}>Configurações</h1>
        <p className={styles.headerDescription}>
          Personalize os dados da loja, textos do bot, horários de atendimento e acessos da equipe.
        </p>
      </header>

      <nav className={styles.grid} aria-label="Áreas de configuração">
        {settings.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.link} href={item.link} className={styles.card}>
              <span className={styles.cardIcon}><Icon size={20} aria-hidden="true" /></span>
              <div className={styles.cardContent}>
                <span className={styles.cardTag}>{item.tag}</span>
                <h2 className={styles.cardTitle}>{item.title}</h2>
                <p className={styles.cardDescription}>{item.description}</p>
                <span className={styles.cardAction}>Configurar <ArrowUpRight size={14} aria-hidden="true" /></span>
              </div>
              <ArrowUpRight size={18} className={styles.arrow} aria-hidden="true" />
            </Link>
          )
        })}
      </nav>

      <div className={styles.note}>
        <Settings2 size={17} aria-hidden="true" />
        <p>As alterações entram em uso depois de salvar em cada seção.</p>
      </div>
    </div>
  )
}
