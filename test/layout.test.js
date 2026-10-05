import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { config, buildTree, samplePage } from "./test.util.js";

import { computeLayout, ownWeight, squarify, strips } from "../src/layout.ts";
import { horizontaltenTree } from "../src/parse.ts";


const EPSILON = 1e-9;


function contains(outer, inner) {
    return inner.x >= outer.x - EPSILON
        && inner.z >= outer.z - EPSILON
        && inner.x + inner.width <= outer.x + outer.width + EPSILON
        && inner.z + inner.length <= outer.z + outer.length + EPSILON;
}


describe("ownWeight", () => {
    test("is 1 for a bare element", () => {
        assert.equal(ownWeight(buildTree({
            tag: "div"
        }), config()), 1);
    });

    test("counts attributes by total length only, not by how many there are", () => {
        const twoShort = buildTree({
            tag: "div",
            attributes: [["id", "ab"], ["rel", "cde"]]
        });
        const oneLong = buildTree({
            tag: "div",
            attributes: [["class", "abcde"]]
        });

        assert.equal(twoShort.attributeChars, oneLong.attributeChars);
        assert.equal(ownWeight(twoShort, config()), ownWeight(oneLong, config()));
    });

    test("uses the same curve for attribute length and text length", () => {
        const withAttributes = buildTree({
            tag: "div",
            attributes: [["data-x", "a".repeat(94)]]
        });
        const withText = buildTree({
            tag: "div",
            text: 100
        });

        assert.equal(withAttributes.attributeChars, 100);
        assert.equal(ownWeight(withAttributes, config()), ownWeight(withText, config()));
    });

    test("scales with attributeWeight and textWeight", () => {
        const node = buildTree({
            tag: "p",
            attributes: [["class", "x"]],
            text: 50
        });

        assert.equal(ownWeight(node, config({
            attributeWeight: 0,
            textWeight: 0
        })), 1);
        assert.ok(ownWeight(node, config({
            textWeight: 2
        })) > ownWeight(node, config()));
    });
});

describe("computeLayout", () => {
    const root = samplePage();
    const layout = computeLayout(root, config());

    test("creates one block per node, in preorder", () => {
        const nodes = horizontaltenTree(root);

        assert.equal(layout.blocks.length, nodes.length);
        layout.blocks.forEach((block, index) => {
            assert.equal(block.index, index);
            assert.equal(block.node, nodes[index]);
            assert.equal(layout.blockByNode.get(block.node), block);
        });
    });

    test("gives every layer the same thickness, so elevation equals depth × thickness", () => {
        const thickness = config().layerThickness * 0.5;

        for(const block of layout.blocks) {
            assert.equal(block.thickness, thickness);
            assert.ok(Math.abs(block.elevation - block.node.depth * thickness) < EPSILON);
        }

        assert.ok(Math.abs(layout.height - 3 * thickness) < EPSILON);
    });

    test("scales thickness with layerThickness", () => {
        const thick = computeLayout(root, config({
            layerThickness: 3
        }));

        assert.equal(thick.blocks[0].thickness, 1.5);
    });

    test("makes the root a square whose area is the total weight", () => {
        const rootBlock = layout.blocks[0];

        assert.ok(Math.abs(rootBlock.width * rootBlock.length - rootBlock.weight) < 1e-6);
        assert.equal(rootBlock.width, rootBlock.length);
        assert.equal(layout.side, rootBlock.width);
    });

    test("sums weights over subtrees", () => {
        for(const block of layout.blocks) {
            const childSum = block.node.children.reduce((sum, child) => sum + (layout.blockByNode.get(child)).weight, 0);

            assert.ok(Math.abs(block.weight - block.ownWeight - childSum) < 1e-9);
        }
    });

    test("keeps every child inside its parent", () => {
        for(const block of layout.blocks) {
            const parent = block.node.parent;

            if(parent !== null) {
                assert.ok(contains(layout.blockByNode.get(parent), block), `${block.node.tag} escapes its parent`);
            }
        }
    });

    test("gives siblings footprints proportional to their weights", () => {
        const main = root.children[1];
        const areas = main.children.map((child) => {
            const block = layout.blockByNode.get(child);

            return block.width * block.length;
        });
        const weights = main.children.map((child) => (layout.blockByNode.get(child)).weight);

        for(let index = 1; index < areas.length; index++) {
            assert.ok(Math.abs(areas[index] / areas[0] - weights[index] / weights[0]) < 1e-9);
        }
    });

    test("marks subtrees as contiguous index ranges", () => {
        for(const block of layout.blocks) {
            assert.equal(block.subtreeSize, horizontaltenTree(block.node).length);
        }
    });

    test("keeps document order along the longer side in ordered layout", () => {
        const ordered = computeLayout(root, config({
            layout: "ordered"
        }));
        const main = root.children[1];
        const positions = main.children.map((child) => {
            const block = ordered.blockByNode.get(child);

            return block.x + block.z;
        });

        assert.deepEqual(positions.slice().sort((first, second) => first - second), positions);
    });
});

describe("treemap splitting", () => {
    const children = [1, 2, 3, 6].map((weight) => buildTree({
        tag: `w${weight}`
    }));
    const weights = new Map(children.map((node, index) => [node, [1, 2, 3, 6][index]]));

    test("squarify fills the rectangle with areas proportional to weight", () => {
        const rects = squarify(children, weights, 0, 0, 4, 3);
        const total = rects.reduce((sum, rect) => sum + rect[3] * rect[4], 0);

        assert.equal(rects.length, 4);
        assert.ok(Math.abs(total - 12) < 1e-9);

        for(const rect of rects) {
            assert.ok(Math.abs(rect[3] * rect[4] - (weights.get(rect[0]))) < 1e-9);
        }
    });

    test("strips keep input order along the longer side", () => {
        const rects = strips(children, weights, 0, 0, 12, 1);

        assert.deepEqual(rects.map((rect) => rect[0]), children);
        assert.deepEqual(rects.map((rect) => rect[3]), [1, 2, 3, 6]);
        assert.deepEqual(rects.map((rect) => rect[1]), [0, 1, 3, 6]);
    });
});