export interface ButtonProps {
  label: string;
  onClick?: () => void;
  delay?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}