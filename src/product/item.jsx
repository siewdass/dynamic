import { useState } from 'react'

export const View = () => {
	const [ count, setCount ] = useState(0)

	return (
		<>
			<h1>Item</h1>
			<button onClick={() => setCount(count + 1)}>{count}</button>
		</>
	)
}