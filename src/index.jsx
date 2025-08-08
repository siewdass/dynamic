import { useState } from 'react'

export const View = () => {
	const [ count, setCount ] = useState(0)


	console.log('envs', import.meta.env)

	return (
		<>
			<h1>Home</h1>
			<button onClick={() => setCount(count + 1)}>{count}</button>
		</>
	)
}