import React from 'react';
import { createPortal } from 'react-dom';

export type EventTimeTooltipState = {
  open: boolean;
  text: string;
  x: number;
  y: number;
};

type MousePositionEvent = Pick<MouseEvent, 'clientX' | 'clientY'>;

const TOOLTIP_OFFSET = 12;
const TOOLTIP_MAX_WIDTH = 220;
const TOOLTIP_MAX_HEIGHT = 44;

const clampValue = (value: number, min: number, max: number) => {
  if (max <= min) return min;
  return Math.min(Math.max(value, min), max);
};

const toValidDate = (value?: Date | string | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const useEventTimeTooltip = () => {
  const [tooltip, setTooltip] = React.useState<EventTimeTooltipState>({
    open: false,
    text: '',
    x: 0,
    y: 0,
  });

  const timeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    []
  );

  const show = React.useCallback(
    (event: MousePositionEvent | React.MouseEvent | null, startDate?: Date | null, endDate?: Date | null) => {
      if (!event) return;
      const start = toValidDate(startDate);
      const end = toValidDate(endDate) || start;
      if (!start || !end) return;

      const formatted = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
      const baseX = event.clientX + TOOLTIP_OFFSET;
      const baseY = event.clientY + TOOLTIP_OFFSET;

      if (typeof window === 'undefined') {
        setTooltip({ open: true, text: formatted, x: baseX, y: baseY });
        return;
      }

      const maxX = window.innerWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_OFFSET;
      const maxY = window.innerHeight - TOOLTIP_MAX_HEIGHT - TOOLTIP_OFFSET;
      const x = clampValue(baseX, TOOLTIP_OFFSET, maxX);
      const y = clampValue(baseY, TOOLTIP_OFFSET, maxY);

      setTooltip({ open: true, text: formatted, x, y });
    },
    [timeFormatter]
  );

  const hide = React.useCallback(() => {
    setTooltip((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  return { tooltip, show, hide };
};

export const EventTimeTooltip = ({ tooltip }: { tooltip: EventTimeTooltipState }) => {
  if (!tooltip?.open || !tooltip.text) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: tooltip.x,
    top: tooltip.y,
    zIndex: 50,
    pointerEvents: 'none',
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(8px)',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.2,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    whiteSpace: 'nowrap',
  };

  return createPortal(<div style={style}>{tooltip.text}</div>, document.body);
};
