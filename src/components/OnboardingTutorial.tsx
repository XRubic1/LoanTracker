import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PageId } from '@/types';
import {
  buildTutorialSteps,
  clearTutorialCompleted,
  getTutorialProgressLabel,
  hasCompletedTutorial,
  markTutorialCompleted,
  ONBOARDING_TUTORIAL_ENABLED,
  type TutorialStep,
} from '@/lib/onboardingTutorial';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingTutorialProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  /** Increment to restart the tour (e.g. from “Show tour”). */
  replayToken?: number;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function queryTarget(selector: string): Element | null {
  return document.querySelector(`[data-tour="${selector}"]`);
}

/** First-login product tour with spotlight highlights. */
export function OnboardingTutorial({ page, onNavigate, replayToken = 0 }: OnboardingTutorialProps) {
  const { user, userRole, isOwner, isPlatformAdmin, memberAllowedPages, company } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const steps = user
    ? buildTutorialSteps({
        userRole,
        isOwner,
        showAdmin: isPlatformAdmin,
        allowedPages: memberAllowedPages,
        companyName: company?.name ?? null,
      })
    : [];

  const step = steps[stepIndex] as TutorialStep | undefined;

  const measureTarget = useCallback(() => {
    if (!step?.tourTarget) {
      setTargetRect(null);
      return;
    }
    const el = queryTarget(step.tourTarget);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [step?.tourTarget]);

  useEffect(() => {
    if (!ONBOARDING_TUTORIAL_ENABLED || !user?.id) return;
    if (replayToken > 0) {
      clearTutorialCompleted(user.id);
      setStepIndex(0);
      setActive(true);
      return;
    }
    if (hasCompletedTutorial(user.id)) return;
    const t = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(t);
  }, [user?.id, replayToken]);

  useEffect(() => {
    if (!active || !step?.page) return;
    if (page !== step.page) onNavigate(step.page);
  }, [active, step?.page, stepIndex, page, onNavigate]);

  useLayoutEffect(() => {
    if (!active) return;
    measureTarget();
    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const t = window.setTimeout(measureTarget, 120);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, stepIndex, step?.tourTarget, page, measureTarget]);

  const complete = useCallback(() => {
    if (user?.id) markTutorialCompleted(user.id);
    setActive(false);
  }, [user?.id]);

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      complete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  if (!ONBOARDING_TUTORIAL_ENABLED || !active || !step || steps.length === 0) return null;

  const isCenter = step.placement === 'center' || !step.tourTarget;
  const pad = 8;
  const spotlight = targetRect && !isCenter
    ? {
        top: targetRect.top - pad,
        left: targetRect.left - pad,
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2,
      }
    : null;

  let tooltipStyle: React.CSSProperties = {};
  if (isCenter) {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 400,
    };
  } else if (spotlight) {
    const gap = 12;
    const preferBottom = step.placement !== 'top';
    if (preferBottom) {
      tooltipStyle = {
        top: spotlight.top + spotlight.height + gap,
        left: Math.max(16, Math.min(spotlight.left, window.innerWidth - 360)),
        maxWidth: 340,
      };
    } else {
      tooltipStyle = {
        top: Math.max(16, spotlight.top - gap - 160),
        left: Math.max(16, Math.min(spotlight.left, window.innerWidth - 360)),
        maxWidth: 340,
      };
    }
  } else {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 400,
    };
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-page/70 backdrop-blur-[1px]" aria-hidden />

      {/* Spotlight cutout */}
      {spotlight && (
        <div
          className="absolute rounded-lg ring-2 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute z-[201] panel-surface border border-accent/30 shadow-2xl rounded-xl p-5 animate-fade-in"
        style={tooltipStyle}
      >
        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
          {getTutorialProgressLabel(stepIndex, steps.length)}
        </p>
        <h2 id="tutorial-title" className="text-[16px] font-semibold text-ink mb-2">
          {step.title}
        </h2>
        <p className="text-[13px] text-muted2 leading-relaxed mb-4">{step.body}</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={complete}
            className="text-[12px] text-muted2 hover:text-ink"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="py-1.5 px-3 rounded-lg border border-border text-[12px] text-ink hover:border-accent/40"
              >
                Back
              </button>
            )}
            <button type="button" onClick={goNext} className="btn-primary text-[12px] py-1.5 px-4">
              {stepIndex >= steps.length - 1 ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Button to replay the tour (e.g. in toolbar). */
export function ReplayTourButton({ onReplay }: { onReplay: () => void }) {
  if (!ONBOARDING_TUTORIAL_ENABLED) return null;

  return (
    <button
      type="button"
      onClick={onReplay}
      className="text-[12px] text-muted hover:text-accent transition-colors whitespace-nowrap"
      title="Show the product tour again"
    >
      Show tour
    </button>
  );
}
