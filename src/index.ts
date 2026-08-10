import { Hono } from 'hono'
import otaf from './routes/otaf'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/otaf', otaf)

export default app
