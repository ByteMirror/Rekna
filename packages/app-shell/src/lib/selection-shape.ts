import type { EditorView, Rect, ViewUpdate } from "@codemirror/view";
import { ViewPlugin } from "@codemirror/view";

const SELECTION_EDGE_EPSILON = 0.75;

export const SELECTION_TOP_LEFT_CLASS = "linea-selection-corner-top-left";
export const SELECTION_TOP_RIGHT_CLASS = "linea-selection-corner-top-right";
export const SELECTION_BOTTOM_LEFT_CLASS = "linea-selection-corner-bottom-left";
export const SELECTION_BOTTOM_RIGHT_CLASS =
  "linea-selection-corner-bottom-right";

export type SelectionFragmentRect = Pick<
  Rect,
  "bottom" | "left" | "right" | "top"
>;

type SelectionFragmentCorners = {
  bottomLeft: boolean;
  bottomRight: boolean;
  topLeft: boolean;
  topRight: boolean;
};

type MeasuredSelectionFragment = SelectionFragmentRect & {
  element: HTMLElement;
};

export function getSelectionCornerStates(
  fragments: SelectionFragmentRect[],
  epsilon = SELECTION_EDGE_EPSILON
): SelectionFragmentCorners[] {
  return fragments.map((fragment, index) => {
    const topNeighbors = fragments.filter(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        Math.abs(candidate.bottom - fragment.top) <= epsilon
    );
    const bottomNeighbors = fragments.filter(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        Math.abs(candidate.top - fragment.bottom) <= epsilon
    );

    return {
      topLeft: !hasEdgeCoverage(topNeighbors, fragment.left + epsilon, epsilon),
      topRight: !hasEdgeCoverage(
        topNeighbors,
        fragment.right - epsilon,
        epsilon
      ),
      bottomLeft: !hasEdgeCoverage(
        bottomNeighbors,
        fragment.left + epsilon,
        epsilon
      ),
      bottomRight: !hasEdgeCoverage(
        bottomNeighbors,
        fragment.right - epsilon,
        epsilon
      ),
    };
  });
}

export const selectionShapeExtension = ViewPlugin.fromClass(
  class {
    frameId = 0;
    view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.schedule();
    }

    update(update: ViewUpdate) {
      this.view = update.view;

      if (
        update.docChanged ||
        update.focusChanged ||
        update.geometryChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.schedule();
      }
    }

    destroy() {
      if (this.frameId !== 0) {
        window.cancelAnimationFrame(this.frameId);
      }
    }

    private schedule() {
      if (this.frameId !== 0) {
        window.cancelAnimationFrame(this.frameId);
      }

      this.frameId = window.requestAnimationFrame(() => {
        this.frameId = 0;
        syncSelectionCorners(this.view);
      });
    }
  }
);

function hasEdgeCoverage(
  neighbors: SelectionFragmentRect[],
  x: number,
  epsilon: number
) {
  return neighbors.some(
    (neighbor) => x >= neighbor.left - epsilon && x <= neighbor.right + epsilon
  );
}

function syncSelectionCorners(view: EditorView) {
  const fragments = Array.from(
    view.dom.querySelectorAll<HTMLElement>(
      ".cm-selectionLayer .cm-selectionBackground"
    )
  ).map(measureSelectionFragment);
  const cornerStates = getSelectionCornerStates(fragments);

  fragments.forEach((fragment, index) => {
    const corners = cornerStates[index];

    fragment.element.classList.toggle(
      SELECTION_TOP_LEFT_CLASS,
      corners.topLeft
    );
    fragment.element.classList.toggle(
      SELECTION_TOP_RIGHT_CLASS,
      corners.topRight
    );
    fragment.element.classList.toggle(
      SELECTION_BOTTOM_LEFT_CLASS,
      corners.bottomLeft
    );
    fragment.element.classList.toggle(
      SELECTION_BOTTOM_RIGHT_CLASS,
      corners.bottomRight
    );
  });
}

function measureSelectionFragment(
  element: HTMLElement
): MeasuredSelectionFragment {
  const rect = element.getBoundingClientRect();

  return {
    element,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}
