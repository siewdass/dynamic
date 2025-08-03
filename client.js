import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { useLocation, useParams, useNavigate } from 'react-router-dom';

const RemoveTrailingSlash = (props) => {
  if (process.env.NODE_ENV === 'production') {
    Object.entries(import.meta.glob('./src/**/*.{jsx,tsx}', { eager: true }))
  }

  const location = useLocation();

  if (location.pathname.match(/\/+$/)) {
    return React.createElement(Navigate, {
      replace: true,
      to: {
        pathname: location.pathname.replace(/\/+$/, ''),
        search: location.search,
      },
      ...props,
    });
  }

  return null;
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

          const View = process.env.NODE_ENV === 'development' ? module.View : module._.View;

          const Wrapped = () => {
            const location = useLocation();
            const params = useParams();
            const navigate = useNavigate();
            
            return React.createElement(View, { location, params, navigate });
          };

          return { default: Wrapped };
        } catch (error) {
          console.error('Error loading component:', error);
          return { default: () => React.createElement('div', null, 'Error loading component') };
        }
      })
    )
  );
}

const r = window.__ROUTES__ || {}

const routes = Object.entries(r).map(([path, file]) => {
  console.log(path,file)
  return { path, element: createLazyElement(file) };
})

const App = () => {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(RemoveTrailingSlash, null),
    React.createElement(
      Routes,
      null,
      routes.map(({ path, element }) =>
        React.createElement(Route, { key: path, path, element })
      ),
      React.createElement(Route, { path: '*', element: React.createElement(Navigate, { to: '/', replace: true }) })
    )
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
