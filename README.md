# PDF Merger

A simple static web app for combining multiple PDF files directly in the browser. Users can select or drag and drop PDF files, reorder them, remove files from the list, merge them, and download the result as `combined.pdf`.

The app uses [`pdf-lib`](https://pdf-lib.js.org/) from the CDN:

```html
https://unpkg.com/pdf-lib/dist/pdf-lib.min.js
```

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
