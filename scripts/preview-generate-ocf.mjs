import { readFileSync, writeFileSync } from 'fs'
import { generateOcfPdf } from '../src/lib/ocf/generate-ocf.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateOcfPdf(
  {
    otcNumber: 'OTC-2026-00001',
    dateFiled: '08/10/2026',
    otaControlNumber: 'OTA-2026-000042',
    dateApproved: '08/08/2026',
    employeeId: 'EMP-00123',
    employeeName: 'JUAN DELA CRUZ',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    dateOfOvertime: '08/12/2026',
    daysOfWeek: 'Tuesday',
    timeIn: '05:00 PM',
    timeOut: '09:00 PM',
    approvedTotalHours: '04:00',
    purposeJustification: 'Year-end payroll encoding and report consolidation.',
    reasonForCancellation: 'Overtime no longer required; task completed during regular hours.',
    requestedBy: 'JUAN DELA CRUZ',
    requestedByPosition: 'Administrative Aide III',
    requestedByOffice: "Municipal Mayor's Office",
    dateRequested: '08/10/2026',
    approvedBy: 'PEDRO REYES',
    approvedByPosition: 'Department Head',
    approvedByOffice: "Municipal Mayor's Office",
    approvedByDate: '08/10/2026',
  },
  logo,
)

writeFileSync('assets/ocf-generated-preview.pdf', bytes)
console.log('wrote assets/ocf-generated-preview.pdf', bytes.length)
