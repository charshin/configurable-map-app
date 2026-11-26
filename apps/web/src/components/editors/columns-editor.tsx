'use client';

import type { DatasetFieldDto } from '@confmap/shared';
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Issues } from './issues';

interface ColumnsEditorProps {
  /** Visible columns, in display order. */
  columns: string[];
  fields: DatasetFieldDto[];
  issues: Issues;
  onChange: (columns: string[]) => void;
}

interface Row {
  name: string;
  label: string;
  visible: boolean;
}

/**
 * Attribute table columns: ticked fields are shown, in the order listed.
 * Visible fields come first (in their configured order), then the hidden ones
 * in the layer's order. Reordering uses buttons, so it works from the keyboard.
 *
 * All fields render at once; that's fine for this dataset (56 fields). A much
 * wider dataset would want a virtualized list (see the README).
 */
export function ColumnsEditor({ columns, fields, issues, onChange }: ColumnsEditorProps) {
  const [query, setQuery] = useState('');
  const idPrefix = useId();
  const byName = new Map(fields.map((field) => [field.name, field]));
  const visible = new Set(columns);
  const rows: Row[] = [
    ...columns.map((name) => ({ name, label: byName.get(name)?.alias || name, visible: true })),
    ...fields
      .filter((field) => !visible.has(field.name))
      .map((field) => ({ name: field.name, label: field.alias || field.name, visible: false })),
  ];
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter((row) => row.name.toLowerCase().includes(needle) || row.label.toLowerCase().includes(needle))
    : rows;

  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? [...columns, name] : columns.filter((column) => column !== name));
  const move = (index: number, by: -1 | 1) => {
    const next = [...columns];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Filter fields"
          placeholder="Filter fields"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground" aria-live="polite">
          {columns.length} of {fields.length} visible
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([...columns, ...fields.map((f) => f.name).filter((n) => !visible.has(n))])}
          >
            Show all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Hide all
          </Button>
        </div>
      </div>
      <FieldError>{issues.get('tableConfig.columns')}</FieldError>
      <ul className="flex flex-col" aria-label="Columns">
        {shown.map((row) => {
          const index = row.visible ? columns.indexOf(row.name) : -1;
          const id = `${idPrefix}-${row.name}`;
          return (
            <li key={row.name} className="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 hover:bg-muted/60">
              <Checkbox id={id} checked={row.visible} onCheckedChange={(checked) => toggle(row.name, checked)} />
              <label htmlFor={id} className="flex min-w-0 flex-1 flex-col text-sm">
                <span className="truncate">{row.label}</span>
                {row.label !== row.name && (
                  <span className="truncate font-mono text-xs text-muted-foreground">{row.name}</span>
                )}
              </label>
              {row.visible && (
                <div className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${row.label} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${row.label} down`}
                    disabled={index === columns.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No fields match.</li>}
      </ul>
    </div>
  );
}
