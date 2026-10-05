const DOCUMENT_A = `
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>
    <h1>Foo</h1>
    <p>Foo is a <b>metasyntactic</b> variable.</p>
  </main>
  <footer>Footer</footer>
</body>`;
const DOCUMENT_B = `
<body>
  <div class="app">
    <aside>
      <ul>
		${"<li><a href=\"#\">Bar</a></li>".repeat(8)}
      </ul>
    </aside>
    <div class="content">
      <div class="row">
        <div class="card">
          <div class="body">
            <p>Bar is another metasyntactic variable</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>`;


const form = document.getElementById("controls");

const relief = DOMRelief.createDOMRelief()
	.attach(document.getElementById("view"));


function valueOf(input) {
	if (input.type === "checkbox") {
		return input.checked;
	}

	if (input.type === "range") {
		return Number(input.value);
	}

	return input.value;
}

function syncFormDefaults(config) {
	for(const element of form.elements) {
		if(!(element.name in config)) {
			continue;
		}

		const value = config[element.name];

		if(element.type === "checkbox") {
			element.checked = value;
		} else if(element.type === "radio") {
			element.checked = element.value === value;
		} else {
			element.value = String(value);
		}
	}

	form.elements.depthMaxValue.value = String(config.depthMax);
}

function updateDocuments() {
	const documentA = form.elements["document-a"].value;
	const documentB = form.elements["document-b"].value;

	relief.update("documents", [
		documentA,
		documentB
	]);

	const sizeToStr = bytes => {
		return (bytes > 2**10)
			? `${Math.round(bytes / 1024)} kB`
			: `${bytes} B`;
	}

	document.querySelector("#document-a-size").textContent = sizeToStr(documentA.length);
	document.querySelector("#document-b-size").textContent = sizeToStr(documentB.length);
}


form.elements["document-a"].value ||= DOCUMENT_A;
form.elements["document-b"].value ||= DOCUMENT_B;

syncFormDefaults(relief.getConfig());
updateDocuments();

form.addEventListener("input", (event) => {
	const input = event.target;

	form.elements.depthMaxValue.value = form.elements.depthMax.value;

	if(["document-a", "document-b"].includes(input.name)) {
		updateDocuments();

		return;
	}

	if(input.name === "depthMax") {
		relief.update("depthMax", valueOf(input));

		return;
	}

	relief.update(input.name, valueOf(input));
});