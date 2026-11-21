import './style.css';
import { Game } from './client/game';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');

const game = new Game(canvas);
// Handy for poking at the run from the browser console while tuning.
(window as unknown as { dbd: Game }).dbd = game;
