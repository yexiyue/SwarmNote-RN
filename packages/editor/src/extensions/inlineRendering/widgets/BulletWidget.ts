import { WidgetType } from '@codemirror/view';

const BULLET_CHARS = ['\u25CF', '\u25CB', '\u25A0'];

export class BulletWidget extends WidgetType {
  constructor(private readonly depth: number) {
    super();
  }

  eq(other: BulletWidget): boolean {
    return this.depth === other.depth;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-bullet-widget';
    span.textContent = BULLET_CHARS[this.depth % BULLET_CHARS.length];
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
}
