import Electrobun, { Electroview } from "electrobun/view";

import type { LineaRPC } from "@linea/shared";

const rpc = Electroview.defineRPC<LineaRPC>({
  maxRequestTime: 15_000,
  handlers: {
    requests: {},
    messages: {},
  },
});

function createElectrobun() {
  return new Electrobun.Electroview({ rpc });
}

let electrobun: ReturnType<typeof createElectrobun> | null = null;

export function getElectrobun() {
  if (!hasElectrobunRuntime()) {
    return null;
  }

  if (!electrobun) {
    electrobun = createElectrobun();
  }

  return electrobun;
}

function hasElectrobunRuntime() {
  const browserWindow = globalThis as typeof globalThis &
    Window & {
      __electrobun?: object;
      __electrobunBunBridge?: {
        postMessage?: (message: string) => void;
      };
      __electrobunRpcSocketPort?: number;
      __electrobunWebviewId?: number;
      __electrobun_decrypt?: (
        data: string,
        iv: string,
        tag: string
      ) => Promise<string>;
      __electrobun_encrypt?: (data: string) => Promise<{
        encryptedData: string;
        iv: string;
        tag: string;
      }>;
    };

  return (
    typeof browserWindow.__electrobunWebviewId === "number" &&
    Number.isFinite(browserWindow.__electrobunWebviewId) &&
    typeof browserWindow.__electrobunRpcSocketPort === "number" &&
    Number.isFinite(browserWindow.__electrobunRpcSocketPort) &&
    typeof browserWindow.__electrobun_encrypt === "function" &&
    typeof browserWindow.__electrobun_decrypt === "function" &&
    typeof browserWindow.__electrobunBunBridge?.postMessage === "function" &&
    typeof browserWindow.__electrobun === "object"
  );
}
