import type { Greeting } from '@/lib/content';
import { Leaf } from './Leaf';

export function GreetingCard({ greeting }: { greeting: Greeting }) {
  const paragraphs = greeting.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section className="section" id="greeting" aria-labelledby="greeting-title">
      <div className="section__inner">
        <article className="letter">
          <Leaf shape="maple" color="#c8321f" className="letter__leaf letter__leaf--tl" />
          <Leaf shape="ovate" color="#ee8a2b" className="letter__leaf letter__leaf--tr" />
          <Leaf shape="ovate" color="#7a2e6b" className="letter__leaf letter__leaf--bl" />
          <Leaf shape="maple" color="#f2b33d" className="letter__leaf letter__leaf--br" />

          <h2 className="letter__title" id="greeting-title">
            {greeting.title}
          </h2>
          <div className="letter__body">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="letter__sign">{greeting.signature}</p>
          {greeting.extra ? <p className="letter__extra">{greeting.extra}</p> : null}
        </article>
      </div>
    </section>
  );
}
