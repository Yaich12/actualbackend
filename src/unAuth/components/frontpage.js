import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./frontpage.css";

const clips = [
    "/Hero/4110584-uhd_3840_2160_30fps.mp4",
    "/Hero/4327192-uhd_4096_2160_25fps.mp4",
    "/Hero/4489829-uhd_3840_2160_25fps.mp4",
    "/Hero/5793441-uhd_3840_2160_25fps.mp4",
    "/Hero/5793444-uhd_3840_2160_25fps.mp4",
    "/Hero/6111110-uhd_3840_2160_25fps.mp4",
    "/Hero/11492178-uhd_3840_2160_50fps.mp4",
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ];

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          function Frontpage() {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const [active, setActive] = useState(0);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const [next, setNext] = useState(1);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const [isFading, setIsFading] = useState(false);

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const activeRef = useRef(null);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const nextRef = useRef(null);

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            useEffect(() => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              const n = (active + 1) % clips.length;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              setNext(n);

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              if (nextRef.current) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                nextRef.current.src = clips[n];
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                nextRef.current.load();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              }

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              if (activeRef.current?.paused) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                activeRef.current.play().catch(() => {});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            }, [active]);

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            const handleEnded = () => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              setIsFading(true);

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              nextRef.current?.play().catch(() => {});

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              setTimeout(() => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                setActive(next);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                setIsFading(false);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              }, 900);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            };

  return (
    <section className="frontpage">
      <div className="frontpage-video-bg" aria-hidden="true">
        <video
          ref={activeRef}
          className={`frontpage-video ${isFading ? "fade-out" : "fade-in"}`}
          src={clips[active]}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded}
        />

        <video
          ref={nextRef}
          className={`frontpage-video ${isFading ? "fade-in" : "fade-out"}`}
          src={clips[next]}
          muted
          playsInline
          preload="auto"
        />

        <div className="frontpage-video-overlay" />
      </div>

      <div className="frontpage-grid">
        <div className="frontpage-container">
          <h1 className="frontpage-title">
            <span className="frontpage-title-line">Stay focused on your patients.</span>
            <span className="frontpage-title-line">
              We'll handle the rest<span className="frontpage-dot">.</span>
            </span>
          </h1>

          <p className="frontpage-subtitle">
            Det eneste redskab, du behøver for at klare det hele.
          </p>

          <div className="frontpage-buttons">
            <Link to="/signup" className="frontpage-button primary">
              Start for free
            </Link>
            <a href="#demo" className="frontpage-button secondary">
              Book a demo
            </a>
          </div>
        </div>
      </div>
      <div id="demo" className="frontpage-anchor" aria-hidden="true" />
    </section>
  );
}

export default Frontpage;
