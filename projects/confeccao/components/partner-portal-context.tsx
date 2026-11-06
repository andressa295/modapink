"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth-context";
import { getOwnerPortalState, type OwnerPortalState } from "../lib/partner-portal";

interface PartnerPortalContextValue {
  state: OwnerPortalState | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refreshedAt: Date | null;
  refresh: () => Promise<void>;
  replace: (state: OwnerPortalState) => void;
}
const PartnerPortalContext = createContext<PartnerPortalContextValue | null>(null);
// Access tokens belong only to the one-time share dialog, never the shared snapshot.
function snapshotOnly(value: OwnerPortalState): OwnerPortalState {
  const snapshot = { ...value };
  delete snapshot.createdLink;
  return snapshot;
}
export function PartnerPortalProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [state, setState] = useState<OwnerPortalState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const version = useRef(0);
  const mounted = useRef(false);
  const inFlight = useRef<{ id: symbol; promise: Promise<void> } | null>(null);
  const replace = useCallback((value: OwnerPortalState) => {
    version.current++;
    setState(snapshotOnly(value)); setError(""); setRefreshedAt(new Date());
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current.promise;
    const requestVersion = version.current;
    const requestId = Symbol();
    setRefreshing(true);
    const request = (async () => {
      try {
        const value = await getOwnerPortalState();
        if (mounted.current && requestVersion === version.current) {
          setState(snapshotOnly(value)); setError(""); setRefreshedAt(new Date());
        }
      } catch (cause) {
        if (mounted.current && requestVersion === version.current) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as confecções. Tente novamente.");
      } finally {
        if (inFlight.current?.id === requestId) { inFlight.current = null; if (mounted.current) setRefreshing(false); }
      }
    })();
    inFlight.current = { id: requestId, promise: request };
    return request;
  }, []);
  useEffect(() => {
    mounted.current = true;
    version.current++;
    setState(null); setError(""); setRefreshedAt(null); inFlight.current = null;
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(visibleRefresh, 15_000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("focus", visibleRefresh);
    return () => {
      mounted.current = false; version.current++; inFlight.current = null;
      window.clearInterval(timer); document.removeEventListener("visibilitychange", visibleRefresh); window.removeEventListener("focus", visibleRefresh);
    };
  }, [profile.id, refresh]);
  const value = useMemo(() => ({ state, loading: !state && !error, refreshing, error, refreshedAt, refresh, replace }), [state, refreshing, error, refreshedAt, refresh, replace]);
  return <PartnerPortalContext.Provider value={value}>{children}</PartnerPortalContext.Provider>;
}
export function usePartnerPortal() {
  const value = useContext(PartnerPortalContext);
  if (!value) throw new Error("O portal precisa estar dentro da área autenticada.");
  return value;
}
