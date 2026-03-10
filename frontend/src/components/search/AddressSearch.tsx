import { useState, useEffect, useRef } from 'react';
import { useAddressSuggest } from '@/hooks/useAddressSuggest';
import type { SuggestResult } from '@/lib/types/property';

interface AddressSearchProps {
  onSelect: (suggestion: SuggestResult) => void;
  className?: string;
}

export function AddressSearch({ onSelect, className = '' }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [], isLoading } = useAddressSuggest(query);

  const handleExpand = () => {
    setExpanded(true);
    // Focus input after render
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleCollapse = () => {
    setExpanded(false);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showDropdown) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      } else {
        handleCollapse();
      }
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
    setExpanded(false);
    onSelect(suggestion);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(value.length >= 3);
    setHighlightedIndex(-1);
  };

  // Click outside → collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (expanded && !query) {
          handleCollapse();
        } else {
          setShowDropdown(false);
          setHighlightedIndex(-1);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, query]);

  const isDropdownVisible =
    showDropdown && query.length >= 3 && (suggestions.length > 0 || !isLoading);

  // Collapsed: just the icon button
  if (!expanded) {
    return (
      <div className={`absolute top-6 left-4 md:left-[112px] z-[var(--z-search-bar)] ${className}`}>
        <button
          onClick={handleExpand}
          className="aura-hover-glow flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-aura-glass-white/60 backdrop-blur-md shadow-glass transition-colors hover:bg-aura-glass-white/60"
        >
          <SearchIcon />
        </button>
      </div>
    );
  }

  // Expanded: input with dropdown
  return (
    <div
      ref={containerRef}
      className={`absolute top-6 left-4 md:left-[112px] z-[var(--z-search-bar)] w-80 md:w-[320px] transition-all duration-300 ${className}`}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/40 bg-aura-glass-white/60 backdrop-blur-md p-2.5 shadow-glass">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Zoek een adres..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="address-search"
          data-lpignore="true"
          data-1p-ignore="true"
          className="flex-1 bg-transparent text-sm text-aura-ink placeholder:text-neutral-500 outline-none"
        />
        {isLoading && query.length >= 3 && <Spinner />}
        <button
          onClick={handleCollapse}
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 transition-colors hover:text-aura-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {isDropdownVisible && (
        <ul className="relative z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-xl border border-white/40 bg-aura-glass-white/60 backdrop-blur-md shadow-glass">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                onClick={() => handleSelect(suggestion)}
                className={`cursor-pointer px-4 py-3 text-sm text-aura-ink transition-colors ${
                  highlightedIndex === index
                    ? 'bg-aura-glass-white/40'
                    : 'hover:bg-aura-glass-white/40'
                }`}
              >
                {suggestion.weergavenaam}
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-neutral-600">
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
      className="h-5 w-5 shrink-0 text-neutral-600"
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
    <svg className="h-4 w-4 shrink-0 animate-spin text-neutral-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
