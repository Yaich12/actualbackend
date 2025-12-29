import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

function Manifesto() {
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
          <p>Vi fandt ud af, at et professionelt system ikke behøver koste en formue.</p>
          <p>Ingen dyre hjemmesider. Ingen tunge IT-systemer.</p>
          <p>Vi valgte at bygge det selv, fordi vi kunne gøre det bedre.</p>
          <p className="font-semibold text-blue-600">Velkommen til Selma+.</p>
        </div>
      </motion.div>
    </section>
  );
}

export default Manifesto;
