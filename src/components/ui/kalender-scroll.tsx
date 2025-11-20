import React from "react";
import { ContainerScroll } from "./container-scroll-animation";
import KalenderPreview from "./kalender-preview";

export function KalenderScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden">
      <ContainerScroll
        titleComponent={
          <>
            <h1 className="text-4xl font-semibold text-black dark:text-white">
              The interface is intentionally minimal, while a sophisticated, custom-built AI engine operates behind the scenes.
            </h1>
          </>
        }
      >
        <KalenderPreview />
      </ContainerScroll>
    </div>
  );
}

