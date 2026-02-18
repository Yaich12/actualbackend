import React from 'react';

type LoomEmbedProps = {
  videoId: string;
  title?: string;
};

export default function LoomEmbed({ videoId, title = 'Loom video' }: LoomEmbedProps) {
  return (
    <div className="hero-devices__loom">
      <iframe
        className="hero-devices__loom-frame"
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
