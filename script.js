const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const statusMessage = document.querySelector("#statusMessage");
const previewMeta = document.querySelector("#previewMeta");
const rotatePageButton = document.querySelector("#rotatePageButton");
const excludePageButton = document.querySelector("#excludePageButton");
const exportButton = document.querySelector("#exportButton");
const thumbnailList = document.querySelector("#thumbnailList");
const documentPages = document.querySelector("#documentPages");
const emptyPreview = document.querySelector("#emptyPreview");

let stagedFiles = [];
let editorPages = [];
let renderToken = 0;
let draggedPageIds = [];
const pdfPreviewCache = new Map();

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function isPdf(file) {
  return file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function getSelectedPages() {
  return editorPages.filter((page) => page.selected);
}

function updateControls() {
  const hasSelection = getSelectedPages().length > 0;
  rotatePageButton.disabled = !hasSelection;
  excludePageButton.disabled = !hasSelection;
  exportButton.disabled = editorPages.length === 0;
}

function updateStatus() {
  if (stagedFiles.length === 0) {
    setStatus("No files selected.");
    return;
  }

  const label = stagedFiles.length === 1 ? "1 PDF ready" : `${stagedFiles.length} PDFs ready`;
  setStatus(`${label}. Add a PDF row to append it to the editor.`);
}

function updatePreviewMeta() {
  const selectedCount = getSelectedPages().length;
  const pageLabel = editorPages.length === 1 ? "1 page" : `${editorPages.length} pages`;
  const selectedLabel = selectedCount === 1 ? "1 page selected" : `${selectedCount} pages selected`;
  previewMeta.textContent = editorPages.length > 0
    ? `Final document: ${pageLabel}. ${selectedLabel}.`
    : "Add PDFs to the editor to preview the final document.";
}

function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
}

function createActionButton(label, title, onClick) {
  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", onClick);
  return button;
}

function renderFileList() {
  fileList.innerHTML = "";

  stagedFiles.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "file-card";

    const details = document.createElement("div");

    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = entry.file.name;

    const meta = document.createElement("p");
    meta.className = "file-meta";
    meta.textContent = `${index + 1}. ${formatFileSize(entry.file.size)}`;

    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const addButton = createActionButton("Add", "Add to editor", () => addPdfToEditor(entry));

    const removeButton = createActionButton("x", "Remove", () => removeStagedFile(index));
    removeButton.classList.add("remove");

    actions.append(addButton, removeButton);
    item.append(details, actions);
    fileList.append(item);
  });

  updateControls();
  updateStatus();
}

function addFiles(files) {
  const incomingFiles = Array.from(files);
  const invalidFiles = incomingFiles.filter((file) => !isPdf(file));
  const pdfFiles = incomingFiles.filter(isPdf);
  const entries = pdfFiles.map((file) => ({ id: makeId(), file }));

  stagedFiles = [...stagedFiles, ...entries];
  renderFileList();

  if (invalidFiles.length > 0) {
    setStatus("Only .pdf files can be added.", true);
  }
}

function removeStagedFile(index) {
  stagedFiles.splice(index, 1);
  renderFileList();
}

async function getPreviewPdf(entry) {
  if (pdfPreviewCache.has(entry.id)) {
    return pdfPreviewCache.get(entry.id);
  }

  const pdf = await pdfjsLib.getDocument({ data: await entry.file.arrayBuffer() }).promise;
  pdfPreviewCache.set(entry.id, pdf);
  return pdf;
}

async function addPdfToEditor(entry) {
  if (!entry || !window.pdfjsLib) {
    return;
  }

  setStatus(`Adding ${entry.file.name} to editor...`);

  try {
    const pagesToAppend = [];
    const pdf = await getPreviewPdf(entry);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      pagesToAppend.push({
        id: makeId(),
        source: entry,
        sourcePageNumber: pageNumber,
        rotation: 0,
        selected: false,
      });
    }

    editorPages = [...editorPages, ...pagesToAppend];
    setStatus(`${entry.file.name} appended to the editor.`);
    renderFileList();
    renderEditor();
  } catch (error) {
    setStatus(error.message || "Could not add this PDF to the editor.", true);
    updateControls();
  }
}

function selectPage(pageId, event) {
  const page = editorPages.find((item) => item.id === pageId);
  if (!page) {
    return;
  }

  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    page.selected = !page.selected;
  } else {
    editorPages.forEach((item) => {
      item.selected = item.id === pageId;
    });
  }

  updatePageSelection();
  updatePreviewMeta();
  updateControls();

  document.querySelector(`[data-document-page-id="${pageId}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function updatePageSelection() {
  document.querySelectorAll("[data-page-id]").forEach((element) => {
    const page = editorPages.find((item) => item.id === element.dataset.pageId);
    const selected = Boolean(page?.selected);
    element.classList.toggle("is-selected", selected);
    element.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function getDragPageIds(pageId) {
  const page = editorPages.find((item) => item.id === pageId);
  if (!page) {
    return [];
  }

  if (!page.selected) {
    editorPages.forEach((item) => {
      item.selected = item.id === pageId;
    });
    updatePageSelection();
    updatePreviewMeta();
    updateControls();
  }

  return editorPages.filter((item) => item.selected).map((item) => item.id);
}

function moveDraggedPages(targetPageId, placeAfterTarget) {
  if (draggedPageIds.length === 0 || draggedPageIds.includes(targetPageId)) {
    return;
  }

  const draggedIdSet = new Set(draggedPageIds);
  const draggedPages = editorPages.filter((page) => draggedIdSet.has(page.id));
  const remainingPages = editorPages.filter((page) => !draggedIdSet.has(page.id));
  const targetIndex = remainingPages.findIndex((page) => page.id === targetPageId);

  if (targetIndex === -1) {
    return;
  }

  remainingPages.splice(targetIndex + (placeAfterTarget ? 1 : 0), 0, ...draggedPages);
  editorPages = remainingPages;
  renderEditor();
}

async function renderCanvasPage(page, canvas, scale) {
  const pdf = await getPreviewPdf(page.source);
  const pdfPage = await pdf.getPage(page.sourcePageNumber);
  const viewport = pdfPage.getViewport({ scale, rotation: page.rotation });
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  context.clearRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({ canvasContext: context, viewport }).promise;
}

function createThumbnail(page, pageIndex) {
  const button = document.createElement("button");
  button.className = "thumbnail-card";
  button.type = "button";
  button.draggable = true;
  button.dataset.pageId = page.id;
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Select final page ${pageIndex + 1}`);
  button.addEventListener("click", (event) => selectPage(page.id, event));
  button.addEventListener("dragstart", (event) => {
    draggedPageIds = getDragPageIds(page.id);
    button.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedPageIds.join(","));
  });
  button.addEventListener("dragend", () => {
    draggedPageIds = [];
    document.querySelectorAll(".thumbnail-card").forEach((element) => {
      element.classList.remove("is-dragging", "is-drop-target");
    });
  });
  button.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggedPageIds.includes(page.id)) {
      const placeAfterTarget = event.offsetY > button.offsetHeight / 2;
      button.classList.add("is-drop-target");
      button.classList.toggle("is-drop-after", placeAfterTarget);
    }
  });
  button.addEventListener("dragleave", () => {
    button.classList.remove("is-drop-target", "is-drop-after");
  });
  button.addEventListener("drop", (event) => {
    event.preventDefault();
    const placeAfterTarget = event.offsetY > button.offsetHeight / 2;
    button.classList.remove("is-drop-target", "is-drop-after");
    moveDraggedPages(page.id, placeAfterTarget);
  });

  const canvas = document.createElement("canvas");
  const label = document.createElement("span");
  label.className = "thumbnail-label";
  label.textContent = `Page ${pageIndex + 1}`;

  button.append(canvas, label);
  return { button, canvas };
}

function createDocumentPage(page, pageIndex) {
  const wrapper = document.createElement("article");
  wrapper.className = "document-page";
  wrapper.dataset.documentPageId = page.id;

  const label = document.createElement("p");
  label.className = "document-page-label";
  label.textContent = `Page ${pageIndex + 1} - ${page.source.file.name}`;

  const canvas = document.createElement("canvas");

  wrapper.append(label, canvas);
  return { wrapper, canvas };
}

async function renderEditor() {
  const token = (renderToken += 1);
  thumbnailList.innerHTML = "";
  documentPages.innerHTML = "";
  emptyPreview.hidden = editorPages.length > 0;
  emptyPreview.textContent = "Add PDFs to the editor to preview the final document.";

  updatePreviewMeta();
  updateControls();

  if (editorPages.length === 0) {
    return;
  }

  const renderJobs = [];

  editorPages.forEach((page, index) => {
    const thumbnail = createThumbnail(page, index);
    const documentPage = createDocumentPage(page, index);

    thumbnailList.append(thumbnail.button);
    documentPages.append(documentPage.wrapper);

    renderJobs.push(renderCanvasPage(page, thumbnail.canvas, 0.22));
    renderJobs.push(renderCanvasPage(page, documentPage.canvas, 1.15));
  });

  updatePageSelection();

  try {
    await Promise.all(renderJobs);
    if (token !== renderToken) {
      return;
    }
    updatePageSelection();
  } catch (error) {
    if (token !== renderToken) {
      return;
    }

    thumbnailList.innerHTML = "";
    documentPages.innerHTML = "";
    emptyPreview.hidden = false;
    emptyPreview.textContent = "Could not preview the editor document.";
  }
}

function rotateSelectedPages() {
  const selectedPages = getSelectedPages();
  if (selectedPages.length === 0) {
    return;
  }

  selectedPages.forEach((page) => {
    page.rotation = (page.rotation + 90) % 360;
  });

  renderEditor();
}

function deleteSelectedPages() {
  const selectedPages = getSelectedPages();
  if (selectedPages.length === 0) {
    return;
  }

  const selectedIds = new Set(selectedPages.map((page) => page.id));
  editorPages = editorPages.filter((page) => !selectedIds.has(page.id));
  renderEditor();
}

async function exportFinalPdf() {
  if (editorPages.length === 0) {
    return;
  }

  setStatus("Exporting final PDF...");
  exportButton.disabled = true;

  try {
    const outputPdf = await PDFLib.PDFDocument.create();
    const sourceCache = new Map();

    for (const page of editorPages) {
      if (!sourceCache.has(page.source.id)) {
        sourceCache.set(page.source.id, await PDFLib.PDFDocument.load(await page.source.file.arrayBuffer()));
      }

      const sourcePdf = sourceCache.get(page.source.id);
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [page.sourcePageNumber - 1]);

      if (page.rotation > 0) {
        copiedPage.setRotation(PDFLib.degrees(page.rotation));
      }

      outputPdf.addPage(copiedPage);
    }

    const finalBytes = await outputPdf.save();
    const blob = new Blob([finalBytes], { type: "application/pdf" });
    downloadBlob(blob, "final.pdf");
    setStatus("Final PDF export started.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while exporting the final PDF.", true);
  } finally {
    updateControls();
  }
}

fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  addFiles(event.dataTransfer.files);
});

rotatePageButton.addEventListener("click", rotateSelectedPages);
excludePageButton.addEventListener("click", deleteSelectedPages);
exportButton.addEventListener("click", exportFinalPdf);

renderFileList();
renderEditor();
