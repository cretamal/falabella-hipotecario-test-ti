import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** El arranque de la app en el navegador (en el servidor se encarga `main.server.ts`). */
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
