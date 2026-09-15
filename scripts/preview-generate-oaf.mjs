import { readFileSync, writeFileSync } from 'fs'
import { generateOafPdf } from '../src/lib/oaf/generate-oaf.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateOafPdf(
  {
    controlNumber: 'OTA-AM-2026-00001',
    dateFiled: '09/15/2026',
    originalOtaControlNumber: 'OTA-2026-00042',
    dateApproved: '09/10/2026',
    employeeId: 'EMP-00123',
    employeeName: 'JUAN DELA CRUZ',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'Permanent',
    originalDateOfOvertime: '09/18/2026',
    originalDaysOfWeek: 'Friday',
    originalTimeIn: '05:00 PM',
    originalTimeOut: '09:00 PM',
    originalTotalHours: '04:00',
    newDateOfOvertime: '09/18/2026',
    newDaysOfWeek: 'Friday',
    newTimeIn: '06:00 PM',
    newTimeOut: '09:00 PM',
    newTotalHours: '03:00',
    reasonForAmendment: 'Adjusted start time due to a scheduled council session.',
    requestedBy: 'JUAN DELA CRUZ',
    requestedByDate: '09/15/2026',
    recommendedBy: 'MARIA SANTOS',
    recommendedByDate: '09/15/2026',
    approvedBy: 'CESAR M. TRIA JR',
    approvedByDate: '09/16/2026',
    verifiedBy: 'ANA CRUZ',
    verifiedByDate: '09/16/2026',
    hrmoReceivedBy: 'ANA CRUZ',
    hrmoReceivedDate: '09/16/2026',
    hrmoEncodedBy: 'ANA CRUZ',
    hrmoEncodedDate: '09/16/2026',
    hrmoRemarks: 'Encoded to overtime ledger.',
  },
  logo,
)

writeFileSync('assets/oaf-generated-preview.pdf', bytes)
console.log('wrote assets/oaf-generated-preview.pdf', bytes.length)
