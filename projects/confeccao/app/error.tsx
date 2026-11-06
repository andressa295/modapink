"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="empty"><h3>Não foi possível abrir esta tela.</h3><p>Tente novamente. Seus registros demonstrativos continuam neste navegador.</p><button className="button primary" onClick={reset}>Tentar novamente</button></div>; }
