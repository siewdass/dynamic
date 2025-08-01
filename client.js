import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const routing = async () => {
  const files = import.meta.glob('./src/**/*.{jsx,tsx}', { eager: true });
  let routes = Object.entries(files)
    .filter(([_, module]) => typeof module.View === 'function')
    .reduce((manifest, [path]) => {
      const cleanName = path
        .replace(/^\.{0,2}\/src/, '')
        .replace(/(?:\/index)?\.(tsx|jsx)$/, '')
        .replace(/\[([^\]]+)]/g, ':$1')
        .replace(/\/+$/, '')
        .replace('index', '')
        .toLowerCase() || '/';
      
      manifest[cleanName] = path
      return manifest;
    }, {});

  if (process.env.NODE_ENV === 'production') {
    const response = await fetch('/manifest.json');
    const { client } = await response.json();
    routes = client.routes
  }

  return routes;
};

const createLazyElement = (importPath) => {
  return React.createElement(
    Suspense,
    { fallback: React.createElement('div', null, 'Loading...') },
    React.createElement(
      lazy(async () => {
        try {
          const module = await import(/* @vite-ignore */ importPath);
          if (
            (process.env.NODE_ENV === 'development' && !module.View) ||
            (process.env.NODE_ENV === 'production' && !module._?.View)
          ) {
            throw new Error(`Componente View no encontrado en ${importPath}`);
          }

          const View =
            process.env.NODE_ENV === 'development' ? module.View : module._.View;

          return { default: View };
        } catch (error) {
          console.error('Error loading component:', error);
          return { default: () => React.createElement('div', null, 'Error loading component') };
        }
      })
    )
  );
}

const routes = Object.entries(await routing()).map(([path, file]) => {
  console.log(path,file)
  return { path, element: createLazyElement(file) };
})

const App = () => {
  return React.createElement(
    Routes,
    null,
    routes.map(({ path, element }) =>
      React.createElement(Route, { key: path, path: path, element: element })
    ),
    React.createElement(Route, { path: "*", element: React.createElement(Navigate, { to: "/", replace: true }) })
  );
};

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(
    BrowserRouter,
    null,
    React.createElement(App, null)
  )
);

//export default {};