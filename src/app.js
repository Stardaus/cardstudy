import { Router } from './ui/router.js';
import { HomeScreen } from './ui/screens/homeScreen.js';
import { StudyScreen } from './ui/screens/studyScreen.js';
import { BrowseScreen } from './ui/screens/browseScreen.js';
import { SettingsScreen } from './ui/screens/settingsScreen.js';
import { SetupScreen } from './ui/screens/setupScreen.js';

export class App {
  constructor(rootElementId) {
    this.rootElementId = rootElementId;
    this.router = null;
    this._defineRoutes();
  }

  _defineRoutes() {
    this.routes = {
      'home': HomeScreen,
      'study': StudyScreen,
      'browse': BrowseScreen,
      'settings': SettingsScreen,
      'setup': SetupScreen,
    };
  }

  start() {
    this.router = new Router(this.routes, this.rootElementId);
  }
}
