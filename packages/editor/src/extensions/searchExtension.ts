import { StateEffect, type EditorState, type Extension } from '@codemirror/state';
import {
  closeSearchPanel,
  getSearchQuery,
  openSearchPanel,
  search,
  SearchQuery,
  searchPanelOpen,
  setSearchQuery,
} from '@codemirror/search';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { SearchState } from '../types';
import { DEFAULT_SEARCH_STATE } from '../types';

export interface SearchExtensionOptions {
  onSearchStateChange?: (state: SearchState | null, source?: string) => void;
}

export const searchChangeSourceEffect = StateEffect.define<string>();

function hasSearchValue(state: EditorState): boolean {
  const query = getSearchQuery(state);
  return searchPanelOpen(state) || query.search.length > 0 || query.replace.length > 0;
}

function countSearchMatches(state: EditorState, query: SearchQuery) {
  if (!query.valid || query.search.length === 0) {
    return {
      activeMatchIndex: null,
      totalMatches: 0,
    };
  }

  const selection = state.selection.main;
  let totalMatches = 0;
  let activeMatchIndex: number | null = null;
  const cursor = query.getCursor(state);

  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    if (match.value.from === match.value.to) {
      continue;
    }

    if (selection.from === match.value.from && selection.to === match.value.to) {
      activeMatchIndex = totalMatches;
    }

    totalMatches += 1;
  }

  return {
    activeMatchIndex,
    totalMatches,
  };
}

function normalizeSearchState(state: SearchState | null): SearchState | null {
  if (!state) {
    return null;
  }

  return {
    ...DEFAULT_SEARCH_STATE,
    ...state,
  };
}

function isSearchStateEqual(a: SearchState | null, b: SearchState | null): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.query === b.query &&
    a.replaceQuery === b.replaceQuery &&
    a.caseSensitive === b.caseSensitive &&
    a.wholeWord === b.wholeWord &&
    a.regexp === b.regexp &&
    a.isOpen === b.isOpen &&
    a.activeMatchIndex === b.activeMatchIndex &&
    a.totalMatches === b.totalMatches
  );
}

function getSearchChangeSource(update: ViewUpdate): string | undefined {
  let source: string | undefined;

  for (const transaction of update.transactions) {
    for (const effect of transaction.effects) {
      if (effect.is(searchChangeSourceEffect)) {
        source = effect.value;
      }
    }
  }

  return source;
}

function shouldEmitSearchStateChange(update: ViewUpdate): boolean {
  if (update.docChanged || update.selectionSet) {
    return hasSearchValue(update.startState) || hasSearchValue(update.state);
  }

  return update.transactions.some((transaction) => {
    if (searchPanelOpen(transaction.startState) !== searchPanelOpen(transaction.state)) {
      return true;
    }

    return transaction.effects.some(
      (effect) =>
        effect.is(setSearchQuery) ||
        effect.is(searchChangeSourceEffect),
    );
  });
}

function createExternalSearchPanel() {
  const dom = document.createElement('div');
  return {
    dom,
    mount() {},
    destroy() {},
  };
}

function toSearchQuery(state: SearchState | null): SearchQuery {
  const normalizedState = normalizeSearchState(state);

  return new SearchQuery({
    search: normalizedState?.query ?? '',
    replace: normalizedState?.replaceQuery ?? '',
    caseSensitive: normalizedState?.caseSensitive ?? DEFAULT_SEARCH_STATE.caseSensitive,
    wholeWord: normalizedState?.wholeWord ?? DEFAULT_SEARCH_STATE.wholeWord,
    regexp: normalizedState?.regexp ?? DEFAULT_SEARCH_STATE.regexp,
  });
}

export function createSearchExtension(
  options: SearchExtensionOptions = {},
): Extension {
  const { onSearchStateChange } = options;

  return [
    search({
      createPanel: createExternalSearchPanel,
    }),
    ViewPlugin.fromClass(
      class {
        update(update: ViewUpdate) {
          if (!onSearchStateChange || !shouldEmitSearchStateChange(update)) {
            return;
          }

          const previousState = getSearchState(update.startState);
          const nextState = getSearchState(update.state);
          const source = getSearchChangeSource(update);

          if (!isSearchStateEqual(previousState, nextState) || source) {
            onSearchStateChange(nextState, source);
          }
        }
      },
    ),
  ];
}

export function getSearchState(state: EditorState): SearchState | null {
  const query = getSearchQuery(state);
  const isOpen = searchPanelOpen(state);

  if (!isOpen && query.search.length === 0 && query.replace.length === 0) {
    return null;
  }

  const { activeMatchIndex, totalMatches } = countSearchMatches(state, query);

  return {
    ...DEFAULT_SEARCH_STATE,
    query: query.search,
    replaceQuery: query.replace,
    caseSensitive: query.caseSensitive,
    wholeWord: query.wholeWord,
    regexp: query.regexp,
    isOpen,
    activeMatchIndex,
    totalMatches,
  };
}

export function setSearchState(
  view: EditorView,
  state: SearchState | null,
  source?: string,
): void {
  const normalizedState = normalizeSearchState(state);
  const currentQuery = getSearchQuery(view.state);
  const nextQuery = toSearchQuery(normalizedState);

  if (!currentQuery.eq(nextQuery)) {
    const effects: StateEffect<unknown>[] = [setSearchQuery.of(nextQuery)];
    if (source) {
      effects.unshift(searchChangeSourceEffect.of(source));
    }

    view.dispatch({ effects });
  }

  const shouldOpen = normalizedState?.isOpen ?? false;
  const isOpen = searchPanelOpen(view.state);
  if (shouldOpen === isOpen) {
    return;
  }

  if (shouldOpen) {
    openSearchPanel(view);
    return;
  }

  closeSearchPanel(view);
}

export function clearSearch(view: EditorView, source?: string): void {
  setSearchState(view, null, source);
}
