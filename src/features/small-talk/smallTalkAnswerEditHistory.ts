/** Undo/redo history for a single Small Talk answer editing session.
 * The draft stays local until the user explicitly saves it.
 */
export interface AnswerEditHistory {
  past: string[];
  present: string;
  future: string[];
}

export const ANSWER_EDIT_HISTORY_LIMIT = 250;

export function beginAnswerEdit(text: string): AnswerEditHistory {
  return { past: [], present: text, future: [] };
}

export function changeAnswerEdit(history: AnswerEditHistory, text: string): AnswerEditHistory {
  if (text === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-ANSWER_EDIT_HISTORY_LIMIT),
    present: text,
    future: []
  };
}

export function undoAnswerEdit(history: AnswerEditHistory): AnswerEditHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [...history.future, history.present].slice(-ANSWER_EDIT_HISTORY_LIMIT)
  };
}

export function redoAnswerEdit(history: AnswerEditHistory): AnswerEditHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present].slice(-ANSWER_EDIT_HISTORY_LIMIT),
    present: history.future[history.future.length - 1],
    future: history.future.slice(0, -1)
  };
}
