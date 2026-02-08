import { useState, useEffect, useRef } from 'react';
import { useAddressSuggest } from '@/hooks/useAddressSuggest';
import type { SuggestResult } from '@/lib/types/property';

interface AddressSearchProps {
  onSelect: (suggestion: SuggestResult) => void;
  className?: string;
}

export function AddressSearch({ onSelect, className = '' }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the hook for debounced suggestions
  const { data: suggestions = [], isLoading } = useAddressSuggest(query);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
      return;
    }

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
          if (selected) {
            handleSelect(selected);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSelect = (suggestion: SuggestResult) => {
    setQuery(suggestion.weergavenaam);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    onSelect(suggestion);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(value.length >= 3);
    setHighlightedIndex(-1);
  };

  // Click outside handler
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Determine if dropdown should be visible
  const isDropdownVisible =
    showDropdown && query.length >= 3 && (suggestions.length > 0 || !isLoading);

  return (
    <div
      ref={containerRef}
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-[var(--z-search-bar)] w-full max-w-md px-4 ${className}`}
    >
      <div className="bg-black/30 backdrop-blur-md rounded-xl border border-white/20 shadow-lg p-3 flex items-center gap-3">
        {/* Search icon */}
        <svg
          className="w-5 h-5 text-white/70 flex-shrink-0"
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

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Zoek een adres..."
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/50 outline-none"
        />

        {/* Loading spinner */}
        {isLoading && query.length >= 3 && (
          <svg
            className="animate-spin w-4 h-4 text-white/50 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>

      {/* Dropdown */}
      {isDropdownVisible && (
        <ul className="bg-black/40 backdrop-blur-md rounded-xl border border-white/20 mt-1 shadow-lg overflow-hidden z-[var(--z-dropdown)] relative">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                onClick={() => handleSelect(suggestion)}
                className={`px-4 py-3 text-white/90 text-sm cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? 'bg-white/15'
                    : 'hover:bg-white/10'
                }`}
              >
                {suggestion.weergavenaam}
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-white/50 text-sm">
              Geen resultaten
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
