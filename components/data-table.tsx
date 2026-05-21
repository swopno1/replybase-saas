"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Table as ReactTable,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutColumns,
  IconLoader,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  isLoading?: boolean;
  persistenceKey?: string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  totalCount?: number;
  onSelectAllMatching?: (isSelected: boolean) => void;
  isAllMatchingSelected?: boolean;
  actionButtons?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  pagination,
  onPaginationChange,
  rowSelection = {},
  onRowSelectionChange,
  isLoading = false,
  persistenceKey,
  onRowClick,
  getRowId,
  totalCount,
  onSelectAllMatching,
  isAllMatchingSelected = false,
  actionButtons,
}: DataTableProps<TData, TValue>) {
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => {
      if (persistenceKey && typeof window !== "undefined") {
        const saved = localStorage.getItem(`datatable_visibility_${persistenceKey}`);
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            console.error("Failed to parse column visibility", e);
          }
        }
      }
      return {};
    }
  );

  React.useEffect(() => {
    if (persistenceKey) {
      localStorage.setItem(
        `datatable_visibility_${persistenceKey}`,
        JSON.stringify(columnVisibility)
      );
    }
  }, [columnVisibility, persistenceKey]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      rowSelection,
      columnVisibility,
    },
    onPaginationChange,
    onRowSelectionChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    enableRowSelection: true,
    getRowId: getRowId || ((row: TData) => (row as { id?: string }).id || ""),
  });

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const rows = table.getRowModel().rows;
      if (!rows.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const row = rows[focusedIndex];
        if (onRowClick) {
          onRowClick(row.original);
        } else {
          row.toggleSelected();
        }
      } else if (e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0) {
          rows[focusedIndex].toggleSelected();
        }
      }
    },
    [table, focusedIndex, onRowClick]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap min-h-[36px]">
          <span>
            {table.getFilteredSelectedRowModel()?.rows?.length ?? 0} of{" "}
            {table.getFilteredRowModel()?.rows?.length ?? 0} row(s) selected.
          </span>
          {Object.keys(rowSelection).length > 0 && totalCount && onSelectAllMatching && (
            <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 animate-in fade-in duration-200">
              {isAllMatchingSelected ? (
                <>
                  All {totalCount} records selected.
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold text-destructive hover:text-destructive/80"
                    onClick={() => {
                       if (onRowSelectionChange) onRowSelectionChange({});
                       onSelectAllMatching(false);
                    }}
                  >
                    Clear selection
                  </Button>
                </>
              ) : (
                <>
                  {Object.keys(rowSelection).length} selected on page.
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    onClick={() => onSelectAllMatching(true)}
                  >
                    Select all {totalCount}
                  </Button>
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actionButtons}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <IconLayoutColumns className="mr-2 h-4 w-4" />
                Columns
                <IconChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const header = column.columnDef.header;
                  const label = typeof header === "string"
                    ? header
                    : typeof header === "function"
                      ? column.id
                      : column.id;

                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          className="overflow-x-auto max-h-[600px] outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onBlur={() => setFocusedIndex(-1)}
        >
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="h-10 py-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      focusedIndex === index && "bg-muted ring-1 ring-ring ring-inset"
                    )}
                    onClick={() => onRowClick ? onRowClick(row.original) : row.toggleSelected()}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-6 lg:gap-8">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
