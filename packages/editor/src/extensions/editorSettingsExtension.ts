import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import type { EditorSettings, EditorSettingsUpdate } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { createEditorTheme } from '../theme/createTheme';

export interface EditorSettingsCompartments {
  editable: Compartment;
  lineNumbers: Compartment;
  lineWrapping: Compartment;
  readOnly: Compartment;
  spellcheck: Compartment;
  tabSize: Compartment;
  theme: Compartment;
}

export interface EditorSettingsExtensionRuntime {
  compartments: EditorSettingsCompartments;
  extension: Extension;
  field: StateField<EditorSettings>;
}

function mergeSettings(
  current: EditorSettings,
  update: EditorSettingsUpdate,
): EditorSettings {
  return {
    ...current,
    ...update,
    features: {
      ...current.features,
      ...update.features,
    },
    theme: {
      ...current.theme,
      ...update.theme,
      colors: {
        ...current.theme.colors,
        ...update.theme?.colors,
      },
    },
  };
}

function createSettingsExtensions(settings: EditorSettings) {
  return {
    editable: EditorView.editable.of(settings.editable && !settings.readonly),
    lineNumbers: settings.showLineNumbers ? lineNumbers() : [],
    lineWrapping: settings.lineWrapping ? EditorView.lineWrapping : [],
    readOnly: EditorState.readOnly.of(settings.readonly),
    spellcheck: EditorView.contentAttributes.of({
      spellcheck: settings.spellcheck ? 'true' : 'false',
    }),
    tabSize: EditorState.tabSize.of(settings.tabSize),
    theme: createEditorTheme(settings.theme),
  };
}

function createCompartments(): EditorSettingsCompartments {
  return {
    editable: new Compartment(),
    lineNumbers: new Compartment(),
    lineWrapping: new Compartment(),
    readOnly: new Compartment(),
    spellcheck: new Compartment(),
    tabSize: new Compartment(),
    theme: new Compartment(),
  };
}

function createSettingsReconfigureEffects(
  compartments: EditorSettingsCompartments,
  settings: EditorSettings,
) {
  const extensions = createSettingsExtensions(settings);

  return [
    compartments.editable.reconfigure(extensions.editable),
    compartments.lineNumbers.reconfigure(extensions.lineNumbers),
    compartments.lineWrapping.reconfigure(extensions.lineWrapping),
    compartments.readOnly.reconfigure(extensions.readOnly),
    compartments.spellcheck.reconfigure(extensions.spellcheck),
    compartments.tabSize.reconfigure(extensions.tabSize),
    compartments.theme.reconfigure(extensions.theme),
  ];
}

export const setEditorSettingsEffect = StateEffect.define<EditorSettingsUpdate>();

export function createEditorSettingsExtension(
  initialSettings: EditorSettings,
): EditorSettingsExtensionRuntime {
  const compartments = createCompartments();
  const mergedInitialSettings = mergeSettings(DEFAULT_SETTINGS, initialSettings);

  const field = StateField.define<EditorSettings>({
    create() {
      return mergedInitialSettings;
    },
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setEditorSettingsEffect)) {
          return mergeSettings(value, effect.value);
        }
      }

      return value;
    },
  });

  const initialExtensions = createSettingsExtensions(mergedInitialSettings);

  return {
    compartments,
    extension: [
      field,
      compartments.editable.of(initialExtensions.editable),
      compartments.lineNumbers.of(initialExtensions.lineNumbers),
      compartments.lineWrapping.of(initialExtensions.lineWrapping),
      compartments.readOnly.of(initialExtensions.readOnly),
      compartments.spellcheck.of(initialExtensions.spellcheck),
      compartments.tabSize.of(initialExtensions.tabSize),
      compartments.theme.of(initialExtensions.theme),
    ],
    field,
  };
}

export function getEditorSettings(
  state: EditorState,
  runtime: EditorSettingsExtensionRuntime,
): EditorSettings {
  return state.field(runtime.field);
}

export function getEditorSettingsEffects(
  state: EditorState,
  runtime: EditorSettingsExtensionRuntime,
  update: EditorSettingsUpdate,
) {
  const nextSettings = mergeSettings(getEditorSettings(state, runtime), update);

  return [
    setEditorSettingsEffect.of(update),
    ...createSettingsReconfigureEffects(runtime.compartments, nextSettings),
  ];
}
