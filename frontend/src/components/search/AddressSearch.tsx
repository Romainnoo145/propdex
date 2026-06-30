import { useState, useEffect, useRef } from 'react';
import { useAddressSuggest } from '@/hooks/useAddressSuggest';
import type { SuggestResult } from '@/lib/types/property';

interface AddressSearchProps {
  onSelect: (suggestion: SuggestResult) => void;
  className?: string;
  /** Fill the available width (Verkenner gate field) instead of the fixed
   *  270px used inside the map command-bar. */
  fullWidth?: boolean;
}

export function AddressSearch({ onSelect, className = '', fullWidth = false }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [], isLoading } = useAddressSuggest(query);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          const selected = suggestions[highlightedIndex];
          if (selected) handleSelect(selected);
        }
        break;
    }
  };

  const handleSelect = (suggestion: SuggestResult) => {
    setQuery('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
    onSelect(suggestion);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(value.length >= 3);
    setHighlightedIndex(-1);
  };

  // Click outside → close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDropdownVisible =
    showDropdown && query.length >= 3 && (suggestions.length > 0 || !isLoading);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Zoek perceel of adres..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="address-search"
          data-lpignore="true"
          data-1p-ignore="true"
          className={`${fullWidth ? 'w-full' : 'w-[270px]'} bg-transparent text-sm text-aura-ink placeholder:text-slate-400 outline-none`}
        />
        {isLoading && query.length >= 3 && <Spinner />}
        {query && (
          <button
            onClick={() => { setQuery(''); setShowDropdown(false); }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:text-aura-ink"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown — positioned below the entire Command Center */}
      {isDropdownVisible && (
        <ul className={`absolute top-full left-0 z-[var(--z-dropdown)] mt-3 ${fullWidth ? 'w-full' : 'w-[320px]'} max-h-[220px] overflow-y-auto rounded-2xl border border-white/40 bg-white/70 backdrop-blur-2xl shadow-lg`}>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                onClick={() => handleSelect(suggestion)}
                className={`cursor-pointer px-4 py-3 text-sm text-aura-ink transition-colors ${
                  highlightedIndex === index
                    ? 'bg-white/50'
                    : 'hover:bg-white/50'
                }`}
              >
                {suggestion.weergavenaam}
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-slate-500">
              Geen resultaten
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
