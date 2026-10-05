import type { DOMNode, GeometryOptions, LayoutBlock, LayoutResult } from "./types.ts";


/*
 * [child, x, z, width, length]
 */
type ChildRect = [DOMNode, number, number, number, number];

interface AreaItem {
    readonly node: DOMNode;
    readonly area: number;
}


function worstRatio(row: AreaItem[], side: number): number {
    let sum: number = 0;
    let largest: number = 0;
    let smallest: number = Infinity;

    for(const item of row) {
        sum += item.area;
        largest = Math.max(largest, item.area);
        smallest = Math.min(smallest, item.area);
    }

    return Math.max((side * side * largest) / (sum * sum), (sum * sum) / (side * side * smallest));
}


/*
 * Attributes count by total length, on the same curve as text.
 */
export function ownWeight(node: DOMNode, options: GeometryOptions): number {
    const attributePart: number = options.attributeWeight * 0.45 * Math.log1p(node.attributeChars);
    const textPart: number = options.textWeight * 0.45 * Math.log1p(node.textLength);

    return 1 + attributePart + textPart;
}

export function squarify(
    nodes: DOMNode[],
    weights: ReadonlyMap<DOMNode, number>,
    x: number,
    z: number,
    width: number,
    length: number
): ChildRect[] {
    const total: number = nodes.reduce((sum: number, node: DOMNode): number => sum + (weights.get(node) ?? 0), 0);
    const scale: number = (width * length) / total;
    const result: ChildRect[] = [];
    let rest: AreaItem[] = nodes
        .map((node: DOMNode): AreaItem => ({
            node: node,
            area: (weights.get(node) ?? 0) * scale
        }))
        .sort((first: AreaItem, second: AreaItem): number => second.area - first.area);
    let restX: number = x;
    let restZ: number = z;
    let restWidth: number = width;
    let restLength: number = length;

    while(rest.length > 0) {
        const side: number = Math.min(restWidth, restLength);
        let row: AreaItem[] = [rest[0]];
        let taken: number = 1;
        let worst: number = worstRatio(row, side);

        while(taken < rest.length) {
            const candidate: AreaItem[] = row.concat(rest[taken]);
            const candidateWorst: number = worstRatio(candidate, side);

            if(candidateWorst > worst) {
                break;
            }

            row = candidate;
            worst = candidateWorst;
            taken++;
        }

        const rowArea: number = row
            .reduce((sum: number, item: AreaItem): number => sum + item.area, 0);

        if(restWidth >= restLength) {
            const columnWidth: number = rowArea / restLength;
            let cursor: number = restZ;

            for(const item of row) {
                const itemLength: number = item.area / columnWidth;

                result.push([item.node, restX, cursor, columnWidth, itemLength]);
                cursor += itemLength;
            }

            restX += columnWidth;
            restWidth -= columnWidth;
        } else {
            const rowLength: number = rowArea / restWidth;
            let cursor: number = restX;

            for(const item of row) {
                const itemWidth: number = item.area / rowLength;

                result.push([item.node, cursor, restZ, itemWidth, rowLength]);
                cursor += itemWidth;
            }

            restZ += rowLength;
            restLength -= rowLength;
        }

        rest = rest.slice(taken);
    }

    return result;
}

/*
 * Document order along the longer side.
 */
export function strips(nodes: DOMNode[], weights: ReadonlyMap<DOMNode, number>, x: number, z: number, width: number, length: number): ChildRect[] {
    const total: number = nodes
        .reduce((sum: number, node: DOMNode): number => sum + (weights.get(node) ?? 0), 0);
    const result: ChildRect[] = [];
    let offset: number = 0;

    for(const node of nodes) {
        const share: number = (weights.get(node) ?? 0) / total;

        if(width >= length) {
            result.push([node, x + offset, z, width * share, length]);
            offset += width * share;
        } else {
            result.push([node, x, z + offset, width, length * share]);
            offset += length * share;
        }
    }

    return result;
}

export function computeLayout(root: DOMNode, options: GeometryOptions): LayoutResult {
    const weights: Map<DOMNode, number> = new Map();
    const owns: Map<DOMNode, number> = new Map();

    function weigh(node: DOMNode): number {
        const own: number = ownWeight(node, options);
        let sum: number = own;

        for(const child of node.children) {
            sum += weigh(child);
        }

        owns.set(node, own);
        weights.set(node, sum);

        return sum;
    }

    const rootWeight: number = weigh(root);
    const side: number = Math.sqrt(rootWeight);
    const thickness: number = options.layerThickness * 0.5;
    const blocks: LayoutBlock[] = [];
    const blockByNode: Map<DOMNode, LayoutBlock> = new Map();

    let height: number = 0;

    function place(node: DOMNode, x: number, z: number, width: number, length: number, elevation: number) {
        const block: LayoutBlock = {
            node: node,
            index: blocks.length,
            subtreeSize: 1,
            x: x,
            z: z,
            width: width,
            length: length,
            elevation: elevation,
            thickness: thickness,
            ownWeight: owns.get(node) ?? 1,
            weight: weights.get(node) ?? 1
        };

        blocks.push(block);
        blockByNode.set(node, block);

        height = Math.max(height, elevation + thickness);

        const padding: number = Math.min(options.gap, 0.12 * Math.min(width, length));
        const innerWidth: number = width - 2 * padding;
        const innerLength: number = length - 2 * padding;

        if(node.children.length > 0 && innerWidth > 1e-4 && innerLength > 1e-4) {
            const rects: ChildRect[] = options.layout === "ordered"
                ? strips(node.children, weights, x + padding, z + padding, innerWidth, innerLength)
                : squarify(node.children, weights, x + padding, z + padding, innerWidth, innerLength);

            if(options.layout !== "ordered") {
                rects.sort((first: ChildRect, second: ChildRect): number => node.children.indexOf(first[0]) - node.children.indexOf(second[0]));
            }

            for(const rect of rects) {
                place(rect[0], rect[1], rect[2], rect[3], rect[4], elevation + thickness);
            }
        }

        block.subtreeSize = blocks.length - block.index;
    }

    place(root, -side / 2, -side / 2, side, side, 0);

    return {
        blocks: blocks,
        blockByNode: blockByNode,
        side: side,
        height: height
    };
}