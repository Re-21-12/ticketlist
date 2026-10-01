import { Component, inject } from '@angular/core';
import { MessageModule } from '@openng/optimus-ui/message';
import { ROLE_LABELS } from '../../../core/casl/role-labels.constants';
import { SessionStore } from '../../../core/session/session.store';
import { FormSplit } from '../../../layouts/form-split/form-split';

/** Pestaña «Información personal»: datos de solo lectura de la sesión (los cambia un administrador). */
@Component({
  selector: 'app-personal-info-tab',
  imports: [FormSplit, MessageModule],
  templateUrl: './personal-info-tab.html',
  styleUrl: './personal-info-tab.css',
})
export class PersonalInfoTab {
  protected readonly _sessionStore = inject(SessionStore);
  protected readonly roleLabels = ROLE_LABELS;
}
