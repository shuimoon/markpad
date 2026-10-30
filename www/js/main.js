import React from '../vendor/react.shim.js';
import { createRoot } from '../vendor/react-dom-client.shim.js';
import { App } from './App.js';
const container = document.getElementById('root');
if (!container)
    throw new Error('root element missing');
createRoot(container).render(React.createElement(React.StrictMode, null,
    React.createElement(App, null)));
