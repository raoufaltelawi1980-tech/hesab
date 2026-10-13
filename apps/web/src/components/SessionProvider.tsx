"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onUnauthorized } from "@/lib/api";
import { clearSession, readToken } from "@/lib/api-client";

type SessionContextValue = {
  token: string | null;
  ready: boolean;
  setToken: (token: string | null) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // localStorage is unavailable during SSR, so the session hydrates on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration after SSR
    setTokenState(readToken());
    setReady(true);
  }, []);

  const setToken = useCallback((next: string | null) => {
    setTokenState(next);
    if (next === null) clearSession();
    else window.localStorage.setItem("hesab.token", next);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setTokenState(null);
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      setTokenState(null);
      clearSession();
    });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ token, ready, setToken, signOut }),
    [token, ready, setToken, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}