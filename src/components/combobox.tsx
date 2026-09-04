'use client';

import { useId, useState } from 'react';
import type { NamedRef } from '@/lib/types';

/**
 * Pick one, or type a new one.
 *
 * The database ships empty on purpose, so a plain <select> of existing clients
 * would be a control nobody can ever satisfy on the first project. This is a
 * native input backed by a datalist: picking and creating are the same gesture,
 * it works without JavaScript, and the caption tells you which one is about to
 * happen so "creates a new client" is never a surprise.
 *
 * The server resolves the name — see resolveRef in lib/actions.ts. Nothing here
 * is trusted.
 */
export function Combobox({
  name, label, options, placeholder, required, defaultValue, noun, error,
}: {
  name: string;
  label: string;
  options: NamedRef[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  /** What a new one would be, e.g. "client". Omit to suppress the caption. */
  noun?: string;
  error?: string;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue ?? '');

  const trimmed = value.trim();
  const known = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const isNew = Boolean(noun) && trimmed.length > 0 && !known;

  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-faint">*</span>}
      </span>
      <input
        name={name}
        list={listId}
        defaultValue={defaultValue}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line-strong"
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o.id} value={o.name} />)}
      </datalist>

      {error ? (
        <span className="mt-1 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{error}</span>
      ) : isNew ? (
        <span className="mt-1 block text-[11px] text-faint">
          New — a {noun} called “{trimmed}” will be created.
        </span>
      ) : known ? (
        <span className="mt-1 block text-[11px] text-faint">Existing {noun}.</span>
      ) : null}
    </label>
  );
}
