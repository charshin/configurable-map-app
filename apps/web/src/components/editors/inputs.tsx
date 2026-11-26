'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TextInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>;

/**
 * Keeps the text the user is typing separately from the committed value, so
 * half-typed input ("", "-", "1.") doesn't get overwritten. Only text that
 * parses is committed; anything else marks the input invalid until fixed.
 */
function useBufferedText<T>(value: T, format: (value: T) => string, parse: (text: string) => T | null) {
  const [text, setText] = useState(() => format(value));
  const [committed, setCommitted] = useState(value);
  // The value changed from outside (Reset, another configuration): show it.
  if (!Object.is(value, committed)) {
    setCommitted(value);
    setText(format(value));
  }
  const valid = parse(text) !== null;
  const change = (next: string, commit: (value: T) => void) => {
    setText(next);
    const parsed = parse(next);
    if (parsed !== null) {
      setCommitted(parsed);
      commit(parsed);
    }
  };
  return { text, valid, change };
}

const parseNumber = (text: string) => {
  const trimmed = text.trim();
  const number = Number(trimmed);
  return trimmed !== '' && Number.isFinite(number) ? number : null;
};

export function NumberInput({
  value,
  onValueChange,
  invalid,
  ...props
}: TextInputProps & { value: number; onValueChange: (value: number) => void; invalid?: boolean }) {
  const { text, valid, change } = useBufferedText(value, String, parseNumber);
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={invalid || !valid || undefined}
      onChange={(event) => change(event.target.value, onValueChange)}
    />
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const parseHex = (text: string) => {
  const withHash = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
  return HEX.test(withHash) ? withHash.toLowerCase() : null;
};

/** A colour swatch (the native picker) next to a hex field, so colours can be typed too. */
export function ColorInput({
  value,
  onValueChange,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name, e.g. "Colour for stop 2". */
  label: string;
  className?: string;
}) {
  const { text, valid, change } = useBufferedText(value, (v) => v, parseHex);
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <input
        type="color"
        aria-label={`${label} picker`}
        value={value}
        onChange={(event) => change(event.target.value, onValueChange)}
        className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
      />
      <Input
        aria-label={label}
        value={text}
        aria-invalid={!valid || undefined}
        spellCheck={false}
        onChange={(event) => change(event.target.value, onValueChange)}
        className="font-mono"
      />
    </div>
  );
}
