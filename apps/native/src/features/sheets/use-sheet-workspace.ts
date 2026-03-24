import {
  bootstrapWorkspace,
  createSheet as createWorkspaceSheet,
  deleteSheet as deleteWorkspaceSheet,
  getActiveSheet,
  renameSheet as renameWorkspaceSheet,
  searchSheets as searchWorkspaceSheets,
  setActiveSheet as setWorkspaceActiveSheet,
  type AppWorkspace,
  updateSheetBody as updateWorkspaceSheetBody,
} from "@linea/app-core";
import { useEffect, useState } from "react";

import {
  loadPersistedWorkspaceSnapshot,
  nativeWorkspacePersistenceIO,
  saveWorkspaceSnapshot,
} from "./workspace-store.native";

export function useSheetWorkspace() {
  const [workspace, setWorkspace] = useState<AppWorkspace | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadStoredWorkspace();

    return () => {
      cancelled = true;
    };

    async function loadStoredWorkspace() {
      try {
        const parsed = await loadPersistedWorkspaceSnapshot(
          nativeWorkspacePersistenceIO
        );
        const bootstrapped = bootstrapWorkspace(parsed);

        if (!cancelled) {
          setWorkspace(bootstrapped.workspace);
          setStartupError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(
            error instanceof Error ? error.message : "Failed to load workspace"
          );
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isReady || !workspace) {
      return;
    }

    let cancelled = false;

    void saveWorkspaceSnapshot(nativeWorkspacePersistenceIO, workspace)
      .then(() => {
        if (cancelled) {
          return;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStartupError(
            error instanceof Error ? error.message : "Failed to save workspace"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, workspace]);

  const activeSheet = workspace ? getActiveSheet(workspace) : null;

  return {
    activeSheet,
    createSheet() {
      setWorkspace((current) => {
        const nextWorkspace = current ?? bootstrapWorkspace(null).workspace;
        return createWorkspaceSheet(nextWorkspace).workspace;
      });
    },
    deleteSheet(sheetId: string) {
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        const nextWorkspace = deleteWorkspaceSheet(current, sheetId).workspace;
        return nextWorkspace.sheets.length > 0
          ? nextWorkspace
          : bootstrapWorkspace(null).workspace;
      });
    },
    isReady,
    renameActiveSheet(title: string) {
      setWorkspace((current) => {
        const sheetId = current ? getActiveSheet(current)?.id : null;
        if (!current || !sheetId) {
          return current;
        }

        return renameWorkspaceSheet(current, { id: sheetId, title }).workspace;
      });
    },
    searchSheets(query: string) {
      return workspace ? searchWorkspaceSheets(workspace, { query }) : [];
    },
    selectSheet(sheetId: string) {
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return setWorkspaceActiveSheet(current, sheetId).workspace;
      });
    },
    startupError,
    updateActiveSheetBody(body: string) {
      setWorkspace((current) => {
        const activeSheet = current ? getActiveSheet(current) : null;
        if (!current || !activeSheet) {
          return current;
        }

        return updateWorkspaceSheetBody(current, {
          body,
          id: activeSheet.id,
          title: activeSheet.title,
        }).workspace;
      });
    },
    workspace,
  };
}
