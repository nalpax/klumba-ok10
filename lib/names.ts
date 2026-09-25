export interface PersonName {
  lastName: string;
  firstName: string;
  middleName: string;
}

/** Иванов Иван Петрович */
export function fullName(p: PersonName): string {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

/** Иванов И. П. */
export function shortName(p: PersonName): string {
  const initial = (s: string) => (s ? `${s.charAt(0).toUpperCase()}.` : '');
  return [p.lastName, [initial(p.firstName), initial(p.middleName)].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' ');
}

/** Иван Петрович — так к учителю обращаются в открытке. */
export function addressName(p: PersonName): string {
  return [p.firstName, p.middleName].filter(Boolean).join(' ');
}
