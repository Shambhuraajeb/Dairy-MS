import { Directive, EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';

/** <button *appHasPermission="'farmer.create'">  or  *appHasPermission="['a.view','b.view']" (any-of) */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective {
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private readonly perm = inject(PermissionService);
  private view: EmbeddedViewRef<unknown> | null = null;

  readonly appHasPermission = input.required<string | readonly string[] | null | undefined>();

  constructor() {
    effect(() => {
      const allowed = this.perm.check(this.appHasPermission());
      if (allowed && !this.view) {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (!allowed && this.view) {
        this.container.clear();
        this.view = null;
      }
    });
  }
}
