import {
  afterNextRender,
  Component,
  DestroyRef,
  type ElementRef,
  inject,
  viewChild,
} from "@angular/core";
import { darkTheme, renderSKWidget } from "@stakekit/widget/bundle";

// Replaced at build time from `VITE_API_KEY` by `ng build --define`.
declare const SK_API_KEY: string;

@Component({
  selector: "app-root",
  template: "<div #widget></div>",
})
export class App {
  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>("widget");

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const widget = renderSKWidget({
        container: this.container().nativeElement,
        apiKey: SK_API_KEY,
        theme: darkTheme,
      });
      destroyRef.onDestroy(() => widget.unmount());
    });
  }
}
