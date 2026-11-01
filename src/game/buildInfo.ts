// Build identity (W12 F212/F222). Vite fills these in at build time; tests and tools see "dev".
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'undefined' ? '0.0.0-dev' : __APP_VERSION__;
export const BUILD_ID: string = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__;
