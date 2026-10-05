export type Layout = "squarified" | "ordered";
export type Orientation = "vertical" | "horizontal";
export type Projection = "perspective" | "orthographic";

export type DocumentSource = string | Document | Element;

export type ParseOptions = Pick<DOMReliefConfig, "skipHead" | "skipScripts" | "textNodes" | "maxNodes" | "maxDepth">;
export type GeometryOptions = Pick<DOMReliefConfig, "layerThickness" | "attributeWeight" | "textWeight" | "gap" | "layout">;

export interface DOMNode {
    readonly attributeChars: number;
    readonly attributes: (readonly [string, string])[];
    readonly children: DOMNode[];
    readonly depth: number;
    readonly parent: DOMNode | null;
    readonly tag: string;
    readonly textLength: number;
}

export interface DOMTree {
    readonly nodeCount: number;
    readonly root: DOMNode | null;
    readonly truncated: boolean;
}

export interface LayoutBlock {
    readonly elevation: number;
    readonly index: number;
    readonly length: number;
    readonly ownWeight: number;
    readonly node: DOMNode;
    readonly thickness: number;
    readonly weight: number;
    readonly width: number;
    readonly x: number;
    readonly z: number;

    subtreeSize: number;
}

export interface LayoutResult {
    readonly blocks: LayoutBlock[];
    readonly blockByNode: ReadonlyMap<DOMNode, LayoutBlock>;
    readonly height: number;
    readonly side: number;
}

export interface DOMReliefConfig {
    attributeWeight: number;
    autoFit: boolean;
    autoRotate: boolean;
    background: string;
    depthMax: number;
    documents: DocumentSource[];
    gap: number;
    gridColor: string;
    interactive: boolean;
    layerThickness: number;
    layout: Layout;
    maxDepth: number;
    maxNodes: number;
    orientation: Orientation;
    projection: Projection;
    sameScale: boolean;
    showGrid: boolean;
    skipHead: boolean;
    skipScripts: boolean;
    textNodes: boolean;
    textWeight: number;
}

export interface DOMReliefDocumentMeta {
    readonly attributeChars: number;
    readonly attributes: number;
    readonly averageChildren: number;
    readonly averageDepth: number;
    readonly elements: number;
    readonly footprint: number;
    readonly height: number;
    readonly leaves: number;
    readonly maxChildren: number;
    readonly maxDepth: number;
    readonly nodes: number;
    readonly nodesPerDepth: readonly number[];
    readonly tags: Readonly<Record<string, number>>;
    readonly textChars: number;
    readonly textNodes: number;
    readonly truncated: boolean;
}

export interface DOMReliefMeta {
    readonly documents: readonly DOMReliefDocumentMeta[];
}