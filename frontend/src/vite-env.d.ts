/// <reference types="vite/client" />

declare module 'bwip-js' {
  interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: 'center' | 'left' | 'right';
  }

  const bwipjs: {
    toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): void;
    default: {
      toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): void;
    };
  };

  export default bwipjs;
}
