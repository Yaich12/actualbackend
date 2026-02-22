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
    <div className={wrapperClassName}>
      <iframe
        className={iframeClassName}
        src={`https://www.loom.com/embed/${videoId}`}
        title={title}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
