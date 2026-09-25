import { SCHOOL } from '@/lib/content';

/** Знак образовательного комплекса: жёлтый ромб с книгой + название. */
export function SchoolBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`school-badge ${className}`.trim()}>
      <svg className="school-badge__mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <rect x="8.5" y="8.5" width="31" height="31" rx="7" transform="rotate(45 24 24)" fill="#F5B400" />
        <g transform="translate(12 12)">
          <path
            d="M12 6.3C10.4 5.2 8 4.6 4.5 4.8v12.4c3.5-.2 5.9.4 7.5 1.5 1.6-1.1 4-1.7 7.5-1.5V4.8c-3.5-.2-5.9.4-7.5 1.5Z"
            fill="#fff"
          />
          <path d="M12 6.6v11.8" stroke="#F5B400" strokeWidth="1.3" />
        </g>
      </svg>
      <p className="school-badge__text">
        <span>{SCHOOL.complex}</span>
        <span>{SCHOOL.city}</span>
      </p>
    </div>
  );
}
