import { useState } from 'react'

export const View = ({ location, params, navigate }) => {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Product {params.id}</h1>
    </>
  )
}