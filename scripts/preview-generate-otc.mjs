import { readFileSync, writeFileSync } from 'fs'
import { generateOtcPdf } from '../src/lib/otc/generate-otc.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateOtcPdf(
  {
    controlNumber: 'OTC-2026-00001',
    dateCertified: '08/11/2026',
    employeeName: 'JUAN DELA CRUZ',
    employeeId: 'EMP-00123',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'Permanent',
    payrollGroup: 'Regular',
    datesOfOvertime: '08/10/2026',
    daysOfWeek: 'Monday',
    approvedOvertimeHours: '04:00',
    actualHoursRendered: '04:00',
    natureOfWork: 'Year-end payroll encoding and consolidation of HR reports.',
    disposition: 'overtimePay',
    supervisorName: 'MARIA SANTOS',
    supervisorDate: '08/11/2026',
    departmentHeadName: 'PEDRO REYES',
    departmentHeadDate: '08/11/2026',
    hrmoName: 'ANA CRUZ',
    hrmoDate: '08/11/2026',
  },
  logo,
)

writeFileSync('assets/otc-generated-preview.pdf', bytes)
console.log('wrote assets/otc-generated-preview.pdf', bytes.length)
