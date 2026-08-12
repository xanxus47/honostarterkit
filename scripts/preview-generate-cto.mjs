import { readFileSync, writeFileSync } from 'fs'
import { generateCtoPdf } from '../src/lib/cto/generate-cto.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateCtoPdf(
  {
    controlNumber: 'CTO-2026-00001',
    dateFiled: '2026-08-12',
    employeeName: 'JUAN DELA CRUZ',
    employeeId: 'EMP-00123',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'Permanent',
    payrollGroup: 'Regular',
    overtimeCertificationNo: 'OTC-2026-00042',
    datesEarned: '2026-08-10',
    totalEarnedCtoHours: '04:00',
    availableCtoBalance: '12:00',
    datesRequested: '2026-08-15',
    timeFrom: '08:00 AM',
    timeTo: '12:00 PM',
    totalHoursRequested: '04:00',
    purposeReason: 'Personal transaction with government agency requiring half-day leave.',
    employeeSignatureName: 'JUAN DELA CRUZ',
    employeeSignatureDate: '2026-08-12',
    supervisorDecision: 'approved',
    supervisorRemarks: 'Recommended for approval.',
    supervisorPrintedName: 'MARIA SANTOS',
    supervisorPosition: 'Supervising Admin Officer',
    supervisorDate: '2026-08-12',
    deptHeadDecision: 'approved',
    deptHeadPrintedName: 'PEDRO REYES',
    deptHeadDate: '2026-08-12',
    earnedCtoCredits: '12:00',
    hoursRequested: '04:00',
    remainingCtoBalance: '08:00',
    hrmoVerifiedBy: 'ANA CRUZ',
    hrmoVerifiedDate: '2026-08-12',
  },
  logo,
)

writeFileSync('assets/cto-generated-preview.pdf', bytes)
console.log('wrote assets/cto-generated-preview.pdf', bytes.length)
