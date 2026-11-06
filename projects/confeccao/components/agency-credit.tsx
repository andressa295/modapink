import "./agency-credit.css";

export function AgencyCredit({ onDark = false, label = "Desenvolvido por" }: { onDark?: boolean; label?: string }) {
  return <span className={`agency-credit${onDark ? " agency-credit--on-dark" : ""}`}><span className="agency-credit-label">{label}</span><a href="https://www.phand.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Conheça o portfólio da Phand Studio" title="Conheça o portfólio da Phand Studio"><img src="/phand-logo.png" width={112} height={22} alt="Phand Studio" /></a></span>;
}
