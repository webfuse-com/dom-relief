import type { DOMNode, DOMTree, DocumentSource, ParseOptions } from "./types.ts";
export declare function serializeSource(source: DocumentSource): string;
export declare function parseHtml(html: string, options: ParseOptions): DOMTree;
export declare function attributeOf(node: DOMNode, name: string): string;
export declare function horizontaltenTree(root: DOMNode): DOMNode[];
