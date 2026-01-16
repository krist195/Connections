export {};

declare global {
  interface Window {
    api: {
      openFile: () => Promise<{ path: string; data: string } | null>;
      saveFileAs: (data: string) => Promise<string | null>;
      saveFile: (path: string, data: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}
