# Flashcard Fun PWA

## Local Development

To test locally with a setup that mirrors production (Netlify/GitHub Pages):

1.  **Install Dependencies:** (Optional, but good practice)
    ```bash
    npm install
    ```

2.  **Start Server:**
    ```bash
    npm start
    ```
    This will launch a static server at `http://localhost:8080` (or another port if 8080 is busy).

## Deployment

### Netlify
- **Build command:** (None, or `echo "Ready"`)
- **Publish directory:** `.` (Current directory)
- `_redirects` and `netlify.toml` are included for configuration.

### GitHub Pages
- Source: root branch
