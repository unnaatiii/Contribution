import { getThemeForLogin } from "@/hooks/useDeveloperTheme";

export const PROFILE_TRANSITION_STORAGE_KEY = "devprofile-transition";

export type ProfileTransitionPayload = {
  x: number;
  y: number;
  w: number;
  h: number;
  login: string;
  primary: string;
};

export function writeProfileTransition(payload: ProfileTransitionPayload): void {
  try {
    sessionStorage.setItem(PROFILE_TRANSITION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** Call from any control that navigates to `/developer/[login]` for a matching expand transition. */
export function recordDeveloperProfileTransition(target: HTMLElement, login: string): void {
  const r = target.getBoundingClientRect();
  const { primary } = getThemeForLogin(login);
  writeProfileTransition({
    x: r.left,
    y: r.top,
    w: r.width,
    h: r.height,
    login,
    primary,
  });
}

export function readProfileTransition(expectedLogin: string): ProfileTransitionPayload | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_TRANSITION_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProfileTransitionPayload;
    if (p.login?.toLowerCase() !== expectedLogin.toLowerCase()) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearProfileTransition(): void {
  try {
    sessionStorage.removeItem(PROFILE_TRANSITION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Framer Motion variants for overlay expansion (card → full screen) */
export const overlayExpandVariants = {
  initial: (p: ProfileTransitionPayload) => ({
    top: p.y,
    left: p.x,
    width: p.w,
    height: p.h,
    borderRadius: 20,
    opacity: 1,
  }),
  animate: {
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    borderRadius: 0,
    opacity: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export const overlayTransition = {
  duration: 0.65,
  ease: [0.4, 0, 0.2, 1] as const,
};

/** Section scroll-in */
export const sectionReveal = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

export const pageContentReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const, delay: 0.15 },
  },
};

export const pageExit = {
  opacity: 0,
  y: 16,
  transition: { duration: 0.35, ease: [0.4, 0, 1, 1] as const },
};
