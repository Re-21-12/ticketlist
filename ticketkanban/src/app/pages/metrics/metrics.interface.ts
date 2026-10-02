/** Período de consulta: fechas `YYYY-MM-DD` (hora local de quien consulta). */
export interface IMetricsPeriod {
  from: string;
  to: string;
}

/** Preajuste de período (botón rápido). */
export interface IPeriodPreset {
  days: number;
  label: string;
}

/** Una tarjeta de indicador ya lista para pintar (la arma `metric-summary`). */
export interface IMetricCard {
  key: string;
  icon: string;
  label: string;
  /** Valor principal, ya formateado («96,4 %», «2 h 30 min», «Sin información»). */
  display: string;
  status: 'ok' | 'warning' | 'critical' | 'no-data';
  /** Meta contra la que se compara («Meta: > 95 %»). */
  target: string;
  /** Línea secundaria: tamaño de muestra y detalle. */
  detail: string;
}
