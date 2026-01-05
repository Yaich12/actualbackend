import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { useLanguage } from '../language/LanguageProvider';

function Manifesto() {
  const { t } = useLanguage();

  return (
    <section className="w-full bg-white py-16 sm:py-20">
      <motion.div
        className="relative mx-auto max-w-3xl px-6 text-slate-900"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        viewport={{ once: true, amount: 0.4 }}
      >
        <Quote
          className="pointer-events-none absolute -top-8 -left-4 h-16 w-16 text-slate-200 sm:h-20 sm:w-20"
          aria-hidden="true"
        />
        <div className="relative space-y-6 text-2xl font-serif font-medium leading-relaxed text-slate-800 sm:text-3xl">
          <p>{t('landing.manifesto.line1')}</p>
          <p>{t('landing.manifesto.line2')}</p>
          <p>{t('landing.manifesto.line3')}</p>
          <p className="font-semibold text-blue-600">{t('landing.manifesto.line4')}</p>
        </div>
      </motion.div>
    </section>
  );
}

export default Manifesto;
