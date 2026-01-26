"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import { MessageLoading } from "./message-loading";

interface ChatBubbleProps {
  variant?: "sent" | "received";
  layout?: "default" | "ai";
  className?: string;
  children: React.ReactNode;
}

function ChatBubble({ variant = "received", layout = "default", className, children }: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 mb-2",
        variant === "sent" && "flex-row-reverse",
        layout === "ai" && "items-start",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ChatBubbleMessageProps {
  variant?: "sent" | "received";
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function ChatBubbleMessage({ variant = "received", isLoading, className, children }: ChatBubbleMessageProps) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 text-sm shadow-sm border border-slate-200",
        variant === "sent"
          ? "bg-primary text-primary-foreground border-primary/20"
          : "bg-slate-50 text-slate-900",
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <MessageLoading />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface ChatBubbleAvatarProps {
  src?: string;
  fallback?: string;
  className?: string;
}

function ChatBubbleAvatar({ src, fallback = "AI", className }: ChatBubbleAvatarProps) {
  return (
    <Avatar className={cn("h-9 w-9 shrink-0", className)}>
      {src ? <AvatarImage src={src} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

interface ChatBubbleActionProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

function ChatBubbleAction({ icon, onClick, className }: ChatBubbleActionProps) {
  return (
    <Button variant="ghost" size="icon" className={cn("h-7 w-7", className)} onClick={onClick}>
      {icon}
    </Button>
  );
}

function ChatBubbleActionWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center gap-1 mt-2", className)}>{children}</div>;
}

export {
  ChatBubble,
  ChatBubbleMessage,
  ChatBubbleAvatar,
  ChatBubbleAction,
  ChatBubbleActionWrapper,
};
