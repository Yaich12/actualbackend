import React from "react";
import { FeatureCarousel } from "./animated-feature-carousel";

function KalenderPreview() {
  const images = {
    alt: "Feature screenshot",
    step1img1: "https://images.unsplash.com/photo-1618761714954-0b8cd0026356?q=80&w=1740&auto=format&fit=crop",
    step1img2: "https://images.unsplash.com/photo-1607705703571-c5a8695f18f6?q=80&w=1740&auto=format&fit=crop",
    step2img1: "https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=1661&auto=format&fit=crop",
    step2img2: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1674&auto=format&fit=crop",
    step3img: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1740&auto=format&fit=crop",
    step4img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1742&auto=format&fit=crop",
  };

  return (
    <div style={{ padding: 0, margin: 0, background: "transparent", width: "100%" }}>
      <FeatureCarousel image={images} />
    </div>
  );
}

export default KalenderPreview;


