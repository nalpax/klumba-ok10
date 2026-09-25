import type { ReactNode } from 'react';
import { FlowerPreview } from '@/components/garden/FlowerPreview';
import { HowLogin } from './HowLogin';

const DOTS = [
  [22, 40], [48, 30], [74, 46], [104, 34], [130, 50], [158, 38], [188, 48],
  [34, 62], [64, 66], [96, 60], [124, 72], [152, 64], [180, 70],
  [50, 84], [82, 88], [112, 82], [142, 90], [170, 84],
];
const DOT_COLORS = ['#E03131', '#F4C20D', '#9B4DCA', '#2F7CD8', '#F08A24', '#D6337F'];

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconTicket = () => (
  <Svg>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
    <path d="M14 6v2M14 11v2M14 16v2" />
  </Svg>
);
const IconKey = () => (
  <Svg>
    <circle cx="8" cy="15" r="3.6" />
    <path d="M10.6 12.4 19 4M15.5 7.5l2.5 2.5M13 10l2 2" />
  </Svg>
);
const IconFlower = () => (
  <Svg>
    <circle cx="12" cy="9" r="2.2" />
    <path d="M12 6.8C12 4 10.5 3 9 3.6c-1.6.7-1.4 2.6 0 3.6M14.2 9c2.8 0 3.8-1.5 3.2-3-.7-1.6-2.6-1.4-3.6 0M12 11.2c0 2.8 1.5 3.8 3 3.2 1.6-.7 1.4-2.6 0-3.6M9.8 9C7 9 6 10.5 6.6 12c.7 1.6 2.6 1.4 3.6 0" />
    <path d="M12 13v8M12 18c-2.5 0-4-1-4.5-2.5M12 17c2.2 0 3.6-.8 4.2-2.2" />
  </Svg>
);
const IconSprout = () => (
  <Svg>
    <path d="M12 21v-8" />
    <path d="M12 13c0-4-3-6.5-7-6.5 0 4 2.6 6.5 7 6.5ZM12 15c0-3 2.4-5.5 7-5.5 0 3.4-2.6 5.5-7 5.5Z" />
    <path d="M8 21h8" />
  </Svg>
);

const SWATCHES = ['#E03131', '#F783AC', '#F5C518', '#2F6FDE', '#7950F2', '#F8F4E8'];

export function HowItWorks() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="section__inner">
        <header className="section__head">
          <h2 className="section__title" id="how-title">
            Как это работает
          </h2>
        </header>

        <ol className="steps">
          <li className="step glass">
            <div className="step__head">
              <span className="step__icon"><IconTicket /></span>
              <h3>Получи свой код</h3>
            </div>
            <div className="step__art" aria-hidden="true">
              <div className="code-chip">
                <span>HK7PE</span>
                <i />
                <span>3XWCY</span>
              </div>
            </div>
          </li>

          <li className="step glass">
            <div className="step__head">
              <span className="step__icon"><IconKey /></span>
              <h3>Войди в аккаунт по коду</h3>
            </div>
            <div className="step__art" aria-hidden="true">
              <div className="mock-login">
                <div className="mock-login__field">HK7PE-3XWCY</div>
                <div className="mock-login__btn">Войти</div>
              </div>
            </div>
          </li>

          <li className="step glass">
            <div className="step__head">
              <span className="step__icon"><IconFlower /></span>
              <h3>Выбери цвет, учителя и цветок</h3>
            </div>
            <div className="step__art step__art--flowers">
              <div className="step__flowers">
                <FlowerPreview kind="tulip" color="#E03131" height={104} />
                <FlowerPreview kind="rose" color="#F783AC" height={104} />
                <FlowerPreview kind="cornflower" color="#2F6FDE" height={104} />
              </div>
              <div className="mini-swatches" aria-hidden="true">
                {SWATCHES.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </div>
            </div>
          </li>

          <li className="step glass">
            <div className="step__head">
              <span className="step__icon"><IconSprout /></span>
              <h3>Посади на клумбе</h3>
            </div>
            <div className="step__art" aria-hidden="true">
              <svg viewBox="0 0 210 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="105" cy="66" rx="98" ry="46" fill="#245c26" />
                <ellipse cx="105" cy="66" rx="98" ry="46" fill="none" stroke="#4b3322" strokeWidth="3" />
                {DOTS.map(([x, y], i) => (
                  <circle key={i} cx={x + 4} cy={y + 2} r="3.2" fill={DOT_COLORS[i % DOT_COLORS.length]} />
                ))}
                <circle cx="118" cy="58" r="11" fill="none" stroke="#c9f26b" strokeWidth="1.6" opacity="0.9" />
                <circle cx="118" cy="58" r="4" fill="#c9f26b" />
              </svg>
            </div>
          </li>
        </ol>

        <HowLogin />
      </div>
    </section>
  );
}
