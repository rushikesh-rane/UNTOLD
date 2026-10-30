'use client';

import { Sparkles } from 'lucide-react';
import { OPEN_TUTORIAL_EVENT } from '@/components/WelcomeTutorial';

export default function ReplayTutorialButton() {
  return (
    <button type="button" className="how-cta how-replay" onClick={() => window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT))}>
      <Sparkles size={15} /> Take the quick tour
    </button>
  );
}
