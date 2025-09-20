import React from 'react';
import { TableOfContentsItem } from '@/lib/articles';
import { ChevronRight } from 'lucide-react';

interface TableOfContentsProps {
  items: TableOfContentsItem[];
  className?: string;
}

export default function TableOfContents({ items, className = '' }: TableOfContentsProps) {
  if (items.length === 0) return null;

  const renderTOCItem = (item: TableOfContentsItem, depth = 0) => (
    <li key={item.id} className={`${depth > 0 ? 'ml-4' : ''}`}>
      <a
        href={`#${item.id}`}
        className="flex items-center gap-2 py-1 text-sm hover:text-accent transition-colors group"
      >
        {depth > 0 && (
          <ChevronRight className="size-3 text-muted group-hover:text-accent transition-colors" />
        )}
        <span className={depth === 0 ? 'font-medium' : 'text-muted'}>{item.text}</span>
      </a>
      {item.children && item.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {item.children.map((child) => renderTOCItem(child, depth + 1))}
        </ul>
      )}
    </li>
  );

  return (
    <div className={`bg-white border border-accent/10 rounded-xl p-6 ${className}`}>
      <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-4 bg-accent rounded-full"></span>
        Table of Contents
      </h3>
      <nav>
        <ul className="space-y-2">{items.map((item) => renderTOCItem(item))}</ul>
      </nav>
    </div>
  );
}
