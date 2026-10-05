import type { DOMNode, DOMReliefConfig } from "./types.ts";
import { Color } from "three";
export declare function depthColor(depth: number, depthMax: number, target: Color): Color;
export declare function colorForNode(node: DOMNode, options: DOMReliefConfig, target: Color): Color;
export declare function depthGradient(): string;
