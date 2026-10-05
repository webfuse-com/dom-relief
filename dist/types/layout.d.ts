import type { DOMNode, GeometryOptions, LayoutResult } from "./types.ts";
type ChildRect = [DOMNode, number, number, number, number];
export declare function ownWeight(node: DOMNode, options: GeometryOptions): number;
export declare function squarify(nodes: DOMNode[], weights: ReadonlyMap<DOMNode, number>, x: number, z: number, width: number, length: number): ChildRect[];
export declare function strips(nodes: DOMNode[], weights: ReadonlyMap<DOMNode, number>, x: number, z: number, width: number, length: number): ChildRect[];
export declare function computeLayout(root: DOMNode, options: GeometryOptions): LayoutResult;
export {};
