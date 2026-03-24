import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import {
  WORKSPACE_DIRECTORY_NAME,
  WORKSPACE_DOCUMENT_FILE_NAME,
} from "./workspace-store.shared";
import { createNativeWorkspacePersistenceIO } from "./workspace-store.native-io";
export {
  loadPersistedWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "./workspace-store.shared";

function getWorkspaceDirectory() {
  try {
    return new Directory(Paths.document, WORKSPACE_DIRECTORY_NAME);
  } catch {
    return null;
  }
}

function getWorkspaceDocumentFile() {
  const workspaceDirectory = getWorkspaceDirectory();

  if (!workspaceDirectory) {
    return null;
  }

  try {
    return new File(workspaceDirectory, WORKSPACE_DOCUMENT_FILE_NAME);
  } catch {
    return null;
  }
}

export const nativeWorkspacePersistenceIO = createNativeWorkspacePersistenceIO({
  getWorkspaceDirectory,
  getWorkspaceDocumentFile,
  readLegacyValue(key) {
    return AsyncStorage.getItem(key);
  },
  async removeLegacyValue(key) {
    await AsyncStorage.removeItem(key);
  },
  writeLegacyValue(key, value) {
    return AsyncStorage.setItem(key, value);
  },
});
