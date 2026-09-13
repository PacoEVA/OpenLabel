import React, { useState, useRef, useEffect } from 'react';
import { Braces, Hash, Calendar, Type, FileText } from 'lucide-react';
import { DataField } from '../../../core/data/data.schema';

interface InsertVariableDropdownProps {
  fields: DataField[];
  onInsert: (placeholder: string) => void;
  disabled?: boolean;
}

export const InsertVariableDropdown: React.FC<InsertVariableDropdownProps> = ({
  fields,
  onInsert,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectField = (field: DataField) => {
    onInsert(`{${field.name}}`);
    setIsOpen(false);
  };

  const getIcon = (type: DataField['type']) => {
    switch (type) {
      case 'counter':
        return <Hash className="w-3 h-3 text-blue-400" />;
      case 'date':
        return <Calendar className="w-3 h-3 text-emerald-400" />;
      case 'input':
        return <Type className="w-3 h-3 text-amber-400" />;
      case 'static':
        return <FileText className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title="Insert Variable Placeholder"
        className="flex items-center space-x-1 px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700/60 text-2xs font-medium transition-colors disabled:opacity-40"
      >
        <Braces className="w-3 h-3 text-blue-400" />
        <span>+ Variable</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 text-xs select-none max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-2xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
            Available Variables
          </div>
          {fields.length === 0 ? (
            <div className="px-3 py-2 text-zinc-500 italic text-2xs">
              No variables defined. Add fields in Data tab.
            </div>
          ) : (
            fields.map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => handleSelectField(field)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-zinc-800/80 transition-colors group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  {getIcon(field.type)}
                  <span className="font-mono text-zinc-200 group-hover:text-white text-2xs">
                    {`{${field.name}}`}
                  </span>
                </div>
                <span className="text-3xs uppercase tracking-wider text-zinc-500 bg-zinc-800/70 px-1 py-0.2 rounded ml-1">
                  {field.type}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
