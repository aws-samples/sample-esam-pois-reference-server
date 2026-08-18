// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ReactNode } from 'react';

/**
 * Column definition for the DataTable component.
 */
export interface Column<T> {
  /** Unique key identifying this column */
  key: string;
  /** Header text displayed in the column header */
  header: string;
  /** Text alignment for the column */
  align?: 'left' | 'center' | 'right';
  /** Render function for each cell in this column */
  render: (item: T, index: number) => ReactNode;
  /** Optional CSS width value */
  width?: string;
}

/**
 * Props for the DataTable component.
 */
interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Array of data items to render as rows */
  data: T[];
  /** Function to derive a unique key for each row */
  rowKey: (item: T) => string;
  /** Content to display when data is empty */
  emptyState?: ReactNode;
  /** Optional click handler for rows */
  onRowClick?: (item: T) => void;
}

/**
 * Generic data table with standardized header styling, row hover states,
 * and empty state support. Accepts a generic type parameter for type-safe
 * column render functions.
 */
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 uppercase text-xs font-semibold text-gray-500 ${alignClasses[col.align || 'left']}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={rowKey(item)}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 text-sm ${alignClasses[col.align || 'left']}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.render(item, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
