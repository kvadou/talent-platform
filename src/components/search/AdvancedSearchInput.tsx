'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/Input';
import { getSearchSuggestions, validateSearchQuery, type SearchContext, type SearchSuggestion } from '@/lib/search';

interface AdvancedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchContext?: SearchContext;
  className?: string;
}

export function AdvancedSearchInput({
  value,
  onChange,
  placeholder = 'Search candidates...',
  loading = false,
  searchContext = {},
  className = '',
}: AdvancedSearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update suggestions when value changes
  useEffect(() => {
    if (value.length > 0) {
      const newSuggestions = getSearchSuggestions(value, searchContext);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [value, searchContext]);

  // Validate query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim()) {
        const validationErrors = validateSearchQuery(value);
        setErrors(validationErrors);
      } else {
        setErrors([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply a suggestion
  const applySuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'example') {
      onChange(suggestion.text);
    } else {
      // For field completions, replace the last partial word
      const words = value.split(/\s+/);
      const lastWord = words[words.length - 1] || '';

      if (suggestion.text.includes(':') && lastWord && !lastWord.includes(':')) {
        // User was typing a field name, replace it
        words[words.length - 1] = suggestion.text;
        onChange(words.join(' '));
      } else {
        // Append the suggestion
        const newValue = value.endsWith(' ') ? value + suggestion.text : value + ' ' + suggestion.text;
        onChange(newValue.trim());
      }
    }
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [onChange, value]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          applySuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input with icons */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length > 0 && setShowSuggestions(suggestions.length > 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-10 pr-20 ${errors.length > 0 ? 'border-warning-400 focus:border-warning-500 focus:ring-amber-500' : ''}`}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Loading spinner */}
          {loading && (
            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          )}

          {/* Error indicator */}
          {errors.length > 0 && !loading && (
            <div className="group relative">
              <ExclamationTriangleIcon className="w-5 h-5 text-warning-500 cursor-help" />
              <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-warning-50 border border-warning-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <p className="text-xs text-warning-700 font-medium">Syntax issues:</p>
                <ul className="text-xs text-warning-600 mt-1 space-y-0.5">
                  {errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Clear button */}
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {/* Help button */}
          <button
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className={`p-1 rounded transition-colors ${
              showCheatSheet ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-400'
            }`}
            title="Search syntax help"
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => applySuggestion(suggestion)}
              className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 ${
                index === selectedSuggestionIndex ? 'bg-purple-50' : ''
              }`}
            >
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                suggestion.type === 'field' ? 'bg-cyan-100 text-cyan-700' :
                suggestion.type === 'value' ? 'bg-success-100 text-success-700' :
                suggestion.type === 'operator' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {suggestion.type}
              </span>
              <span className="text-sm font-mono text-gray-900">{suggestion.text}</span>
              <span className="text-xs text-gray-500 ml-auto">{suggestion.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cheat sheet panel */}
      {showCheatSheet && (
        <div className="absolute top-full right-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Search Syntax</h3>
            <button
              onClick={() => setShowCheatSheet(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto text-sm">
            {/* Boolean */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-1">Boolean</h4>
              <div className="space-y-1 text-gray-600">
                <div><code className="text-purple-600">actor AND teacher</code> - both terms</div>
                <div><code className="text-purple-600">actor OR performer</code> - either term</div>
                <div><code className="text-purple-600">java NOT junior</code> - exclude term</div>
                <div><code className="text-purple-600">(react OR vue) AND typescript</code> - grouping</div>
              </div>
            </div>

            {/* Phrases */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-1">Exact Phrases</h4>
              <div className="text-gray-600">
                <div><code className="text-purple-600">&quot;customer success manager&quot;</code></div>
              </div>
            </div>

            {/* Fields */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-1">Field Search</h4>
              <div className="grid grid-cols-2 gap-1 text-gray-600">
                <div><code className="text-purple-600">status:active</code></div>
                <div><code className="text-purple-600">stage:&quot;Phone Screen&quot;</code></div>
                <div><code className="text-purple-600">tag:frontend</code></div>
                <div><code className="text-purple-600">source:linkedin</code></div>
                <div><code className="text-purple-600">location:NYC</code></div>
                <div><code className="text-purple-600">job:tutor</code></div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-1">Date Filters</h4>
              <div className="space-y-1 text-gray-600">
                <div><code className="text-purple-600">applied:&gt;7d</code> - last 7 days</div>
                <div><code className="text-purple-600">applied:&gt;30d</code> - last 30 days</div>
                <div><code className="text-purple-600">updated:&gt;2024-01-01</code> - after date</div>
              </div>
            </div>

            {/* Wildcards */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-1">Wildcards</h4>
              <div className="text-gray-600">
                <div><code className="text-purple-600">dev*</code> - developer, development, etc.</div>
              </div>
            </div>

            {/* Examples */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-2">Example Searches</h4>
              <div className="space-y-2">
                <button
                  onClick={() => { onChange('actor AND teacher location:LA'); setShowCheatSheet(false); }}
                  className="block w-full text-left px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded text-gray-700 font-mono text-xs"
                >
                  actor AND teacher location:LA
                </button>
                <button
                  onClick={() => { onChange('"early childhood" OR preschool status:active'); setShowCheatSheet(false); }}
                  className="block w-full text-left px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded text-gray-700 font-mono text-xs"
                >
                  &quot;early childhood&quot; OR preschool status:active
                </button>
                <button
                  onClick={() => { onChange('tag:frontend applied:>30d'); setShowCheatSheet(false); }}
                  className="block w-full text-left px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded text-gray-700 font-mono text-xs"
                >
                  tag:frontend applied:&gt;30d
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
