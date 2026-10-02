import type { TNotification, TProfileTab } from './profile.types';

export interface IProfileTabOption {
  key: TProfileTab;
  label: string;
  /** Clase `pi pi-*` de la pestaña. */
  icon: string;
}

/** Fuente ÚNICA de pestañas: el `<p-tablist>` de escritorio y el `<p-select>` de móvil salen de aquí. */
export const PROFILE_TABS: IProfileTabOption[] = [
  { key: 'info', label: 'Información personal', icon: 'pi pi-user' },
  { key: 'security', label: 'Seguridad', icon: 'pi pi-lock' },
  { key: 'sessions', label: 'Sesiones', icon: 'pi pi-desktop' },
  { key: 'notifications', label: 'Notificaciones', icon: 'pi pi-bell' },
  { key: 'avatar', label: 'Avatar', icon: 'pi pi-face-smile' },
  { key: 'appearance', label: 'Apariencia', icon: 'pi pi-palette' },
];

export const DEFAULT_PROFILE_TAB: TProfileTab = 'info';

/** Ícono por tipo de notificación (el texto del mensaje ya la describe: el ícono es refuerzo). */
export const NOTIFICATION_ICONS: Record<TNotification['type'], string> = {
  TICKET_ASSIGNED: 'pi pi-user-plus',
  TICKET_CHANGED_BY_ALTERNANTE: 'pi pi-pencil',
  RELATIONSHIP_GRANTED: 'pi pi-share-alt',
  RELATIONSHIP_REVOKED: 'pi pi-ban',
  TICKET_STATUS_CHANGED: 'pi pi-sync',
  TICKET_COMMENTED: 'pi pi-comment',
  TICKET_REOPENED: 'pi pi-replay',
  TICKET_SURVEY: 'pi pi-star',
  TICKET_SURVEY_ALERT: 'pi pi-exclamation-triangle',
  ACCOUNT_LOCKED: 'pi pi-lock',
};
