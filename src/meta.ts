import type { ReliefModel } from "./models.ts";
import type { DOMNode, DOMReliefDocumentMeta } from "./types.ts";


export function describeModel(model: ReliefModel): DOMReliefDocumentMeta {
    const nodesPerDepth: number[] = [];
    const tags: Record<string, number> = {};
    const stack: DOMNode[] = (model.tree.root !== null) ? [model.tree.root] : [];

    let nodes: number = 0;
    let textNodes: number = 0;
    let leaves: number = 0;
    let depthSum: number = 0;
    let parents: number = 0;
    let childSum: number = 0;
    let maxChildren: number = 0;
    let attributes: number = 0;
    let attributeChars: number = 0;
    let textChars: number = 0;

    while(stack.length > 0) {
        const node: DOMNode = stack.pop() as DOMNode;

        nodes++;
        depthSum += node.depth;
        nodesPerDepth[node.depth] = (nodesPerDepth[node.depth] ?? 0) + 1;
        attributes += node.attributes.length;
        attributeChars += node.attributeChars;
        textChars += node.textLength;

        if(node.tag === "#text") {
            textNodes++;
        } else {
            tags[node.tag] = (tags[node.tag] ?? 0) + 1;
        }

        if(node.children.length === 0) {
            leaves++;
        } else {
            parents++;
            childSum += node.children.length;
            maxChildren = Math.max(maxChildren, node.children.length);
        }

        stack.push(...node.children);
    }

    return {
        attributeChars: attributeChars,
        attributes: attributes,
        averageChildren: (parents > 0) ? childSum / parents : 0,
        averageDepth: (nodes > 0) ? depthSum / nodes : 0,
        elements: nodes - textNodes,
        footprint: (model.layout !== null) ? model.layout.side * model.layout.side : 0,
        height: (model.layout !== null) ? model.layout.height : 0,
        leaves: leaves,
        maxChildren: maxChildren,
        maxDepth: Math.max(0, nodesPerDepth.length - 1),
        nodes: nodes,
        nodesPerDepth: Array.from(nodesPerDepth, (count: number | undefined): number => count ?? 0),
        tags: tags,
        textChars: textChars,
        textNodes: textNodes,
        truncated: model.tree.truncated
    };
}