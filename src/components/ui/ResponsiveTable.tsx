'use client';
import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  mobileLabel?: string; // Label for mobile card view
  className?: string;
}

interface SelectionProps {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  selection?: SelectionProps;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'No data found.',
  onRowClick,
  className,
  selection,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-600">
        {emptyMessage}
      </div>
    );
  }

  const handleCheckboxClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    selection?.toggle(id);
  };

  const handleHeaderCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selection?.toggleAll();
  };

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {data.map((row) => {
          const rowId = keyExtractor(row);
          const isRowSelected = selection?.isSelected(rowId);

          return (
            <div
              key={rowId}
              onClick={() => onRowClick?.(row)}
              className={twMerge(
                'bg-white border border-gray-200 rounded-lg p-4 space-y-2 transition-all',
                onRowClick && 'cursor-pointer hover:border-brand-purple/30 hover:shadow-sm',
                isRowSelected && 'border-purple-400 bg-purple-50/50',
                className
              )}
            >
              {/* Selection checkbox for mobile */}
              {selection && (
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={() => selection.toggle(rowId)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-500">Select</span>
                </div>
              )}

              {columns.map((column, idx) => {
                const content = column.accessor(row);
                if (content === null || content === undefined) return null;

                return (
                  <div key={idx} className={twMerge('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1', column.className)}>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide sm:w-24 flex-shrink-0">
                      {column.mobileLabel || column.header}
                    </span>
                    <div className="text-sm text-gray-900 sm:text-right sm:flex-1">
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {/* Selection header checkbox */}
              {selection && (
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selection.isPartiallySelected;
                    }}
                    onChange={() => selection.toggleAll()}
                    onClick={handleHeaderCheckboxClick}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
              )}
              {columns.map((column, idx) => (
                <th
                  key={idx}
                  className={twMerge(
                    'px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((row) => {
              const rowId = keyExtractor(row);
              const isRowSelected = selection?.isSelected(rowId);

              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick?.(row)}
                  className={twMerge(
                    'hover:bg-gray-50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    isRowSelected && 'bg-purple-50/50'
                  )}
                >
                  {/* Selection row checkbox */}
                  {selection && (
                    <td className="px-4 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => selection.toggle(rowId)}
                        onClick={(e) => handleCheckboxClick(e, rowId)}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                  )}
                  {columns.map((column, idx) => (
                    <td
                      key={idx}
                      className={twMerge(
                        'px-4 sm:px-6 py-4 text-sm text-gray-700',
                        column.className
                      )}
                    >
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
