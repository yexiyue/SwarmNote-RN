import { EditorView, WidgetType } from '@codemirror/view';

export class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly pos: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-checkbox-widget';
    input.setAttribute('aria-label', this.checked ? 'checked' : 'unchecked');

    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const newText = this.checked ? '[ ]' : '[x]';
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: newText },
      });
    });

    return input;
  }

  ignoreEvent(): boolean {
    return true;
  }
}
