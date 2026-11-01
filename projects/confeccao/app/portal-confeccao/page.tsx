import type { Metadata } from "next";
import PartnerPortal from "./portal-client";
export const metadata: Metadata = { title: "Portal da Confecção · Moda Pink", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <PartnerPortal />; }
