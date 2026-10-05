import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { config } from "./test.util.js";

import { DEFAULT_CONFIG, diffConfig, mergeConfig, validateChanges } from "../src/config.ts";


describe("validateChanges", () => {
    test("accepts every default", () => {
        assert.doesNotThrow(() => validateChanges(DEFAULT_CONFIG));
    });

    test("rejects unknown keys", () => {
        assert.throws(() => validateChanges({
            colour: "red"
        }), {
            name: "TypeError",
            message: /Unknown DOMRelief option "colour"/
        });
    });

    test("rejects values of the wrong type", () => {
        assert.throws(() => validateChanges({
            showGrid: "yes"
        }), TypeError);
        assert.throws(() => validateChanges({
            documents: "<p></p>"
        }), TypeError);
    });

    test("rejects negative or non-finite numbers", () => {
        assert.throws(() => validateChanges({
            gap: -1
        }), TypeError);
        assert.throws(() => validateChanges({
            layerThickness: Number.NaN
        }), TypeError);
    });

    test("rejects choices that do not exist", () => {
        assert.throws(() => validateChanges({
            orientation: "sideways"
        }), /must be one of "horizontal", "vertical"/);
    });
});

describe("mergeConfig", () => {
    test("applies changes over the base without touching it", () => {
        const merged = mergeConfig(DEFAULT_CONFIG, {
            gap: 0.8
        });

        assert.equal(merged.gap, 0.8);
        assert.equal(DEFAULT_CONFIG.gap, 0.25);
    });

    test("copies the documents array", () => {
        const documents = ["<p></p>"];
        const merged = mergeConfig(DEFAULT_CONFIG, {
            documents: documents
        });

        documents.push("<div></div>");
        assert.equal(merged.documents.length, 1);
    });
});

describe("diffConfig", () => {
    function diff(changes) {
        const base = config({
            documents: ["<p></p>"]
        });

        return diffConfig(base, mergeConfig(base, changes));
    }

    test("reports nothing for no change", () => {
        assert.deepEqual(Object.values(diff({})), [false, false, false, false, false, false, false, false]);
    });

    test("sorts each option into what it affects", () => {
        assert.equal(diff({
            textNodes: true
        }).parse, true);
        assert.equal(diff({
            gap: 1
        }).geometry, true);
        assert.equal(diff({
            depthMax: 5
        }).color, true);
        assert.equal(diff({
            sameScale: false
        }).placement, true);
        assert.equal(diff({
            background: "#000"
        }).theme, true);
        assert.equal(diff({
            autoRotate: true
        }).motion, true);
    });

    test("flags orientation as placement and orientation", () => {
        const changes = diff({
            orientation: "vertical"
        });

        assert.equal(changes.placement, true);
        assert.equal(changes.orientation, true);
        assert.equal(changes.geometry, false);
    });

    test("compares documents by content of the list, not the array", () => {
        assert.equal(diff({
            documents: ["<p></p>"]
        }).documents, false);
        assert.equal(diff({
            documents: ["<p></p>", "<div></div>"]
        }).documents, true);
    });
});