import { Component, signal } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BranchesTabComponent } from './branches-tab.component';
import { CentersTabComponent } from './centers-tab.component';
import { DairyTabComponent } from './dairy-tab.component';
import { SettingsEditorComponent } from './settings-editor.component';

type SettingsTab = 'settings' | 'dairy' | 'branches' | 'centers';

/** /administration/settings - system settings + organization master data (dairy, branches, collection centers) */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [PageHeaderComponent, SettingsEditorComponent, DairyTabComponent, BranchesTabComponent, CentersTabComponent],
  template: `
    <app-page-header title="Settings" subtitle="System configuration and organization master data" />

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'settings'" (click)="tab.set('settings')">
          <i class="bi bi-sliders2 me-1"></i>System Settings
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'dairy'" (click)="tab.set('dairy')">
          <i class="bi bi-building me-1"></i>Dairy
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'branches'" (click)="tab.set('branches')">
          <i class="bi bi-diagram-2 me-1"></i>Branches
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" [class.active]="tab() === 'centers'" (click)="tab.set('centers')">
          <i class="bi bi-geo-alt me-1"></i>Collection Centers
        </button>
      </li>
    </ul>

    @switch (tab()) {
      @case ('settings') {
        <app-settings-editor />
      }
      @case ('dairy') {
        <app-dairy-tab />
      }
      @case ('branches') {
        <app-branches-tab />
      }
      @case ('centers') {
        <app-centers-tab />
      }
    }
  `,
})
export class SettingsComponent {
  readonly tab = signal<SettingsTab>('settings');
}
