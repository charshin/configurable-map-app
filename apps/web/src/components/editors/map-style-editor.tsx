'use client';

import {
  type ColorStop,
  type Configuration,
  type DatasetFieldDto,
  MAX_STOPS,
  MAX_SYMBOL_SIZE,
  MIN_SYMBOL_SIZE,
  type SizeStop,
} from '@confmap/shared';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ColorInput, NumberInput } from './inputs';
import type { Issues } from './issues';

type SymbolConfig = Configuration['symbolConfig'];
type ColorVariable = NonNullable<SymbolConfig['color']>;
type SizeVariable = NonNullable<SymbolConfig['size']>;

interface MapStyleEditorProps {
  symbolConfig: SymbolConfig;
  fields: DatasetFieldDto[];
  issues: Issues;
  onChange: (symbolConfig: SymbolConfig) => void;
}

/** Point symbology: colour and/or size driven by a numeric field, each with value stops. */
export function MapStyleEditor({ symbolConfig, fields, issues, onChange }: MapStyleEditorProps) {
  const numericFields = fields.filter((field) => field.numeric);

  return (
    <div className="flex flex-col gap-6">
      <FieldError>{issues.get('symbolConfig')}</FieldError>
      <VariableSection
        kind="color"
        title="Colour"
        description="Colour points by a numeric field."
        variable={symbolConfig.color}
        initial={(field) => ({
          field,
          stops: [
            { value: 0, color: '#ffffff' },
            { value: 100, color: '#2f7d4f' },
          ],
        })}
        onChange={(color) => onChange({ ...symbolConfig, color })}
        locked={symbolConfig.size === undefined}
        otherField={symbolConfig.size?.field}
        otherTitle="size"
        fields={numericFields}
        issues={issues}
      >
        {(variable, update) => <ColorStops variable={variable} update={update} issues={issues} />}
      </VariableSection>
      <VariableSection
        kind="size"
        title="Size"
        description="Size points by a numeric field."
        variable={symbolConfig.size}
        initial={(field) => ({
          field,
          stops: [
            { value: 0, size: 4 },
            { value: 100, size: 20 },
          ],
        })}
        onChange={(size) => onChange({ ...symbolConfig, size })}
        locked={symbolConfig.color === undefined}
        otherField={symbolConfig.color?.field}
        otherTitle="colour"
        fields={numericFields}
        issues={issues}
      >
        {(variable, update) => <SizeStops variable={variable} update={update} issues={issues} />}
      </VariableSection>
    </div>
  );
}

function VariableSection<V extends ColorVariable | SizeVariable>({
  kind,
  title,
  description,
  variable,
  initial,
  onChange,
  locked,
  otherField,
  otherTitle,
  fields,
  issues,
  children,
}: {
  kind: 'color' | 'size';
  title: string;
  description: string;
  variable: V | undefined;
  /** A fresh variable on the given field, for the first time it's turned on. */
  initial: (field: string) => V;
  onChange: (variable: V | undefined) => void;
  /** The other variable is off, so this one can't be turned off too. */
  locked: boolean;
  /** The field the other variable uses (when on). It can't be picked here too. */
  otherField: string | undefined;
  otherTitle: 'colour' | 'size';
  fields: DatasetFieldDto[];
  issues: Issues;
  children: (variable: V, update: (variable: V) => void) => React.ReactNode;
}) {
  // Turning a variable off and on again brings back what it was.
  const [lastVariable, setLastVariable] = useState(variable);
  if (variable && variable !== lastVariable) setLastVariable(variable);

  // Unique per instance, since a hidden preserved page can render the same editor.
  const id = useId();
  const switchId = `${id}-enabled`;
  const fieldId = `${id}-field`;
  const items = fields.map((field) => ({ value: field.name, label: field.alias || field.name }));
  const freeField = fields.find((field) => field.name !== otherField)?.name ?? '';

  // Turning on brings back the last setup (or a fresh one), moved to a free
  // field if the other variable has taken its field in the meantime.
  const turnOn = (): V => {
    const next = lastVariable ?? initial(freeField);
    return next.field === otherField ? { ...next, field: freeField } : next;
  };

  return (
    <FieldSet>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FieldLegend variant="label" className="mb-0">
            {title}
          </FieldLegend>
          <FieldDescription id={`${id}-description`}>
            {variable !== undefined && locked
              ? `${description} Turn on ${kind === 'color' ? 'size' : 'colour'} to switch this off.`
              : description}
          </FieldDescription>
        </div>
        <Switch
          id={switchId}
          aria-label={`${title} by field`}
          aria-describedby={`${id}-description`}
          checked={variable !== undefined}
          disabled={variable !== undefined && locked}
          onCheckedChange={(checked) => onChange(checked ? turnOn() : undefined)}
        />
      </div>
      {variable && (
        <>
          <Field data-invalid={issues.has(`symbolConfig.${kind}.field`) || undefined}>
            <FieldLabel htmlFor={fieldId}>Field</FieldLabel>
            <Select
              items={items}
              value={variable.field}
              onValueChange={(field) => field && onChange({ ...variable, field })}
            >
              <SelectTrigger id={fieldId} className="w-full">
                <SelectValue placeholder="Choose a numeric field" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => {
                  const taken = item.value === otherField;
                  return (
                    <SelectItem key={item.value} value={item.value} disabled={taken}>
                      <span className="truncate">{item.label}</span>
                      {taken && (
                        <span className="ml-auto text-xs text-muted-foreground">Used for {otherTitle}</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FieldError>{issues.get(`symbolConfig.${kind}.field`)}</FieldError>
          </Field>
          {children(variable, (next) => onChange(next))}
          <FieldError>{issues.get(`symbolConfig.${kind}.stops`)}</FieldError>
        </>
      )}
    </FieldSet>
  );
}

/** Inserts a stop after the last one, continuing the spacing of the last two. */
function nextValue(stops: { value: number }[]): number {
  const last = stops.at(-1)?.value ?? 0;
  const previous = stops.at(-2)?.value ?? last - 1;
  return last + Math.max(last - previous, 1);
}

function StopRow({
  index,
  count,
  value,
  onValue,
  valueIssue,
  onRemove,
  children,
}: {
  index: number;
  count: number;
  value: number;
  onValue: (value: number) => void;
  valueIssue: string | undefined;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <NumberInput
          aria-label={`Value for stop ${index + 1}`}
          value={value}
          onValueChange={onValue}
          invalid={valueIssue !== undefined}
          className="w-24 shrink-0"
        />
        {children}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove stop ${index + 1}`}
          disabled={count <= 2}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      {valueIssue && <FieldError>{valueIssue}</FieldError>}
    </li>
  );
}

function ColorStops({
  variable,
  update,
  issues,
}: {
  variable: ColorVariable;
  update: (variable: ColorVariable) => void;
  issues: Issues;
}) {
  const { stops } = variable;
  const setStop = (index: number, stop: Partial<ColorStop>) =>
    update({ ...variable, stops: stops.map((s, i) => (i === index ? { ...s, ...stop } : s)) });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Stops</span>
      <div
        aria-hidden
        className="h-3 rounded-full border"
        style={{ background: `linear-gradient(to right, ${stops.map((s) => s.color).join(', ')})` }}
      />
      <ol className="flex flex-col gap-2">
        {stops.map((stop, index) => (
          <StopRow
            key={index}
            index={index}
            count={stops.length}
            value={stop.value}
            onValue={(value) => setStop(index, { value })}
            valueIssue={issues.get(`symbolConfig.color.stops.${index}.value`)}
            onRemove={() => update({ ...variable, stops: stops.filter((_, i) => i !== index) })}
          >
            <ColorInput
              label={`Colour for stop ${index + 1}`}
              value={stop.color}
              onValueChange={(color) => setStop(index, { color })}
              className="min-w-0 flex-1"
            />
          </StopRow>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={stops.length >= MAX_STOPS}
        onClick={() =>
          update({
            ...variable,
            stops: [...stops, { value: nextValue(stops), color: stops.at(-1)?.color ?? '#2f7d4f' }],
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        Add stop
      </Button>
    </div>
  );
}

function SizeStops({
  variable,
  update,
  issues,
}: {
  variable: SizeVariable;
  update: (variable: SizeVariable) => void;
  issues: Issues;
}) {
  const { stops } = variable;
  const setStop = (index: number, stop: Partial<SizeStop>) =>
    update({ ...variable, stops: stops.map((s, i) => (i === index ? { ...s, ...stop } : s)) });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Stops</span>
      <div aria-hidden className="flex h-10 items-center gap-3 rounded-md border px-3">
        {stops.map((stop, index) => {
          const px = Math.min(Math.max(stop.size, MIN_SYMBOL_SIZE), 32);
          return <span key={index} className="shrink-0 rounded-full bg-primary/70" style={{ width: px, height: px }} />;
        })}
      </div>
      <ol className="flex flex-col gap-2">
        {stops.map((stop, index) => {
          const sizeIssue = issues.get(`symbolConfig.size.stops.${index}.size`);
          return (
            <StopRow
              key={index}
              index={index}
              count={stops.length}
              value={stop.value}
              onValue={(value) => setStop(index, { value })}
              valueIssue={issues.get(`symbolConfig.size.stops.${index}.value`) ?? sizeIssue}
              onRemove={() => update({ ...variable, stops: stops.filter((_, i) => i !== index) })}
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <NumberInput
                  aria-label={`Size in pixels for stop ${index + 1}`}
                  value={stop.size}
                  onValueChange={(size) => setStop(index, { size })}
                  invalid={sizeIssue !== undefined}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </StopRow>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Sizes from {MIN_SYMBOL_SIZE} to {MAX_SYMBOL_SIZE} px.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={stops.length >= MAX_STOPS}
        onClick={() =>
          update({ ...variable, stops: [...stops, { value: nextValue(stops), size: stops.at(-1)?.size ?? 8 }] })
        }
      >
        <PlusIcon data-icon="inline-start" />
        Add stop
      </Button>
    </div>
  );
}
