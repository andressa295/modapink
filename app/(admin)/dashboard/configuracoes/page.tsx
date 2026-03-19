import Link from "next/link";
import styles from "./configuracoes.module.css";

export default function ConfiguracoesPage() {
  const settings = [
    {
      title: "Automações",
      description: "Bots, respostas automáticas e fluxos de atendimento.",
      link: "/dashboard/configuracoes/automacoes",
    },
    {
      title: "Integrações",
      description: "Conecte WhatsApp, APIs e serviços externos.",
      link: "/dashboard/configuracoes/integracoes",
    },
    {
      title: "Usuários",
      description: "Gerencie membros da equipe e permissões.",
      link: "/dashboard/configuracoes/usuarios",
    },
    {
      title: "Notificações",
      description: "Configure alertas por email, WhatsApp e sistema.",
      link: "/dashboard/configuracoes/notificacoes",
    },
    {
      title: "API",
      description: "Gerencie chaves e integrações da plataforma.",
      link: "/dashboard/configuracoes/api",
    },
    {
      title: "Segurança",
      description: "Proteção da conta e controle de acessos.",
      link: "/dashboard/configuracoes/seguranca",
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Configurações</h1>
        <p>
          Gerencie automações, integrações, usuários e todas as configurações
          da plataforma.
        </p>
      </div>

      <div className={styles.grid}>
        {settings.map((item, index) => (
          <Link key={index} href={item.link} className={styles.card}>
            <div className={styles.cardContent}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>

            <span className={styles.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}