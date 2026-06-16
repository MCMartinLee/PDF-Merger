const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const mergeButton = document.querySelector("#mergeButton");
const statusMessage = document.querySelector("#statusMessage");

let selectedFiles = [];

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

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    item.className = "file-card";

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

    const upButton = createActionButton("^", "Move up", () => moveFile(index, -1));
    upButton.disabled = index === 0;

    const downButton = createActionButton("v", "Move down", () => moveFile(index, 1));
    downButton.disabled = index === selectedFiles.length - 1;

    const removeButton = createActionButton("x", "Remove", () => removeFile(index));
    removeButton.classList.add("remove");

    actions.append(upButton, downButton, removeButton);
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

  selectedFiles = [...selectedFiles, ...pdfFiles];
  renderFileList();

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
  selectedFiles.splice(index, 1);
  renderFileList();
}

async function mergePdfs() {
  if (selectedFiles.length < 2) {
    return;
  }

  setStatus("Merging PDFs...");
  mergeButton.disabled = true;

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (const file of selectedFiles) {
      let sourcePdf;

      try {
        const arrayBuffer = await file.arrayBuffer();
        sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
      } catch (error) {
        throw new Error(`"${file.name}" is not a valid PDF.`);
      }

      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "combined.pdf";
    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
    setStatus("Done. Download started.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while merging PDFs.", true);
  } finally {
    updateMergeButton();
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

renderFileList();
