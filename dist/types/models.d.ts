import type { DOMTree, DocumentSource, DOMReliefConfig, LayoutResult } from "./types.ts";
export interface ReliefModel {
    readonly source: DocumentSource;
    readonly tree: DOMTree;
    readonly layout: LayoutResult | null;
}
export declare class ModelCache {
    private readonly trees;
    build(config: Readonly<DOMReliefConfig>): ReliefModel[];
    clear(): void;
    private tree;
}
