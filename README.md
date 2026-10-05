# DOM Relief

DOM structure visualiser based on general node feature footprints<sup>1</sup>.

<a href="#example">
  <img src="./.github/readme-1.png" alt="Reliefs comparing the landing page DOMs of google.com and bing.com">
</a>
<br><br>

``` console
npm install webfuse-com/dom-relief
```

### Example

Draw and compare abstract 3D DOM models. Works with both live and HTML-serialied DOM-instances.

```ts
import { DOMRelief } from "dom-relief";

const relief: DOMRelief = new DOMRelief({
  documents: [ htmlGoogle, htmlBing ]
});

relief.attach(document.querySelector("CANVAS"));

relief.update("orientation", "vertical");
relief.update({
  background: "#FFF",
  showGrid: false
});
```

> Open [example/example.html](./example/example.html) in a browser to use the interactive example application.

### API

#### `DOMRelief`

Create a DOM relief object with [configuration](#configuration) overrides.

``` ts
new DOMRelief(config?: Partial<DOMReliefConfig>)
```

``` ts
function createDOMRelief(config?: Partial<DOMReliefConfig>): DOMRelief
```

#### `attach()`, `detach()`

Attach a DOM relief object to a `CANVAS` element.

``` ts
DOMRelief.attach(target: HTMLCanvasElement): this
```

Detach a DOM relief object from a `CANVAS` element.

``` ts
DOMRelief.detach(): this
```

#### `update()`

Update a DOM relief object's [configuration](#configuration).

``` ts
DOMRelief.update(key: string, value: unknown): this
DOMRelief.update({ [ key: string ]: unknown; }): this
```

#### `dispose()`

Dispose of a DOM relief object, which means allocated resources are released.

``` ts
DOMRelief.dispose(): void
```

#### `meta`

Get meta information about the modelled DOMs, e.g., nodes count.

``` ts
DOMRelief.meta: DOMReliefMeta
```

### Configuration

| Option | Description | Type | Default |
| :- | :- | :- | :- |
| `attributeWeight` | Scale how much total attribute length adds to an element's footprint. | `number` | `1` |
| `autoFit` | Reframe the view when documents, orientation or scaling change. | `boolean` | `true` |
| `autoRotate` | Rotate the view slowly around the models. | `boolean` | `false` |
| `background` | Set the stage background to any CSS color. | `string` | `"#F8FAFC"` |
| `depthMax` | Show this depth and deeper as full red when coloring by depth. | `number` | `15` |
| `documents` | Show these HTML strings, Documents or Elements side by side. | `DocumentSource[]` | `[]` |
| `gap` | Set the padding between a parent's edge and its children. | `number` | `0.25` |
| `gridColor` | Set the grid lines to any CSS color. | `string` | `"#DADDE0"` |
| `interactive` | Let the pointer rotate, pan and zoom the view, and double-click refit it. | `boolean` | `true` |
| `layerThickness` | Set the thickness of every layer, so elevation equals depth times thickness. | `number` | `2.0` |
| `layout` | Arrange children in document order (`"ordered"`) or as size-sorted tiles (`"squarified"`). | `Layout` | `"ordered"` |
| `maxDepth` | Stop descending below this depth. | `number` | `300` |
| `maxNodes` | Stop parsing a document after this many nodes. | `number` | `40000` |
| `orientation` | Lay the models flat (`"horizontal"`) or stand them up like a screen (`"vertical"`). | `Orientation` | `"horizontal"` |
| `projection` | Render with depth (`"perspective"`) or true relative sizes (`"orthographic"`). | `Projection` | `"perspective"` |
| `sameScale` | Draw all documents in the same units, or give each the same footprint when off. | `boolean` | `true` |
| `showGrid` | Show the grid as a floor or back wall. | `boolean` | `true` |
| `skipHead` | Start at `<body>` instead of `<html>`. | `boolean` | `true` |
| `skipScripts` | Ignore `script`, `style`, `template` and `noscript` elements. | `boolean` | `true` |
| `textNodes` | Turn each text run into its own leaf block. | `boolean` | `false` |
| `textWeight` | Scale how much direct text length adds to an element's footprint. | `number` | `1` |

``` ts
interface DOMReliefConfig {
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
```

### Interpretation

``` html
<body>
  <!-- square layer -->
  <main>
    <!-- exposed surface -->
    <p>
      A paragraph with much more direct text than anything else on this page.
      <a href="#">more</a>
    </p>
    <!-- plateau stack of thin layers -->
    <ul>
      <li>a</li><li>b</li><li>c</li><li>d</li>
      <li>e</li><li>f</li><li>g</li><li>h</li>
    </ul>
    <!-- narrow stack -->
    <div><div><div>
      <div><div><div>
        <span>x</span>
      </div></div></div>
    </div></div></div>
    <!-- concentric stack -->
    <div>
      <div>
        <ol>
          <li>1</li><li>2</li><li>3</li><li>4</li>
        </ol>
      </div>
    </div>
    <!-- regular stacks -->
    <section>
      <div><b>T</b><i>t</i></div>
      <div><b>T</b><i>t</i></div>
      <div><b>T</b><i>t</i></div>
      <div><b>T</b><i>t</i></div>
    </section>
    <!-- asymmetric stacks -->
    <section>
      <form>
        <input>
        <button>Go</button>
      </form>
      <img src="a.png" alt="">
      <blockquote>A quote with noticeably more text than its siblings.</blockquote>
    </section>
  </main>
  <footer>©</footer>
</body>
```

<br>
<a href="#interpretation">
  <img src="./.github/readme-2.png" alt="DOM relief representative for characteristic DOM structure patterns" width="400">
</a>

#### Per Layer

| Layer | Meaning | Example |
| :- | :- | :- |
| **Thin** | Sibling crowding: a tiny sibling among large ones (squarified) or one of many siblings (document order) | badges, list items, table rows |
| **Square** | Dominance: a child holding most of its parent's content | `<main>` in `<body>` |
| **Exposed-Surface** | Own content: the direct text and attributes of the element itself | `<p>` with inline tags |
| **Covered-Surface** | Pure containment: content located entirely in the children | layout `<div>`s, `<section>`, `<ul>` |
| **Empty-Surface** | Leaf status: the absence of child elements | `<img>`, `<input>`, text-only `<a>` |

#### Per Stack

| Stack | Meaning | Example |
| :- | :- | :- |
| **Narrow** | Sparse depth: many levels with little content | wrapper chains, nested components |
| **Concentric** | Single-child chains: one child per parent across several levels | framework root wrappers |
| **Plateau** | Shallow breadth: many siblings with little nesting | flat lists, long table bodies |
| **Regular** | Sibling similarity: repeated components with equal content | card grids, table rows |
| **Asymmetric** | Sibling diversity: heterogeneous siblings with unequal content | mixed sections, forms |

### <sup>1</sup> Definition of _Footprint_

The **footprint** `A` of an element *e* is the base area (horizontal orientation) of its block in the layout plane:

```
A(e) = width × length
```

The root block is a square of side `√W(root)`:

```
A(root) = W(root)
```

Children share their parent *p*'s inner area, which is `A(p)` minus the `gap` padding, in proportion to their weights:

```
A(c) = A_inner(p) · W(c) / Σ W(siblings)
```

`W` is the **subtree weight** of *e*, summed over all its children *c*:

```
W(e) = W_own(e) + Σ W(c)
```

`W_own` is the **own weight** of the outer element itself:

```
W_own(e) = 1 + 0.45 · attributeWeight · ln(1 + n_attr(e)) + 0.45 · textWeight · ln(1 + n_text(e))
```

`n_attr` is the combined length of all attribute names and values of *e*, and `n_text` is the length of the trimmed text directly inside *e*.

A footprint is exactly proportional to weight among siblings, whilst `A / W` falls slightly below 1 with each nesting level.