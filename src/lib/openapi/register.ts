import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi'
import {
  AcrBody,
  AcrRecord,
  AttendancePreviewQuery,
  AttendancePunchBatch,
  CtoBody,
  CtoRecord,
  DtrBody,
  DtrRecord,
  ErrorSchema,
  IdParam,
  LocatorBody,
  LocatorRecord,
  OarBody,
  OarRecord,
  OcfBody,
  OcfRecord,
  OkSchema,
  OtafBody,
  OtafRecord,
  OtcBody,
  OtcRecord,
  PdfSchema,
  itemSchema,
  listSchema,
} from './schemas'

type AnyZod = z.ZodType

function jsonBody(schema: AnyZod) {
  return {
    content: {
      'application/json': { schema },
    },
  }
}

function pdfResponse() {
  return {
    description: 'A4 PDF download',
    content: {
      'application/pdf': { schema: PdfSchema },
    },
  }
}

function htmlResponse(description: string) {
  return {
    description,
    content: {
      'text/html': { schema: z.string() },
    },
  }
}

function registerDownloadAndForm(
  app: OpenAPIHono,
  opts: {
    tag: string
    prefix: string
    title: string
    body: AnyZod
    formPath?: string
  },
) {
  const { tag, prefix, title, body } = opts
  const formPath = opts.formPath ?? `${prefix}/form`

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: formPath,
      tags: [tag],
      summary: `${title} HTML form`,
      responses: { 200: htmlResponse('HTML form') },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: `${prefix}/download`,
      tags: [tag],
      summary: `Download ${title} PDF (query params)`,
      request: { query: body },
      responses: { 200: pdfResponse() },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: `${prefix}/download`,
      tags: [tag],
      summary: `Download ${title} PDF`,
      request: {
        body: {
          required: true,
          content: {
            'application/json': { schema: body },
            'application/x-www-form-urlencoded': { schema: body },
            'multipart/form-data': { schema: body },
          },
        },
      },
      responses: { 200: pdfResponse() },
    }),
  )
}

function registerCrud(
  app: OpenAPIHono,
  opts: {
    tag: string
    prefix: string
    title: string
    body: AnyZod
    record: AnyZod
  },
) {
  const { tag, prefix, title, body, record } = opts
  const listed = listSchema(record, `${tag}List`)
  const wrapped = itemSchema(record, `${tag}Item`)

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: prefix,
      tags: [tag],
      summary: `List ${title} records`,
      responses: { 200: { description: 'Record list', ...jsonBody(listed) } },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: prefix,
      tags: [tag],
      summary: `Create ${title} record`,
      request: {
        body: { required: true, ...jsonBody(body) },
      },
      responses: {
        201: { description: 'Created', ...jsonBody(wrapped) },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: `${prefix}/{id}`,
      tags: [tag],
      summary: `Get ${title} record`,
      request: { params: IdParam },
      responses: {
        200: { description: 'Record', ...jsonBody(wrapped) },
        404: { description: 'Not found', ...jsonBody(ErrorSchema) },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'put',
      path: `${prefix}/{id}`,
      tags: [tag],
      summary: `Replace ${title} record`,
      request: {
        params: IdParam,
        body: { required: true, ...jsonBody(body) },
      },
      responses: {
        200: { description: 'Updated', ...jsonBody(wrapped) },
        404: { description: 'Not found', ...jsonBody(ErrorSchema) },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'patch',
      path: `${prefix}/{id}`,
      tags: [tag],
      summary: `Partially update ${title} record`,
      request: {
        params: IdParam,
        body: { required: true, ...jsonBody(body) },
      },
      responses: {
        200: { description: 'Updated', ...jsonBody(wrapped) },
        404: { description: 'Not found', ...jsonBody(ErrorSchema) },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'delete',
      path: `${prefix}/{id}`,
      tags: [tag],
      summary: `Delete ${title} record`,
      request: { params: IdParam },
      responses: {
        200: { description: 'Deleted', ...jsonBody(OkSchema) },
        404: { description: 'Not found', ...jsonBody(ErrorSchema) },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: `${prefix}/{id}/pdf`,
      tags: [tag],
      summary: `Download saved ${title} PDF`,
      request: { params: IdParam },
      responses: {
        200: pdfResponse(),
        404: { description: 'Not found', ...jsonBody(ErrorSchema) },
      },
    }),
  )
}

export function registerOpenApi(app: OpenAPIHono) {
  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Meta'],
      summary: 'Health / hello',
      responses: {
        200: {
          description: 'Plain text greeting',
          content: { 'text/plain': { schema: z.string().openapi({ example: 'Hello Hono!' }) } },
        },
      },
    }),
  )

  registerDownloadAndForm(app, {
    tag: 'OTAF',
    prefix: '/otaf',
    title: 'Overtime Authorization Form',
    body: OtafBody,
  })
  registerCrud(app, {
    tag: 'OTAF',
    prefix: '/otaf',
    title: 'Overtime Authorization Form',
    body: OtafBody,
    record: OtafRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'OCF',
    prefix: '/ocf',
    title: 'Overtime Cancellation Form',
    body: OcfBody,
  })
  registerCrud(app, {
    tag: 'OCF',
    prefix: '/ocf',
    title: 'Overtime Cancellation Form',
    body: OcfBody,
    record: OcfRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'OAR',
    prefix: '/oar',
    title: 'Overtime Accomplishment Report',
    body: OarBody,
  })
  registerCrud(app, {
    tag: 'OAR',
    prefix: '/oar',
    title: 'Overtime Accomplishment Report',
    body: OarBody,
    record: OarRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'OTC',
    prefix: '/otc',
    title: 'Overtime Certification',
    body: OtcBody,
  })
  registerCrud(app, {
    tag: 'OTC',
    prefix: '/otc',
    title: 'Overtime Certification',
    body: OtcBody,
    record: OtcRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'CTO',
    prefix: '/cto',
    title: 'Compensatory Time Off Application',
    body: CtoBody,
  })
  registerCrud(app, {
    tag: 'CTO',
    prefix: '/cto',
    title: 'Compensatory Time Off Application',
    body: CtoBody,
    record: CtoRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'DTR',
    prefix: '/dtr',
    title: 'Daily Time Record',
    body: DtrBody,
  })
  registerCrud(app, {
    tag: 'DTR',
    prefix: '/dtr',
    title: 'Daily Time Record',
    body: DtrBody,
    record: DtrRecord,
  })

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: '/dtr/attendance/punches',
      tags: ['DTR'],
      summary: 'Ingest ZKTeco / BioTime punch logs',
      request: { body: { required: true, ...jsonBody(AttendancePunchBatch) } },
      responses: { 201: { description: 'Stored punches', ...jsonBody(z.object({ data: z.array(z.unknown()) })) } },
    }),
  )
  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/dtr/attendance/punches',
      tags: ['DTR'],
      summary: 'List stored punch logs',
      responses: { 200: { description: 'Punch list', ...jsonBody(z.object({ data: z.array(z.unknown()) })) } },
    }),
  )
  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/dtr/attendance/preview',
      tags: ['DTR'],
      summary: 'Preview DTR day rows from punches (no overtime)',
      request: { query: AttendancePreviewQuery },
      responses: { 200: { description: 'Computed DTR days', ...jsonBody(z.object({ data: DtrBody })) } },
    }),
  )

  registerDownloadAndForm(app, {
    tag: 'ACR',
    prefix: '/acr',
    title: 'Attendance Correction Request',
    body: AcrBody,
  })
  registerCrud(app, {
    tag: 'ACR',
    prefix: '/acr',
    title: 'Attendance Correction Request',
    body: AcrBody,
    record: AcrRecord,
  })

  registerDownloadAndForm(app, {
    tag: 'Locator',
    prefix: '/locator',
    title: 'Locator Slip / Certificate of Appearance',
    body: LocatorBody,
  })
  registerCrud(app, {
    tag: 'Locator',
    prefix: '/locator',
    title: 'Locator Slip / Certificate of Appearance',
    body: LocatorBody,
    record: LocatorRecord,
  })
}
