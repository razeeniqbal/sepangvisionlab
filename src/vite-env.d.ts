/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Starting session on a static host: "recorded" or "synthetic" (default historical). */
  readonly VITE_DEFAULT_SESSION?: string;
}
