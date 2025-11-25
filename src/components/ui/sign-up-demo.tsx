import React from "react";
import { Gem } from "lucide-react";

import { AuthComponent } from "./sign-up";

const CustomLogo = () => (
  <div className="flex items-center justify-center rounded-md bg-blue-500/90 p-1.5 text-white">
    <Gem className="h-4 w-4" />
  </div>
);

export default function CustomAuthDemo() {
  return <AuthComponent logo={<CustomLogo />} brandName="Selma+" />;
}

