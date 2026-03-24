import {
  type SheetEvaluationRequest,
  type SheetEvaluationResult,
  type SheetEvaluationSheet,
  computeSheetEvaluation,
} from "./sheet-evaluation";

type IncomingWorkerMessage =
  | {
      sheets: SheetEvaluationSheet[];
      type: "syncSheets";
    }
  | {
      id: number;
      request: SheetEvaluationRequest;
      type: "evaluate";
    };

type OutgoingWorkerMessage =
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

type SheetEvaluationWorkerScope = typeof globalThis & {
  onmessage: ((event: MessageEvent<IncomingWorkerMessage>) => void) | null;
  postMessage: (message: OutgoingWorkerMessage) => void;
};

const workerScope = self as SheetEvaluationWorkerScope;
let syncedSheets: SheetEvaluationSheet[] = [];

workerScope.onmessage = (event: MessageEvent<IncomingWorkerMessage>) => {
  const message = event.data;

  if (message.type === "syncSheets") {
    syncedSheets = message.sheets;
    return;
  }

  void computeSheetEvaluation({
    ...message.request,
    sheets: syncedSheets,
  })
    .then((result) => {
      workerScope.postMessage({
        id: message.id,
        result,
        type: "result",
      } satisfies OutgoingWorkerMessage);
    })
    .catch((error: unknown) => {
      workerScope.postMessage({
        id: message.id,
        message: error instanceof Error ? error.message : String(error),
        type: "error",
      } satisfies OutgoingWorkerMessage);
    });
};
