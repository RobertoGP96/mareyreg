"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

type FadeStaggerProps = HTMLMotionProps<"div"> & {
  as?: "div" | "ul" | "section";
};

export function FadeStagger({
  className,
  children,
  as = "div",
  ...rest
}: FadeStaggerProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  if (reduce) {
    const Plain = as as "div";
    return <Plain className={className}>{children as React.ReactNode}</Plain>;
  }

  return (
    <Comp
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

type FadeStaggerItemProps = HTMLMotionProps<"div">;

export function FadeStaggerItem({
  className,
  children,
  ...rest
}: FadeStaggerItemProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children as React.ReactNode}</div>;
  }

  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

type HoverLiftProps = HTMLMotionProps<"div"> & {
  /** Cuanto sube el elemento al hover en px. */
  lift?: number;
};

export function HoverLift({
  className,
  children,
  lift = 2,
  ...rest
}: HoverLiftProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={cn("transition-shadow", className)}>
        {children as React.ReactNode}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -lift, scale: 1.005 }}
      transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
