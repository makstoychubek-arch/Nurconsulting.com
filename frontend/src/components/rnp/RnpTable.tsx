import { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { RnpColumn, RnpRow } from '../../lib/types';

const helper = createColumnHelper<RnpRow>();

type Props = {
  rows: RnpRow[];
  columns: RnpColumn[];
  compact?: boolean;
};

function cellClass(row: RnpRow, col: RnpColumn, val: string | number | null) {
  const base = 'border border-graphite-border px-0.5 py-0 text-center text-[10px] leading-tight';
  const hero = row.hero && (col.kind === 'week' || col.kind === 'total');
  if (col.kind === 'total') {
    return `${base} bg-sand/10 text-sand font-semibold${hero ? ' text-[13px] font-bold' : ''}`;
  }
  if (col.kind === 'week') {
    return `${base} bg-white/[0.03]${hero ? ' text-sand text-[13px] font-bold' : ''}`;
  }
  if (col.isToday) return `${base} border-x border-sand/50`;
  if (typeof val === 'string' && val.includes('%')) {
    const n = parseFloat(val.replace(',', '.').replace('%', ''));
    if (!Number.isNaN(n) && row.id.includes('plan')) {
      if (n >= 100) return `${base} bg-sand/25 text-sand font-semibold`;
      if (n < 70) return `${base} bg-cocoa-soft text-[#d4c4b8]`;
    }
  }
  return `${base} bg-graphite-cell`;
}

export function RnpTable({ rows, columns, compact = true }: Props) {
  const tableColumns = useMemo(
    () => [
      helper.accessor('label', {
        header: () => null,
        cell: (info) => (
          <span
            className={`block truncate text-left text-[9px] ${
              info.row.original.bold ? 'font-semibold text-[#e8e6e3]' : 'text-sand-muted'
            } ${info.row.original.hero ? 'font-bold text-sand' : ''}`}
          >
            {info.getValue()}
          </span>
        ),
        size: compact ? 168 : 200,
      }),
      ...columns.map((col) =>
        helper.display({
          id: col.id,
          header: () => (
            <span className={`text-[9px] ${col.isToday ? 'text-sand' : 'text-sand-muted'}`}>
              {col.label}
            </span>
          ),
          cell: ({ row }) => {
            const val = row.original.values[col.id] ?? '';
            return (
              <span className={cellClass(row.original, col, val)}>
                {val === '' || val == null ? '' : String(val)}
              </span>
            );
          },
          size: compact ? 36 : 44,
        }),
      ),
    ],
    [columns, compact],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rnp-scroll overflow-auto max-h-[calc(100vh-180px)] border border-graphite-border rounded-sm">
      <table className="w-max min-w-full border-collapse text-[10px]">
        <thead className="sticky top-0 z-20 bg-[#16161a]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="border border-graphite-border px-0.5 py-0.5 text-center font-medium text-sand-muted"
                  style={{ width: h.getSize() }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            if (row.original.section && row.original.label === row.original.section) {
              return (
                <tr key={row.id} className="border-t border-graphite-border bg-[#16161a]">
                  <td
                    colSpan={tableColumns.length}
                    className="px-2 py-0.5 text-left text-[9px] font-bold uppercase tracking-wide text-sand"
                  >
                    {row.original.section}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={row.id} className="hover:bg-white/[0.02]">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`p-0 ${cell.column.id === 'label' ? 'sticky left-0 z-10 bg-graphite-cell border-r border-graphite-border' : ''}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
