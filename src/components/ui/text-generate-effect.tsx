import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "../../lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();

  let wordsArray = words.split(/(\s+)/).filter(word => word.length > 0);
  
  // Find index where "Why not me?" ends (after "me?")
  const findPauseIndex = () => {
    let wordCount = 0;
    for (let i = 0; i < wordsArray.length; i++) {
      const word = wordsArray[i];
      if (word === '\n\n' || word === '\n') {
        continue; // Skip line breaks in count
      }
      wordCount++;
      if (word.includes('me?"')) {
        return wordCount; // Return word count after "me?"
      }
    }
    return -1;
  };

  const pauseIndex = findPauseIndex();

  useEffect(() => {
    if (scope.current) {
      const spans = scope.current.querySelectorAll('span');
      let wordIdx = 0;
      
      spans.forEach((span) => {
        let delay = 0;
        
        if (wordIdx < pauseIndex) {
          // Before pause: faster speed (0.12s per word)
          delay = wordIdx * 0.12;
        } else if (wordIdx === pauseIndex) {
          // At pause point: add 1 second pause
          delay = pauseIndex * 0.12 + 1;
        } else {
          // After pause: faster speed (0.1s per word)
          delay = pauseIndex * 0.12 + 1 + (wordIdx - pauseIndex) * 0.1;
        }
        
        wordIdx++;
        
        animate(
          span,
          {
            opacity: 1,
            filter: filter ? "blur(0px)" : "none",
          },
          {
            duration: duration ? duration : 0.5,
            delay: delay,
          }
        );
      });
    }
  }, [animate, filter, duration, pauseIndex]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          if (word === '\n\n' || word === '\n') {
            return <br key={`br-${idx}`} />;
          }
          return (
            <motion.span
              key={word + idx}
              className="text-white opacity-0"
              style={{
                filter: filter ? "blur(10px)" : "none",
              }}
            >
              {word}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn(className)}>
      <div className="mt-4">
        <div className="text-white text-xl md:text-2xl leading-relaxed tracking-wide">
          {renderWords()}
        </div>
      </div>
    </div>
  );
};

