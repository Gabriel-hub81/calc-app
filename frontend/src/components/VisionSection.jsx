import { NotebookPen, Users, MessageCircle } from 'lucide-react';
import { useLang } from '../lib/i18n';

/** Cards honestas de lo que viene — comunican la visión sin prometer de más. */
export default function VisionSection() {
  const { t } = useLang();
  const cards = [
    { icon: NotebookPen, titulo: t.vision1t, desc: t.vision1d },
    { icon: Users, titulo: t.vision2t, desc: t.vision2d },
    { icon: MessageCircle, titulo: t.vision3t, desc: t.vision3d }
  ];
  return (
    <section className="mt-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t.visionTitle}
      </p>
      <div className="grid gap-2">
        {cards.map(({ icon: Icon, titulo, desc }) => (
          <div
            key={titulo}
            className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3"
          >
            <Icon className="mt-0.5 h-5 w-5 text-calc-dark" />
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {titulo}{' '}
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {t.comingSoon}
                </span>
              </p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
