import React from 'react';

type LoomEmbedProps = {
  videoId: string;
  title?: string;
  className?: string;
  frameClassName?: string;
};

export default function LoomEmbed({
  videoId,
  title = 'Loom video',
  className,
  frameClassName,
}: LoomEmbedProps) {
  const wrapperClassName = ['hero-devices__loom', className].filter(Boolean).join(' ');
  const iframeClassName = ['hero-devices__loom-frame', frameClassName].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName} style={{ width: '100%', aspectRatio: '16 / 9' }}>
      <iframe
        className={iframeClassName}
        src={`https://www.loom.com/embed/${videoId}`}
        title={title}
        style={{ width: '100%', height: '100%', display: 'block', border: '0' }}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
