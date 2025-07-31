import { useState } from 'react'
import { Component } from './component';

export function View() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Component/>
      <button onClick={() => setCount(count + 1)}>{count}</button>
    </>
  )
}
