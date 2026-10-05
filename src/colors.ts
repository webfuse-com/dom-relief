import type { DOMNode, DOMReliefConfig } from "./types.ts";
import { Color, SRGBColorSpace } from "three";


/*
 * Fixed scale: 0 is blue, depthMax red, deeper darker red.
 */
export function depthColor(depth: number, depthMax: number, target: Color): Color {
    const share: number = Math.min(1, depth / Math.max(1, depthMax));
    const beyond: number = Math.max(0, depth - depthMax);
    const lightness: number = Math.max(0.28, 0.56 - 0.06 * share - 0.04 * beyond);

    return target.setHSL(0.62 * (1 - share), 0.62, lightness, SRGBColorSpace);
}

export function colorForNode(node: DOMNode, options: DOMReliefConfig, target: Color): Color {
    return depthColor(node.depth, options.depthMax, target);
}

export function depthGradient(): string {
    const stops: string[] = [0, 0.25, 0.5, 0.75, 1].map((share: number): string => {
        const color: Color = new Color().setHSL(0.62 * (1 - share), 0.62, 0.56 - 0.06 * share, SRGBColorSpace);

        return `#${color.getHexString()}`;
    });

    return `linear-gradient(90deg, ${stops.join(", ")})`;
}