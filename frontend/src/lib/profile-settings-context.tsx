import { createContext, useContext, useEffect, useState } from "react";

export type ProfileSettings = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
};

export const PROFILE_SETTINGS_KEY = "pimis-profile-settings";

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  fullName: "Dr. Andi",
  email: "andi.wijaya@apotechary.go.id",
  phone: "+62 812 3456 7890",
  role: "Head Pharmacist",
};

export function readProfileSettings(): ProfileSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_SETTINGS_KEY);
    if (!raw) return DEFAULT_PROFILE_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      ...DEFAULT_PROFILE_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_PROFILE_SETTINGS;
  }
}

type ProfileSettingsContextValue = {
  profile: ProfileSettings;
  setProfile: React.Dispatch<React.SetStateAction<ProfileSettings>>;
};

const ProfileSettingsContext = createContext<ProfileSettingsContextValue | null>(null);

export function ProfileSettingsProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setProfile(readProfileSettings());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) return;
    window.localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(profile));
  }, [hasHydrated, profile]);

  return (
    <ProfileSettingsContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileSettingsContext.Provider>
  );
}

export function useProfileSettings() {
  const context = useContext(ProfileSettingsContext);
  if (!context) {
    return {
      profile: DEFAULT_PROFILE_SETTINGS,
      setProfile: (() => undefined) as React.Dispatch<React.SetStateAction<ProfileSettings>>,
    };
  }

  return context;
}
