import { SCHOOL } from '@/lib/content';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <img src={SCHOOL.emblem} alt="" width={56} height={56} />
        <p className="footer__school">
          <span>{SCHOOL.complex}</span>
          <span>{SCHOOL.city}</span>
        </p>
        <p className="footer__note">Наша клумба, День учителя 2026</p>
      </div>
    </footer>
  );
}
