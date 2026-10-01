/** Un paso del breadcrumb. `link: null` = página actual (se marca con `aria-current="page"`). */
export interface IBreadcrumbItem {
  label: string;
  link: string | null;
}
