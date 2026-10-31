import { Shell } from "../../components/shell";
import { Suspense } from "react";
export default function Layout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<div className="loading-state">Preparando sua confecção…</div>}><Shell>{children}</Shell></Suspense>; }
