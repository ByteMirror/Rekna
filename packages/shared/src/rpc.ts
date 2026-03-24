import type { RPCSchema } from "electrobun/bun";

type EmptyPayload = Record<string, never>;

export type SheetRecord = {
  id: string;
  filePath: string;
  title: string;
  body: string;
  plainText: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type SearchResult = {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  updatedAt: string;
};

export type DesktopSettings = {
  keepRunningAfterWindowClose: boolean;
  launchOnLogin: boolean;
};

export type WorkspaceSelection = {
  name: string;
  path: string;
};

export type CompletionOverlayFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CompletionOverlayInfo = {
  title: string;
  body: string;
  detail?: string;
};

export type CompletionOverlayItem = {
  label: string;
  detail?: string;
  type?: string;
};

export type CompletionOverlayInfoSide = "bottom" | "left" | "right";
export type CompletionOverlayPlacement = "above" | "below";

export type CompletionOverlayRenderState = {
  visible: boolean;
  theme: "dark" | "light";
  items: CompletionOverlayItem[];
  selectedIndex: number;
  info: CompletionOverlayInfo | null;
  listWidth: number;
  placement?: CompletionOverlayPlacement;
  infoSide: CompletionOverlayInfoSide;
  infoWidth: number | null;
};

export type CompletionOverlayUpdate = CompletionOverlayRenderState & {
  frame: CompletionOverlayFrame | null;
};

export type DesktopWindowContext = {
  mode: "completion-overlay" | "main";
  nativeCompletionOverlayEnabled: boolean;
};

export type LineaRPC = {
  bun: RPCSchema<{
    requests: {
      bootstrap: {
        params: EmptyPayload;
        response: {
          sheets: SheetRecord[];
          activeSheet: SheetRecord;
        };
      };
      getDesktopSettings: {
        params: EmptyPayload;
        response: DesktopSettings;
      };
      getWorkspaceSelection: {
        params: EmptyPayload;
        response: WorkspaceSelection | null;
      };
      updateDesktopSettings: {
        params: DesktopSettings;
        response: DesktopSettings;
      };
      createSheet: {
        params: { title?: string };
        response: SheetRecord;
      };
      deleteSheet: {
        params: { id: string };
        response: { id: string };
      };
      markSheetOpened: {
        params: { id: string };
        response: SheetRecord;
      };
      renameSheet: {
        params: { id: string; title: string };
        response: SheetRecord;
      };
      updateSheet: {
        params: {
          id: string;
          body: string;
          title?: string;
        };
        response: SheetRecord;
      };
      listSheets: {
        params: EmptyPayload;
        response: SheetRecord[];
      };
      searchSheets: {
        params: { query: string; tags?: string[] };
        response: SearchResult[];
      };
      openWorkspaceFolder: {
        params: EmptyPayload;
        response: WorkspaceSelection | null;
      };
      getWindowContext: {
        params: EmptyPayload;
        response: DesktopWindowContext;
      };
    };
    messages: {
      updateCompletionOverlay: CompletionOverlayUpdate;
      completionOverlayReady: void;
    };
  }>;
  webview: RPCSchema<{
    requests: EmptyPayload;
    messages: {
      renderCompletionOverlay: CompletionOverlayRenderState;
    };
  }>;
};
