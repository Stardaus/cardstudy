import { $ } from '../utils/dom.js';

export class Router {
  constructor(routes, rootElementId = 'app') {
    this.routes = routes; // Map path -> ScreenClass
    this.rootElement = $(`#${rootElementId}`);
    if (!this.rootElement) {
      console.error(`Router: Root element #${rootElementId} not found.`);
      return;
    }

    window.addEventListener('hashchange', this._onHashChange.bind(this));
    // Initial route load
    this._onHashChange();
  }

  _onHashChange() {
    const path = window.location.hash.slice(1) || 'home';
    this.navigate(path);
  }

  async navigate(path) {
    // GUARD: Ensure target exists
    if (!this.routes[path]) {
      console.warn(`Route ${path} not found, redirecting home`);
      window.location.hash = 'home';
      return;
    }

    const ScreenClass = this.routes[path];
    const screenInstance = new ScreenClass();

    // Clear previous content
    this.rootElement.innerHTML = '';

    try {
      // Render the screen. Assuming screens have a render method that takes the root element.
      await screenInstance.render(this.rootElement);
      // Update hash if not already set (e.g., direct navigation from _onHashChange)
      if (window.location.hash.slice(1) !== path) {
        window.location.hash = path;
      }
    } catch (error) {
      console.error(`Error rendering screen for path ${path}:`, error);
      // Fallback to home or show an error screen
      if (path !== 'home') {
        this.navigate('home');
      } else {
        this.rootElement.innerHTML = '<p>An unexpected error occurred.</p>';
      }
    }
  }
}
