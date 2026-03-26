'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/db/supabaseBrowser';
import { apiFetch } from '@/lib/api/apiFetch';
import type { Profile } from '@/lib/utils/interfaces';

type ProfileContextValue = {
  profile: Profile | null;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function useAuthEvent() {
  const authCallbackRef = useRef<((event: string) => void) | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      authCallbackRef.current?.(event);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return authCallbackRef;
}

async function fetchProfile(): Promise<Profile | null> {
  try {
    const data = await apiFetch<{ profile: Profile }>('/api/profile/me');
    return data.profile;
  } catch {
    try {
      await apiFetch<{ profile: Profile }>('/api/profile/ensure', {
        method: 'POST',
      });
      const data = await apiFetch<{ profile: Profile }>('/api/profile/me');
      return data.profile;
    } catch {
      return null;
    }
  }
}

let cachedProfile: Profile | null = null;
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Profile | null {
  return cachedProfile;
}

function setProfileExternal(p: Profile | null) {
  cachedProfile = p;
  for (const l of listeners) l();
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const authCallbackRef = useAuthEvent();

  useEffect(() => {
    void fetchProfile().then(setProfileExternal);
  }, []);

  useEffect(() => {
    authCallbackRef.current = (event: string) => {
      if (event === 'SIGNED_OUT') {
        setProfileExternal(null);
        router.replace('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        void fetchProfile().then(setProfileExternal);
      }
    };
  }, [authCallbackRef, router]);

  const value: ProfileContextValue = { profile };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): Profile | null {
  const ctx = useContext(ProfileContext);
  return ctx?.profile ?? null;
}
