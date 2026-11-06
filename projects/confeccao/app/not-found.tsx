import Link from "next/link";
export default function NotFound() { return <main className="empty" style={{ paddingTop: "22vh" }}><span>MP</span><h3>Esse caminho ainda não faz parte da coleção.</h3><p>Volte para a visão geral da sua confecção.</p><Link className="button primary" href="/dashboard">Abrir painel</Link></main>; }
