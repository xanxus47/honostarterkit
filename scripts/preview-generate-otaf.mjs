import { readFileSync, writeFileSync } from 'fs'
import { generateOtafPdf } from '../src/lib/otaf/generate-otaf.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateOtafPdf(
  {
    controlNumber: 'OTA-2026-000001',
    dateRequested: '08/10/2026',
    employeeName: 'JUAN DELA CRUZ',
    employeeId: 'EMP-00123',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'permanent',
    dateOfOvertime: '08/12/2026',
    timeIn: '05:00 PM',
    timeOut: '09:00 PM',
    estimatedTotalHours: '04:00',
    purposeJustification:
      'Completion of urgent payroll encoding and year-end report consolidation requiring after-office hours.',
    activityProject: 'HRIS Year-End Closing',
    fundingSource: 'General Fund / MOOE',
    supervisorName: 'MARIA SANTOS',
    supervisorPosition: 'Supervising Admin Officer',
    supervisorDate: '08/10/2026',
    departmentHeadName: 'PEDRO REYES',
    departmentHeadPosition: 'Department Head',
    departmentHeadDate: '08/10/2026',
    hrmoName: 'ANA CRUZ',
    hrmoPosition: 'HRMO',
    hrmoDate: '08/11/2026',
    employeeSignatureName: 'JUAN DELA CRUZ',
    employeeSignatureDate: '08/10/2026',
  },
  logo,
)

writeFileSync('assets/otaf-generated-preview.pdf', bytes)
console.log('wrote assets/otaf-generated-preview.pdf', bytes.length)
