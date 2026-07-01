# PDF Editor

A static browser-side PDF editor for building one final PDF from one or more uploaded files. PDFs are staged first, then each staged file can be appended to the editor individually. The editor shows page thumbnails on the left and a scrollable full-document preview on the right.

## Features

- Add PDFs by file picker or drag and drop.
- Append each staged PDF to the editor with its own **Add** button.
- Append the same PDF multiple times if needed.
- Keep adding more PDFs after editing has started.
- Select one or more pages from the left thumbnail rail.
- Drag selected thumbnails to reorder pages, including multiple selected pages at once.
- Rotate selected pages.
- Delete selected pages from the final document.
- Export the edited result as `final.pdf`.
- Process everything locally in the browser.

## How To Use

1. Open `index.html` in a browser.
2. Drop PDFs into the upload area, or click it to choose files.
3. In the staged file list, click **Add** beside any PDF to append that PDF to the editor.
4. Use the left thumbnail rail to select pages.
5. Use `Ctrl`/`Cmd` click or `Shift` click to select multiple pages.
6. Drag thumbnails to reorder pages. If multiple pages are selected, dragging one selected page moves the selected group.
7. Use **Rotate selected** or **Delete selected** for page edits.
8. Click **Export final PDF** to download `final.pdf`.

## Libraries

The app uses CDN-hosted browser libraries:

```html
https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js
https://unpkg.com/pdf-lib/dist/pdf-lib.min.js
```

- [`PDF.js`](https://mozilla.github.io/pdf.js/) renders previews.
- [`pdf-lib`](https://pdf-lib.js.org/) creates the exported PDF.

## Run Locally

Open `index.html` directly in a web browser. No backend, build step, Python, Node runtime, or file upload server is required.

## Host On GitHub Pages

1. Push `index.html`, `styles.css`, `script.js`, and `README.md` to a GitHub repository.
2. In the repository, open **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the branch that contains these files, usually `main`, and choose the root folder.
6. Save the settings and open the published GitHub Pages URL after deployment finishes.

## Privacy

All PDF processing happens locally in the user's browser. Files are not uploaded to a backend or file server.
