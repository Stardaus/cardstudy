import { openDB } from './data/db.js';
import { App } from './app.js';
import { Toast } from './ui/components/toast.js';

async function bootstrap() {
  try {
    // 1. Initialize DB
    await openDB();
    console.log('Database initialized successfully.');

    // 2. Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered with scope:', registration.scope);

        // Optional: Listen for updates and notify user
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              Toast.show('App update available! Refresh to get the latest version.', 'info', 0); // Show indefinitely
            }
          });
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
        Toast.show('Offline features might not be available.', 'error');
      }
    } else {
      console.warn('Service Workers are not supported in this browser.');
      Toast.show('Your browser does not support offline features.', 'error');
    }

    // 3. Mount App
    const app = new App('app');
    app.start();
    console.log('Application started.');

  } catch (error) {
    console.error('Application bootstrap failed:', error);
    Toast.show('An critical error occurred during startup.', 'error');
  }
}

bootstrap();
