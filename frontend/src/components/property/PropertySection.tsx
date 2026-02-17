import { useState } from 'react';

interface PropertySectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function PropertySection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-grey-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-grey-100 hover:bg-grey-850 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="mr-2 text-grey-400">{icon}</span>}
          <span className="font-medium text-sm">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-4 h-4 text-grey-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 text-grey-300 text-sm">{children}</div>
      </div>
    </div>
  );
}

export default PropertySection;
