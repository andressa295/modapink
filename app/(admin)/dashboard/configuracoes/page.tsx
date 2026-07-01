import Link from "next/link";
import styles from "./configuracoes.module.css";

export default function ConfiguracoesPage() {
  const settings = [
    {
      title: "Dados da loja",
      description:
        "Nome, site, pedido mínimo, SAC, Instagram, Grupo VIP e links principais.",
      link: "/dashboard/configuracoes/dados-loja",
      tag: "Base",
    },
    {
      title: "Textos do bot",
      description:
        "Edite respostas sobre catálogo, pagamento, envio, atacado, trocas e reposição.",
      link: "/dashboard/configuracoes/textos-bot",
      tag: "Bot",
    },
    {
      title: "Atendimento e retirada",
      description:
        "Configure horários, loja física, retirada na sede, endereço e funcionamento do SAC.",
      link: "/dashboard/configuracoes/atendimento",
      tag: "Operação",
    },
    {
      title: "Automações",
      description:
        "Ative e ajuste carrinho abandonado, pedido aprovado, avaliações e mensagens automáticas.",
      link: "/dashboard/configuracoes/automacoes",
      tag: "Automação",
    },
    {
      title: "Integrações",
      description:
        "Gerencie WhatsApp, Nuvemshop, IA e serviços externos conectados ao sistema.",
      link: "/dashboard/configuracoes/integracoes",
      tag: "API",
    },
    {
      title: "Aparência",
      description:
        "Personalize logo, nome da loja, cores do painel e identidade visual do sistema.",
      link: "/dashboard/configuracoes/aparencia",
      tag: "Visual",
    },
    {
      title: "Usuários",
      description:
        "Gerencie acessos da equipe, permissões, atendentes e administradores.",
      link: "/dashboard/configuracoes/usuarios",
      tag: "Equipe",
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          Central do sistema
        </span>

        <h1 className={styles.headerTitle}>
          Configurações
        </h1>

        <p className={styles.headerDescription}>
          Personalize os dados da loja, textos do bot, horários,
          automações, integrações e aparência do painel.
        </p>
      </div>

      <div className={styles.grid}>
        {settings.map((item) => (
          <Link
            key={item.link}
            href={item.link}
            className={styles.card}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>
                  {item.title}
                </h3>

                <span className={styles.cardTag}>
                  {item.tag}
                </span>
              </div>

              <p className={styles.cardDescription}>
                {item.description}
              </p>
            </div>

            <span className={styles.arrow}>
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}