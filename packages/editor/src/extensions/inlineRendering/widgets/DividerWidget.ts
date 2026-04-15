import { WidgetType } from '@codemirror/view';

export class DividerWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'cm-divider-widget';
    return hr;
  }
}
