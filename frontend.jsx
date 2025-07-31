import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

const routing = () => {
  const files = import.meta.glob('./src/**/*.{jsx,tsx}', { eager: true });
  return Object.entries(files).filter(([_, module]) => typeof module.View === 'function').map(([path]) => path)
}

const createLazyElement = (importPath) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {React.createElement(
        lazy(async () => {
          try {
            const module = await import(/* @vite-ignore */ importPath) 
            if (
              (process.env.NODE_ENV === 'development' && !module.View) ||
              (process.env.NODE_ENV === 'production' && !module._?.View)
            ) {
              throw new Error(`Componente View no encontrado en ${importPath}`);
            }

            const View =
              process.env.NODE_ENV === 'development'
                ? module.View
                : module._.View;

            return { default: View };
          } catch (error) {
            console.error('Error loading component:', error);
            return { default: () => <div>Error loading component</div> };
          }
        })
      )}
    </Suspense>
  )
}
console.log(routing())
const routes = routing().map((filePath) => {
  const path = filePath
    .replace(/^\.{0,2}\/src/, '')
    .replace(/(?:\/index)?\.(tsx|jsx)$/, '')
    .replace(/\[([^\]]+)]/g, ':$1')
    .replace(/\/+$/, '')
    .replace('index', '')
    .toLowerCase() || '/';
    
  const route = process.env.NODE_ENV === 'development' ? filePath : filePath
    .replace(/^\.{0,2}\/src/, '') 
    .replace(/\.(tsx|jsx)$/, '.js');

  console.log(path, route)
  return { path, element: createLazyElement(route) }
})

const App = () => {
  return (
    <Routes>
      {routes.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

if (import.meta.hot) {
  import.meta.hot.accept('/node_modules/.vite/manifiest.json', () => {
    console.log('ss')
  })
}

export default {}