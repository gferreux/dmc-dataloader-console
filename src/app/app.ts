import { afterNextRender, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'dmc-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: `
    :host {
      display: block;
      height: 100%;
      max-width: 1920px;
      margin: 0 auto;
    }
  `,
})
export class App {
  constructor() {
    afterNextRender(() => window.dispatchEvent(new CustomEvent('app-ready')));
  }
}
