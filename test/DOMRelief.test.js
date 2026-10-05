import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_CONFIG, DOMRelief, createDOMRelief } from "../src/lib.ts";


/*
 * Attaching needs WebGL, so only the config side is tested.
 */

describe("DOMRelief", () => {
    test("starts from the defaults", () => {
        const relief = new DOMRelief();

        assert.deepEqual(relief.getConfig(), DEFAULT_CONFIG);
        assert.equal(relief.canvas, null);
    });

    test("takes an initial config", () => {
        const relief = createDOMRelief({
            documents: ["<p></p>"]
        });

        assert.deepEqual(relief.getConfig().documents, ["<p></p>"]);
    });

    test("updates a single option", () => {
        const relief = new DOMRelief();

        relief.update("orientation", "horizontal");
        assert.equal(relief.getConfig().orientation, "horizontal");
    });

    test("updates several options at once and keeps the rest", () => {
        const relief = new DOMRelief({
            gap: 0.5
        });

        relief.update({
            showGrid: false,
            background: "#20242c"
        });

        const current = relief.getConfig();

        assert.equal(current.showGrid, false);
        assert.equal(current.background, "#20242c");
        assert.equal(current.gap, 0.5);
    });

    test("chains", () => {
        const relief = new DOMRelief();

        assert.equal(relief.update("gap", 1).update({
            depthMax: 12
        }).detach(), relief);
    });

    test("rejects invalid options in the constructor and in update, leaving the config as it was", () => {
        assert.throws(() => new DOMRelief({
            layout: "grid"
        }), TypeError);

        const relief = new DOMRelief();

        assert.throws(() => relief.update("gap", -2), TypeError);
        assert.throws(() => relief.update({
            nope: true
        }), TypeError);
        assert.equal(relief.getConfig().gap, DEFAULT_CONFIG.gap);
    });

    test("hands out copies of its config", () => {
        const relief = new DOMRelief({
            documents: ["<p></p>"]
        });
        const copy = relief.getConfig();

        copy.documents.push("<div></div>");
        copy.gap = 9;
        assert.equal(relief.getConfig().documents.length, 1);
        assert.equal(relief.getConfig().gap, DEFAULT_CONFIG.gap);
    });

    test("can be disposed without ever being attached", () => {
        assert.doesNotThrow(() => new DOMRelief().dispose());
    });
});