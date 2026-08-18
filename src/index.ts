import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerOpenApi } from './lib/openapi/register'
import acr from './routes/acr'
import cto from './routes/cto'
import dtr from './routes/dtr'
import locator from './routes/locator'
import oar from './routes/oar'
import ocf from './routes/ocf'
import otc from './routes/otc'
import otaf from './routes/otaf'

const app = new OpenAPIHono()

app.get('/', (c) => {
  return c.text('Hello Hono! Docs: /docs  Spec: /doc')
})

app.route('/otaf', otaf)
app.route('/ocf', ocf)
app.route('/oar', oar)
app.route('/otc', otc)
app.route('/cto', cto)
app.route('/dtr', dtr)
app.route('/acr', acr)
app.route('/locator', locator)

registerOpenApi(app)

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Municipality of Magsaysay HRPMS Forms API',
    version: '1.0.0',
    description:
      'CRUD and A4 PDF endpoints for overtime, DTR, attendance correction, and locator slip forms.',
  },
  tags: [
    { name: 'Meta', description: 'Service health' },
    { name: 'OTAF', description: 'Overtime Authorization Form' },
    { name: 'OCF', description: 'Overtime Cancellation Form' },
    { name: 'OAR', description: 'Overtime Accomplishment Report' },
    { name: 'OTC', description: 'Overtime Certification' },
    { name: 'CTO', description: 'Compensatory Time Off Application' },
    { name: 'DTR', description: 'Daily Time Record' },
    { name: 'ACR', description: 'Attendance Correction Request' },
    { name: 'Locator', description: 'Locator Slip and Certificate of Appearance' },
  ],
})

app.get('/docs', swaggerUI({ url: '/doc' }))

export default app
