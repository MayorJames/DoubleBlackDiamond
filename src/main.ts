import './style.css';
import { App } from './app/app';

const app = new App();
// Handy for poking at a run from the browser console.
(window as unknown as { dbd: App }).dbd = app;
