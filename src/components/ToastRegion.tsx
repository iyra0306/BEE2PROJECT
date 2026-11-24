import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';

export const ToastRegion: React.FC = () => {
  const { toasts, dismissToast } = useAppContext();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-xs w-full px-2 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto rounded-lg border border-white/12 bg-[#18211C] px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-3 text-xs text-[#E8F0EA]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  toast.tone === 'emerald' ? 'text-[#36C982]' : 'text-[#91A197]'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 text-[#91A197] hover:text-[#E8F0EA] transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
