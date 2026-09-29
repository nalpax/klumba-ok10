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

/** Предметная область («Математика и информатика») — у неё нет имени и отчества, только название. */
export function isArea(p: PersonName): boolean {
  return !p.firstName.trim() && !p.middleName.trim();
}

/** Иван Петрович — так к учителю обращаются в открытке; предметной области — «Дорогие учителя». */
export function addressName(p: PersonName): string {
  return isArea(p) ? 'Дорогие учителя' : [p.firstName, p.middleName].filter(Boolean).join(' ');
}

/** Две буквы для кружка: «МИ» для «Математика и информатика», «ДЛ» для «Дмитриева Любовь». */
export function initials(p: PersonName): string {
  if (!isArea(p)) return `${p.lastName.charAt(0)}${p.firstName.charAt(0)}`.toUpperCase();
  const words = p.lastName.split(/[\s-]+/).filter((w) => w.length > 2);
  return words.slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase();
}
