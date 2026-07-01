const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const mergeButton = document.querySelector("#mergeButton");
const statusMessage = document.querySelector("#statusMessage");
const previewMeta = document.querySelector("#previewMeta");
const pageIndicator = document.querySelector("#pageIndicator");
const prevPageButton = document.querySelector("#prevPageButton");
const nextPageButton = document.querySelector("#nextPageButton");
const rotatePageButton = document.querySelector("#rotatePageButton");
const excludePageButton = document.querySelector("#excludePageButton");
const downloadEditedButton = document.querySelector("#downloadEditedButton");
const pdfCanvas = document.querySelector("#pdfCanvas");
const emptyPreview = document.querySelector("#emptyPreview");

let selectedFiles = [];
let activeFileId = null;
let activePage = 1;
let activePdf = null;
let renderTask = null;
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
    setStatus("Select at least 2 PDFs to merge.");
  } else {
    setStatus(`${selectedFiles.length} PDFs ready to merge.`);
  }
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
  }));

  selectedFiles = [...selectedFiles, ...entries];
  if (!activeFileId && entries.length > 0) {
    activeFileId = entries[0].id;
    activePage = 1;
  }
  renderFileList();
  renderPreview();

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
    activePage = 1;
  }
  renderFileList();
  renderPreview();
}

function selectActiveFile(id) {
  activeFileId = id;
  activePage = 1;
  renderFileList();
  renderPreview();
}

function updatePreviewControls(entry, pageCount) {
  const hasPreview = Boolean(entry && pageCount > 0);
  prevPageButton.disabled = !hasPreview || activePage <= 1;
  nextPageButton.disabled = !hasPreview || activePage >= pageCount;
  rotatePageButton.disabled = !hasPreview;
  excludePageButton.disabled = !hasPreview;
  downloadEditedButton.disabled = !hasPreview;
  pageIndicator.textContent = hasPreview ? `${activePage} / ${pageCount}` : "- / -";

  if (entry && hasPreview) {
    const excluded = isPageExcluded(entry, activePage);
    excludePageButton.textContent = excluded ? "Include page" : "Exclude page";
  } else {
    excludePageButton.textContent = "Exclude page";
  }
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

async function renderPreview() {
  const entry = getActiveEntry();
  const token = (renderToken += 1);

  if (renderTask) {
    renderTask.cancel();
    renderTask = null;
  }

  if (!entry || !window.pdfjsLib) {
    activePdf = null;
    pdfCanvas.hidden = true;
    emptyPreview.hidden = false;
    previewMeta.textContent = "Select a PDF to preview it.";
    updatePreviewControls(null, 0);
    return;
  }

  try {
    previewMeta.textContent = `Loading ${entry.file.name}...`;
    const arrayBuffer = await entry.file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    if (token !== renderToken) {
      return;
    }

    activePdf = pdf;
    activePage = Math.min(Math.max(activePage, 1), pdf.numPages);
    const page = await pdf.getPage(activePage);
    const rotation = getPageRotation(entry, activePage);
    const viewport = page.getViewport({ scale: 1.35, rotation });
    const context = pdfCanvas.getContext("2d");

    pdfCanvas.width = Math.floor(viewport.width);
    pdfCanvas.height = Math.floor(viewport.height);
    pdfCanvas.hidden = false;
    emptyPreview.hidden = true;
    context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

    renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    renderTask = null;

    if (token !== renderToken) {
      return;
    }

    const excludedText = isPageExcluded(entry, activePage) ? " This page is excluded from the merge." : "";
    previewMeta.textContent = `${entry.file.name}.${excludedText}`;
    updatePreviewControls(entry, pdf.numPages);
  } catch (error) {
    if (error?.name === "RenderingCancelledException") {
      return;
    }

    activePdf = null;
    pdfCanvas.hidden = true;
    emptyPreview.hidden = false;
    previewMeta.textContent = "Could not preview this PDF.";
    updatePreviewControls(entry, 0);
  }
}

function goToPage(direction) {
  if (!activePdf) {
    return;
  }

  activePage = Math.min(Math.max(activePage + direction, 1), activePdf.numPages);
  renderPreview();
}

function rotateActivePage() {
  const entry = getActiveEntry();
  if (!entry) {
    return;
  }

  const key = pageKey(activePage);
  entry.rotations[key] = (getPageRotation(entry, activePage) + 90) % 360;
  renderPreview();
}

function toggleExcludeActivePage() {
  const entry = getActiveEntry();
  if (!entry) {
    return;
  }

  if (isPageExcluded(entry, activePage)) {
    entry.excludedPages = entry.excludedPages.filter((pageNumber) => pageNumber !== activePage);
  } else {
    entry.excludedPages = [...entry.excludedPages, activePage].sort((a, b) => a - b);
  }

  renderPreview();
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
      const file = entry.file;
      let sourcePdf;

      try {
        const arrayBuffer = await file.arrayBuffer();
        sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
      } catch (error) {
        throw new Error(`"${file.name}" is not a valid PDF.`);
      }

      const includedPageIndices = sourcePdf
        .getPageIndices()
        .filter((pageIndex) => !isPageExcluded(entry, pageIndex + 1));

      if (includedPageIndices.length === 0) {
        continue;
      }

      const copiedPages = await mergedPdf.copyPages(sourcePdf, includedPageIndices);
      copiedPages.forEach((page, copiedIndex) => {
        const sourcePageNumber = includedPageIndices[copiedIndex] + 1;
        const rotation = getPageRotation(entry, sourcePageNumber);

        if (rotation > 0) {
          page.setRotation(PDFLib.degrees(rotation));
        }

        mergedPdf.addPage(page);
      });
    }

    if (mergedPdf.getPageCount() === 0) {
      throw new Error("Every page is excluded. Include at least one page before merging.");
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
    const includedPageIndices = sourcePdf
      .getPageIndices()
      .filter((pageIndex) => !isPageExcluded(entry, pageIndex + 1));

    if (includedPageIndices.length === 0) {
      throw new Error("Every page is excluded. Include at least one page before downloading.");
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

    const editedBytes = await outputPdf.save();
    const blob = new Blob([editedBytes], { type: "application/pdf" });
    const baseName = entry.file.name.replace(/\.pdf$/i, "");
    downloadBlob(blob, `${baseName}-edited.pdf`);
    setStatus("Edited PDF download started.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while editing this PDF.", true);
  } finally {
    updatePreviewControls(entry, activePdf?.numPages || 0);
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
prevPageButton.addEventListener("click", () => goToPage(-1));
nextPageButton.addEventListener("click", () => goToPage(1));
rotatePageButton.addEventListener("click", rotateActivePage);
excludePageButton.addEventListener("click", toggleExcludeActivePage);
downloadEditedButton.addEventListener("click", downloadEditedPdf);

renderFileList();
renderPreview();
