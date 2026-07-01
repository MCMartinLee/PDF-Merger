const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const mergeButton = document.querySelector("#mergeButton");
const statusMessage = document.querySelector("#statusMessage");
const previewMeta = document.querySelector("#previewMeta");
const rotatePageButton = document.querySelector("#rotatePageButton");
const excludePageButton = document.querySelector("#excludePageButton");
const restorePageButton = document.querySelector("#restorePageButton");
const downloadEditedButton = document.querySelector("#downloadEditedButton");
const thumbnailList = document.querySelector("#thumbnailList");
const documentPages = document.querySelector("#documentPages");
const emptyPreview = document.querySelector("#emptyPreview");

let selectedFiles = [];
let activeFileId = null;
let activePdf = null;
let renderToken = 0;

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
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

function updateMergeButton() {
  mergeButton.disabled = selectedFiles.length < 2;
}

function getActiveEntry() {
  return selectedFiles.find((entry) => entry.id === activeFileId) || null;
}

function pageKey(pageNumber) {
  return String(pageNumber);
}

function getPageRotation(entry, pageNumber) {
  return entry.rotations[pageKey(pageNumber)] || 0;
}

function isPageExcluded(entry, pageNumber) {
  return entry.excludedPages.includes(pageNumber);
}

function getSelectedPages(entry) {
  return [...entry.selectedPages].sort((a, b) => a - b);
}

function hasSelectedPages(entry) {
  return Boolean(entry && entry.selectedPages.size > 0);
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

  selectedFiles.forEach((entry, index) => {
    const file = entry.file;
    const item = document.createElement("li");
    item.className = "file-card";
    item.classList.toggle("is-active", entry.id === activeFileId);

    const details = document.createElement("div");

    const name = document.createElement("p");
    name.className = "file-name";
    name.textContent = file.name;

    const meta = document.createElement("p");
    meta.className = "file-meta";
    meta.textContent = `${index + 1}. ${formatFileSize(file.size)}`;

    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const previewButton = createActionButton("View", "Preview", () => selectActiveFile(entry.id));
    const upButton = createActionButton("^", "Move up", () => moveFile(index, -1));
    upButton.disabled = index === 0;

    const downButton = createActionButton("v", "Move down", () => moveFile(index, 1));
    downButton.disabled = index === selectedFiles.length - 1;

    const removeButton = createActionButton("x", "Remove", () => removeFile(index));
    removeButton.classList.add("remove");

    actions.append(previewButton, upButton, downButton, removeButton);
    item.append(details, actions);
    fileList.append(item);
  });

  updateMergeButton();

  if (selectedFiles.length === 0) {
    setStatus("No files selected.");
  } else if (selectedFiles.length === 1) {
    setStatus("Select at least 2 PDFs to merge, or edit/download this one.");
  } else {
    setStatus(`${selectedFiles.length} PDFs ready to merge.`);
  }
}

function updateEditorControls() {
  const entry = getActiveEntry();
  const hasSelection = hasSelectedPages(entry);
  const hasPdf = Boolean(entry && activePdf);

  rotatePageButton.disabled = !hasSelection;
  excludePageButton.disabled = !hasSelection;
  restorePageButton.disabled = !entry || entry.excludedPages.length === 0;
  downloadEditedButton.disabled = !hasPdf;
}

function updatePreviewMeta() {
  const entry = getActiveEntry();

  if (!entry || !activePdf) {
    previewMeta.textContent = "Select a PDF to preview it.";
    return;
  }

  const selectedCount = entry.selectedPages.size;
  const excludedCount = entry.excludedPages.length;
  const selectedText = selectedCount === 1 ? "1 page selected" : `${selectedCount} pages selected`;
  const visibleCount = activePdf.numPages - excludedCount;
  const removedText = excludedCount === 1 ? "1 page deleted" : `${excludedCount} pages deleted`;
  previewMeta.textContent = `${entry.file.name} - ${visibleCount} visible pages. ${selectedText}. ${removedText}.`;
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

function addFiles(files) {
  const incomingFiles = Array.from(files);
  const invalidFiles = incomingFiles.filter((file) => !isPdf(file));
  const pdfFiles = incomingFiles.filter(isPdf);

  const entries = pdfFiles.map((file) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    file,
    excludedPages: [],
    rotations: {},
    selectedPages: new Set(),
  }));

  selectedFiles = [...selectedFiles, ...entries];
  if (!activeFileId && entries.length > 0) {
    activeFileId = entries[0].id;
  }

  renderFileList();
  renderEditor();

  if (invalidFiles.length > 0) {
    setStatus("Only .pdf files can be added.", true);
  }
}

function moveFile(index, direction) {
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= selectedFiles.length) {
    return;
  }

  const [file] = selectedFiles.splice(index, 1);
  selectedFiles.splice(newIndex, 0, file);
  renderFileList();
}

function removeFile(index) {
  const [removed] = selectedFiles.splice(index, 1);
  if (removed.id === activeFileId) {
    activeFileId = selectedFiles[0]?.id || null;
  }

  renderFileList();
  renderEditor();
}

function selectActiveFile(id) {
  activeFileId = id;
  renderFileList();
  renderEditor();
}

function selectPage(entry, pageNumber, event) {
  if (event.shiftKey) {
    entry.selectedPages.add(pageNumber);
  } else if (event.ctrlKey || event.metaKey) {
    if (entry.selectedPages.has(pageNumber)) {
      entry.selectedPages.delete(pageNumber);
    } else {
      entry.selectedPages.add(pageNumber);
    }
  } else {
    entry.selectedPages.clear();
    entry.selectedPages.add(pageNumber);
  }

  updatePageSelection(entry);
  updatePreviewMeta();
  updateEditorControls();

  document.querySelector(`[data-document-page="${pageNumber}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function updatePageSelection(entry) {
  document.querySelectorAll("[data-page-number]").forEach((element) => {
    const pageNumber = Number(element.dataset.pageNumber);
    const selected = entry.selectedPages.has(pageNumber);

    element.classList.toggle("is-selected", selected);
    element.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

async function renderCanvasPage(pdf, pageNumber, canvas, scale, rotation) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  context.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;
}

function createThumbnail(entry, pageNumber) {
  const button = document.createElement("button");
  button.className = "thumbnail-card";
  button.type = "button";
  button.dataset.pageNumber = pageNumber;
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Select page ${pageNumber}`);
  button.addEventListener("click", (event) => selectPage(entry, pageNumber, event));

  const canvas = document.createElement("canvas");
  const label = document.createElement("span");
  label.className = "thumbnail-label";
  label.textContent = `Page ${pageNumber}`;

  button.append(canvas, label);
  return { button, canvas };
}

function createDocumentPage(pageNumber) {
  const wrapper = document.createElement("article");
  wrapper.className = "document-page";
  wrapper.dataset.documentPage = pageNumber;

  const label = document.createElement("p");
  label.className = "document-page-label";
  label.textContent = `Page ${pageNumber}`;

  const canvas = document.createElement("canvas");

  wrapper.append(label, canvas);
  return { wrapper, canvas };
}

async function renderEditor() {
  const entry = getActiveEntry();
  const token = (renderToken += 1);

  thumbnailList.innerHTML = "";
  documentPages.innerHTML = "";
  activePdf = null;
  updateEditorControls();

  if (!entry || !window.pdfjsLib) {
    emptyPreview.hidden = false;
    previewMeta.textContent = "Select a PDF to preview it.";
    return;
  }

  try {
    emptyPreview.hidden = true;
    previewMeta.textContent = `Loading ${entry.file.name}...`;

    const arrayBuffer = await entry.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (token !== renderToken) {
      return;
    }

    activePdf = pdf;

    const visiblePages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (!isPageExcluded(entry, pageNumber)) {
        visiblePages.push(pageNumber);
      }
    }

    entry.selectedPages.forEach((pageNumber) => {
      if (!visiblePages.includes(pageNumber)) {
        entry.selectedPages.delete(pageNumber);
      }
    });

    if (entry.selectedPages.size === 0 && visiblePages.length > 0) {
      entry.selectedPages.add(visiblePages[0]);
    }

    emptyPreview.hidden = visiblePages.length > 0;
    if (visiblePages.length === 0) {
      emptyPreview.textContent = "All pages are deleted. Use Undo delete to bring them back.";
    } else {
      emptyPreview.textContent = "Your selected PDF will appear here.";
    }

    const renderJobs = [];

    visiblePages.forEach((pageNumber) => {
      const rotation = getPageRotation(entry, pageNumber);
      const thumbnail = createThumbnail(entry, pageNumber);
      const documentPage = createDocumentPage(pageNumber);

      thumbnailList.append(thumbnail.button);
      documentPages.append(documentPage.wrapper);

      renderJobs.push(renderCanvasPage(pdf, pageNumber, thumbnail.canvas, 0.22, rotation));
      renderJobs.push(renderCanvasPage(pdf, pageNumber, documentPage.canvas, 1.15, rotation));
    });

    updatePageSelection(entry);
    updatePreviewMeta();
    updateEditorControls();

    await Promise.all(renderJobs);

    if (token !== renderToken) {
      return;
    }

    updatePageSelection(entry);
  } catch (error) {
    if (token !== renderToken) {
      return;
    }

    activePdf = null;
    thumbnailList.innerHTML = "";
    documentPages.innerHTML = "";
    emptyPreview.hidden = false;
    previewMeta.textContent = "Could not preview this PDF.";
    updateEditorControls();
  }
}

function rotateSelectedPages() {
  const entry = getActiveEntry();
  if (!hasSelectedPages(entry)) {
    return;
  }

  getSelectedPages(entry).forEach((pageNumber) => {
    const key = pageKey(pageNumber);
    entry.rotations[key] = (getPageRotation(entry, pageNumber) + 90) % 360;
  });

  renderEditor();
}

function excludeSelectedPages() {
  const entry = getActiveEntry();
  if (!hasSelectedPages(entry)) {
    return;
  }

  entry.excludedPages = [...new Set([...entry.excludedPages, ...getSelectedPages(entry)])].sort((a, b) => a - b);
  entry.selectedPages.clear();
  renderEditor();
}

function restoreDeletedPages() {
  const entry = getActiveEntry();
  if (!entry || entry.excludedPages.length === 0) {
    return;
  }

  entry.excludedPages = [];
  renderEditor();
}

function getIncludedPageIndices(sourcePdf, entry) {
  return sourcePdf
    .getPageIndices()
    .filter((pageIndex) => !isPageExcluded(entry, pageIndex + 1));
}

async function copyEditedPages(sourcePdf, outputPdf, entry) {
  const includedPageIndices = getIncludedPageIndices(sourcePdf, entry);

  if (includedPageIndices.length === 0) {
    return 0;
  }

  const copiedPages = await outputPdf.copyPages(sourcePdf, includedPageIndices);
  copiedPages.forEach((page, copiedIndex) => {
    const sourcePageNumber = includedPageIndices[copiedIndex] + 1;
    const rotation = getPageRotation(entry, sourcePageNumber);

    if (rotation > 0) {
      page.setRotation(PDFLib.degrees(rotation));
    }

    outputPdf.addPage(page);
  });

  return copiedPages.length;
}

async function mergePdfs() {
  if (selectedFiles.length < 2) {
    return;
  }

  setStatus("Merging PDFs...");
  mergeButton.disabled = true;

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (const entry of selectedFiles) {
      let sourcePdf;

      try {
        sourcePdf = await PDFLib.PDFDocument.load(await entry.file.arrayBuffer());
      } catch (error) {
        throw new Error(`"${entry.file.name}" is not a valid PDF.`);
      }

      await copyEditedPages(sourcePdf, mergedPdf, entry);
    }

    if (mergedPdf.getPageCount() === 0) {
      throw new Error("Every page is deleted. Restore at least one page before merging.");
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    downloadBlob(blob, "combined.pdf");
    setStatus("Done. Download started.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while merging PDFs.", true);
  } finally {
    updateMergeButton();
  }
}

async function downloadEditedPdf() {
  const entry = getActiveEntry();
  if (!entry) {
    return;
  }

  setStatus("Preparing edited PDF...");
  downloadEditedButton.disabled = true;

  try {
    const sourcePdf = await PDFLib.PDFDocument.load(await entry.file.arrayBuffer());
    const outputPdf = await PDFLib.PDFDocument.create();
    await copyEditedPages(sourcePdf, outputPdf, entry);

    if (outputPdf.getPageCount() === 0) {
      throw new Error("Every page is deleted. Restore at least one page before downloading.");
    }

    const editedBytes = await outputPdf.save();
    const blob = new Blob([editedBytes], { type: "application/pdf" });
    const baseName = entry.file.name.replace(/\.pdf$/i, "");
    downloadBlob(blob, `${baseName}-edited.pdf`);
    setStatus("Edited PDF download started.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while editing this PDF.", true);
  } finally {
    updateEditorControls();
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

mergeButton.addEventListener("click", mergePdfs);
rotatePageButton.addEventListener("click", rotateSelectedPages);
excludePageButton.addEventListener("click", excludeSelectedPages);
restorePageButton.addEventListener("click", restoreDeletedPages);
downloadEditedButton.addEventListener("click", downloadEditedPdf);

renderFileList();
renderEditor();
