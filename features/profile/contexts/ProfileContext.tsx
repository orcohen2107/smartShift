'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api/apiFetch';
import type { Profile } from '@/lib/utils/interfaces';

type ProfileContextValue = {
  profile: Profile | null;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    apiFetch<{ profile: Profile }>('/api/profile/me')
      .then((data) => setProfile(data.profile))
      .catch(async () => {
        try {
          await apiFetch<{ profile: Profile }>('/api/profile/ensure', {
            method: 'POST',
          });
          const data = await apiFetch<{ profile: Profile }>('/api/profile/me');
          setProfile(data.profile);
        } catch {
          setProfile(null);
        }
      });
  }, []);

  const value: ProfileContextValue = { profile };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): Profile | null {
  const ctx = useContext(ProfileContext);
  return ctx?.profile ?? null;
}
