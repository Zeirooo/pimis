import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  username: string;
  fullName: string;
  role: string;
};

export type SessionDevice = {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isBootstrapping: boolean;
  isSigningIn: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
  sessions: SessionDevice[];
};

const AUTH_STORAGE_KEY = "pimis-auth-session";
const AUTH_SESSIONS_KEY = "pimis-auth-sessions";
const AUTH_CURRENT_SESSION_KEY = "pimis-auth-current-session";

const SEEDED_MANAGER = {
  username: "manager",
  password: "manager123",
  fullName: "Dr. Andi Wijaya",
  role: "Manager Instalasi",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function detectBrowserName(): string {
  if (typeof navigator === "undefined") return "Browser";

  const userAgent = navigator.userAgent;
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg") && !userAgent.includes("OPR"))
    return "Chrome";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  return "Browser";
}

function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "Desktop";

  const platform = navigator.platform.toLowerCase();
  if (platform.includes("iphone")) return "iPhone";
  if (platform.includes("ipad")) return "iPad";
  if (platform.includes("android")) return "Android";
  if (platform.includes("mac")) return "Mac";
  if (platform.includes("win")) return "Windows";
  if (platform.includes("linux")) return "Linux";
  return /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
}

function detectLocationLabel(): string {
  if (typeof Intl === "undefined") return "Unknown";

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone === "Asia/Jakarta") return "Jakarta";
  if (timeZone === "Asia/Makassar") return "Makassar";
  if (timeZone === "Asia/Jayapura") return "Jayapura";
  return timeZone?.replace(/_/g, " ") || "Unknown";
}

function readSessions(): SessionDevice[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(AUTH_SESSIONS_KEY);
    if (!raw) return [];

    return JSON.parse(raw) as SessionDevice[];
  } catch {
    return [];
  }
}

function writeSessions(sessions: SessionDevice[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUTH_SESSIONS_KEY, JSON.stringify(sessions));
}

function upsertCurrentSession(user: AuthUser | null) {
  if (typeof window === "undefined") return [] as SessionDevice[];

  const now = new Date().toISOString();
  const currentSessionId =
    window.localStorage.getItem(AUTH_CURRENT_SESSION_KEY) ?? createSessionId();

  if (!window.localStorage.getItem(AUTH_CURRENT_SESSION_KEY)) {
    window.localStorage.setItem(AUTH_CURRENT_SESSION_KEY, currentSessionId);
  }

  const currentSession: SessionDevice = {
    id: currentSessionId,
    device: detectDeviceName(),
    browser: detectBrowserName(),
    location: detectLocationLabel(),
    lastActiveAt: now,
    isCurrent: true,
  };

  const otherSessions = readSessions().filter((session) => session.id !== currentSessionId);
  const nextSessions = user
    ? [currentSession, ...otherSessions.map((session) => ({ ...session, isCurrent: false }))]
    : otherSessions.map((session) => ({ ...session, isCurrent: false }));

  writeSessions(nextSessions);
  return nextSessions;
}

function touchCurrentSession() {
  if (typeof window === "undefined") return;

  const currentSessionId = window.localStorage.getItem(AUTH_CURRENT_SESSION_KEY);
  if (!currentSessionId) return;

  const nextSessions = readSessions().map((session) =>
    session.id === currentSessionId
      ? { ...session, lastActiveAt: new Date().toISOString(), isCurrent: true }
      : { ...session, isCurrent: false },
  );

  writeSessions(nextSessions);
}

function readStoredSession(): AuthUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.username || !parsed.fullName || !parsed.role) return null;

    return {
      username: parsed.username,
      fullName: parsed.fullName,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [sessions, setSessions] = useState<SessionDevice[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextUser = readStoredSession();
      setUser(nextUser);
      setSessions(upsertCurrentSession(nextUser));
      setIsBootstrapping(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      touchCurrentSession();
      setSessions(readSessions());
    };

    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("focus", handleActivity);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("focus", handleActivity);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      isSigningIn,
      sessions,
      login: async (username: string, password: string) => {
        const normalizedUsername = username.trim().toLowerCase();

        setIsSigningIn(true);
        await new Promise((resolve) => window.setTimeout(resolve, 1100));

        const validCredentials =
          normalizedUsername === SEEDED_MANAGER.username && password === SEEDED_MANAGER.password;

        if (!validCredentials) {
          setIsSigningIn(false);
          return { ok: false as const, message: "Invalid username or password." };
        }

        const nextUser: AuthUser = {
          username: SEEDED_MANAGER.username,
          fullName: SEEDED_MANAGER.fullName,
          role: SEEDED_MANAGER.role,
        };

        setUser(nextUser);
        writeStoredSession(nextUser);
        setSessions(upsertCurrentSession(nextUser));
        setIsSigningIn(false);

        return { ok: true as const };
      },
      logout: () => {
        setUser(null);
        writeStoredSession(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(AUTH_CURRENT_SESSION_KEY);
          const nextSessions = readSessions().map((session) => ({
            ...session,
            isCurrent: false,
          }));
          writeSessions(nextSessions);
          setSessions(nextSessions);
        }
      },
    }),
    [isBootstrapping, isSigningIn, sessions, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export const DEV_LOGIN_CREDENTIALS = {
  username: SEEDED_MANAGER.username,
  password: SEEDED_MANAGER.password,
};

export function formatSessionLastActive(isoTimestamp: string) {
  const lastActive = new Date(isoTimestamp);
  const now = new Date();
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
