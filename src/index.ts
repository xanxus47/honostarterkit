import { Hono } from 'hono'
import cto from './routes/cto'
import dtr from './routes/dtr'
import oar from './routes/oar'
import ocf from './routes/ocf'
import otc from './routes/otc'
import otaf from './routes/otaf'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/otaf', otaf)
app.route('/ocf', ocf)
app.route('/oar', oar)
app.route('/otc', otc)
app.route('/cto', cto)
app.route('/dtr', dtr)

export default app
