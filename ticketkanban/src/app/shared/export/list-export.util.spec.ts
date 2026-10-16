import { buildExportTable } from '../dynamic-table/utils/build-export';
import { toCsv, toTxt, fileNameFor, stamp } from './list-export.util';
import type { IExportTable } from './list-export.interface';

const TABLE: IExportTable = {
  title: 'Usuarios',
  fileName: 'usuarios-2026-10-15',
  headers: ['Nombre', 'Correo', 'Notas'],
  rows: [
    ['Ana Agente', 'ana@ticketit.dev', 'Dice "hola", y sigue'],
    ['Marta', 'marta@ticketit.dev', null],
  ],
};

const textOf = (blob: Blob): Promise<string> => blob.text();

describe('exportar listados y reportes', () => {
  it('CSV: con BOM (Excel abre las tildes), comillas donde hay coma o comillas y celdas vacías', async () => {
    const blob = toCsv(TABLE);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM de UTF-8
    const lines = (await textOf(blob)).split('\r\n'); // `text()` ya quita el BOM
    expect(lines[0]).toBe('Nombre,Correo,Notas');
    expect(lines[1]).toBe('Ana Agente,ana@ticketit.dev,"Dice ""hola"", y sigue"');
    expect(lines[2]).toBe('Marta,marta@ticketit.dev,');
  });

  it('texto: columnas alineadas con el título arriba', async () => {
    const text = await textOf(toTxt(TABLE));
    const lines = text.split('\n');
    expect(lines[0]).toBe('Usuarios');
    expect(lines[2]?.startsWith('Nombre')).toBe(true);
    expect(lines[3]).toMatch(/^-+ {2}-+ {2}-+$/);
    expect(lines[4]).toContain('ana@ticketit.dev');
  });

  it('el nombre del archivo lleva la extensión del formato', () => {
    expect(fileNameFor(TABLE, 'xlsx')).toBe('usuarios-2026-10-15.xlsx');
    expect(fileNameFor(TABLE, 'pdf')).toBe('usuarios-2026-10-15.pdf');
  });

  it('la fecha del archivo es la local en AAAA-MM-DD', () => {
    expect(stamp(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('una grilla se exporta con las MISMAS columnas y textos que se ven (etiquetas, Sí/No, fechas)', () => {
    const table = buildExportTable(
      'Usuarios · Administración',
      [
        { field: 'name', header: 'Nombre' },
        { field: 'role', header: 'Rol', options: [{ value: 'ADMIN', label: 'Administrador' }] },
        { field: 'disabled', header: 'Deshabilitada', dataType: 'boolean' },
        { field: 'note', header: 'Nota' },
      ],
      [{ name: 'Marta', role: 'ADMIN', disabled: false, note: null }],
      new Date(2026, 9, 15),
    );
    expect(table.fileName).toBe('usuarios-administracion-2026-10-15');
    expect(table.headers).toEqual(['Nombre', 'Rol', 'Deshabilitada', 'Nota']);
    expect(table.rows).toEqual([['Marta', 'Administrador', 'No', '—']]);
  });
});
