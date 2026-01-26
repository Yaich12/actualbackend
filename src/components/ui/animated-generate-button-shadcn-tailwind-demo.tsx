import AnimatedGenerateButton from '@/components/ui/animated-generate-button-shadcn-tailwind';

export default function DemoAnimatedGenerateButton() {
  return (
    <AnimatedGenerateButton
      labelIdle="Generate"
      labelActive="Building"
      highlightHueDeg={5000}
    />
  );
}
