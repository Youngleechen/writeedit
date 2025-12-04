// types/global.d.ts
export {};

declare global {
  interface Window {
    refreshAuthButton?: () => void;
  }
}