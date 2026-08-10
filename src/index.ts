import { Hono } from 'hono'
import ocf from './routes/ocf'
import otaf from './routes/otaf'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/otaf', otaf)
app.route('/ocf', ocf)

export default app
