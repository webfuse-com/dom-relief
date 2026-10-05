import type { DOMNode, DOMTree, DocumentSource, ParseOptions } from "./types.ts";


interface MutableDOMNode extends DOMNode {
    readonly children: MutableDOMNode[];
}


const SKIPPED_TAGS: ReadonlySet<string> = new Set([
    "script",
    "style",
    "template",
    "noscript"
]);


export function serializeSource(source: DocumentSource): string {
    if(typeof source === "string") {
        return source;
    }

    if("documentElement" in source) {
        return source.documentElement.outerHTML;
    }

    return source.outerHTML;
}

/*
 * Needs a DOMParser (browser or jsdom).
 */
export function parseHtml(html: string, options: ParseOptions): DOMTree {
    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString(html, "text/html");
    const rootElement: Element | null = options.skipHead ? (doc.body ?? doc.documentElement) : doc.documentElement;
    let count: number = 0;
    let truncated: boolean = false;

    function walk(element: Element, depth: number, parent: MutableDOMNode | null): MutableDOMNode | null {
        if(count >= options.maxNodes || depth > options.maxDepth) {
            truncated = true;
            return null;
        }

        const tag: string = element.tagName.toLowerCase();

        if(options.skipScripts && SKIPPED_TAGS.has(tag)) {
            return null;
        }

        count++;

        const attributes: (readonly [string, string])[] = [];

        let attributeChars: number = 0;

        for(const attribute of Array.from(element.attributes)) {
            attributes.push([attribute.name, attribute.value]);
            attributeChars += attribute.name.length + attribute.value.length;
        }

        const children: MutableDOMNode[] = [];

        let textLength: number = 0;

        const node: MutableDOMNode = {
            tag: tag,
            depth: depth,
            parent: parent,
            children: children,
            attributes: attributes,
            attributeChars: attributeChars,
            get textLength(): number {
                return textLength;
            }
        };

        for(const child of Array.from(element.childNodes)) {
            if(child.nodeType === Node.ELEMENT_NODE) {
                const childNode: MutableDOMNode | null = walk(child as Element, depth + 1, node);

                if(childNode !== null) {
                    children.push(childNode);
                }

                continue;
            }

            if(child.nodeType === Node.TEXT_NODE) {
                const text: string = (child.nodeValue ?? "").trim();

                if(text.length === 0) continue;

                if(!options.textNodes || (count >= options.maxNodes)) {
                    textLength += text.length;

                    continue;
                }

                count++;

                children
                    .push({
                        tag: "#text",
                        depth: depth + 1,
                        parent: node,
                        children: [],
                        attributes: [],
                        attributeChars: 0,
                        textLength: text.length
                    });

                continue;
            }
        }

        return node;
    }

    const root: DOMNode | null = (rootElement !== null) ? walk(rootElement, 0, null) : null;

    return {
        root: root,
        nodeCount: count,
        truncated: truncated
    };
}

export function attributeOf(node: DOMNode, name: string): string {
    const found: readonly [string, string] | undefined = node.attributes
        .find((attribute: readonly [string, string]): boolean => attribute[0] === name);

    return (found !== undefined) ? found[1] : "";
}

export function horizontaltenTree(root: DOMNode): DOMNode[] {
    const result: DOMNode[] = [];
    const stack: DOMNode[] = [root];

    while(stack.length > 0) {
        const node: DOMNode = stack.pop() as DOMNode;

        result.push(node);

        for(let index: number = node.children.length - 1; index >= 0; index--) {
            stack.push(node.children[index]);
        }
    }

    return result;
}