import { SCHOOL } from '@/lib/content';
import { LeafGarland, OakSprig, RowanSprig } from './Decor';

export function Footer() {
  return (
    <footer className="footer">
      <LeafGarland className="garland--footer" />
      <div className="footer__inner">
        <div className="footer__festive">
          <RowanSprig className="footer__sprig footer__sprig--left" />
          <div className="footer__center">
            <p className="footer__wish">С праздником, дорогие учителя!</p>
            <img src={SCHOOL.emblem} alt="" width={64} height={64} />
          </div>
          <OakSprig className="footer__sprig footer__sprig--right" />
        </div>
        <p className="footer__school">
          <span>{SCHOOL.complex}</span>
          <span>{SCHOOL.city}</span>
        </p>
        <p className="footer__note">Наша клумба, День учителя 2026</p>
      </div>
    </footer>
  );
}
