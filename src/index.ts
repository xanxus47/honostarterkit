import { Hono } from 'hono'
import oar from './routes/oar'
import ocf from './routes/ocf'
import otaf from './routes/otaf'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/otaf', otaf)
app.route('/ocf', ocf)
app.route('/oar', oar)

export default app
