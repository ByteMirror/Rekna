import {
  computeSheetEvaluation,
  type SheetEvaluationRequest,
  type SheetEvaluationResult,
  type SheetEvaluationSheet,
} from "./sheet-evaluation";

type PendingEvaluation = {
  id: number;
  reject: (reason?: unknown) => void;
  resolve: (value: SheetEvaluationResult) => void;
};

type WorkerIncomingMessage =
  | {
      sheets: SheetEvaluationSheet[];
      type: "syncSheets";
    }
  | {
      id: number;
      request: SheetEvaluationRequest;
      type: "evaluate";
    };

type WorkerOutgoingMessage =
  | {
      id: number;
      result: SheetEvaluationResult;
      type: "result";
    }
  | {
      id: number;
      message: string;
      type: "error";
    };

export type SheetEvaluationService = {
  dispose: () => void;
  evaluate: (
    request: SheetEvaluationRequest
  ) => Promise<SheetEvaluationResult>;
  syncSheets: (sheets: SheetEvaluationSheet[]) => void;
};

export function createSheetEvaluationService(): SheetEvaluationService {
  if (typeof Worker !== "function") {
    return createInlineSheetEvaluationService();
  }

  return createWorkerBackedSheetEvaluationService();
}

export function isSheetEvaluationAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function createWorkerBackedSheetEvaluationService(): SheetEvaluationService {
  let nextRequestId = 0;
  let pendingEvaluation: PendingEvaluation | null = null;
  let syncedSheets: SheetEvaluationSheet[] = [];
  let worker: Worker | null = null;

  return {
    dispose() {
      abortPendingEvaluation();
    },
    evaluate(request) {
      if (pendingEvaluation) {
        abortPendingEvaluation();
      }

      const activeWorker = ensureWorker();
      const requestId = nextRequestId + 1;
      nextRequestId = requestId;

      return new Promise<SheetEvaluationResult>((resolve, reject) => {
        pendingEvaluation = {
          id: requestId,
          reject,
          resolve,
        };
        activeWorker.postMessage({
          id: requestId,
          request,
          type: "evaluate",
        } satisfies WorkerIncomingMessage);
      });
    },
    syncSheets(nextSheets) {
      syncedSheets = nextSheets;
      worker?.postMessage({
        sheets: nextSheets,
        type: "syncSheets",
      } satisfies WorkerIncomingMessage);
    },
  };

  function abortPendingEvaluation() {
    pendingEvaluation?.reject(createAbortError());
    pendingEvaluation = null;
    worker?.terminate();
    worker = null;
  }

  function ensureWorker() {
    if (worker) {
      return worker;
    }

    const nextWorker = new Worker(
      new URL("./sheet-evaluation.worker.ts", import.meta.url),
      {
        name: "linea-sheet-evaluation",
        type: "module",
      }
    );

    nextWorker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
      const message = event.data;

      if (!pendingEvaluation || pendingEvaluation.id !== message.id) {
        return;
      }

      if (message.type === "result") {
        pendingEvaluation.resolve(message.result);
      } else {
        pendingEvaluation.reject(new Error(message.message));
      }

      pendingEvaluation = null;
    };

    nextWorker.onerror = (event) => {
      if (pendingEvaluation) {
        pendingEvaluation.reject(
          event.error instanceof Error
            ? event.error
            : new Error(event.message || "Sheet evaluation worker failed")
        );
        pendingEvaluation = null;
      }

      nextWorker.terminate();

      if (worker === nextWorker) {
        worker = null;
      }
    };

    nextWorker.postMessage({
      sheets: syncedSheets,
      type: "syncSheets",
    } satisfies WorkerIncomingMessage);

    worker = nextWorker;
    return nextWorker;
  }
}

function createInlineSheetEvaluationService(): SheetEvaluationService {
  let latestRequestId = 0;
  let syncedSheets: SheetEvaluationSheet[] = [];

  return {
    dispose() {},
    async evaluate(request) {
      const requestId = latestRequestId + 1;
      latestRequestId = requestId;

      await Promise.resolve();
      const result = await computeSheetEvaluation({
        ...request,
        sheets: syncedSheets,
      });

      if (requestId !== latestRequestId) {
        throw createAbortError();
      }

      return result;
    },
    syncSheets(nextSheets) {
      syncedSheets = nextSheets;
    },
  };
}

function createAbortError() {
  try {
    return new DOMException("Sheet evaluation was cancelled.", "AbortError");
  } catch {
    const abortError = new Error("Sheet evaluation was cancelled.");
    abortError.name = "AbortError";
    return abortError;
  }
}
