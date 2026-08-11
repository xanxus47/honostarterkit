import { readFileSync, writeFileSync } from 'fs'
import { generateOarPdf } from '../src/lib/oar/generate-oar.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateOarPdf(
  {
    controlNumber: 'OTAR-2026-00001',
    dateFiled: '08/11/2026',
    employeeId: 'EMP-00123',
    employeeName: 'JUAN DELA CRUZ',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'Permanent',
    payrollGroup: 'Regular',
    dateOfOvertime: '08/10/2026',
    dayOfWeek: 'Monday',
    approvedTimeIn: '05:00 PM',
    approvedTimeOut: '09:00 PM',
    approvedTotalHours: '04:00',
    actualTimeIn: '05:00 PM',
    actualTimeOut: '09:15 PM',
    actualTotalHours: '04:15',
    activitiesPerformed: 'Completed year-end payroll encoding and validated biometric logs.',
    outputsDeliverables: 'Finalized payroll worksheet and exception report for HRMO.',
    problemsEncountered: 'Minor delay due to incomplete DTR of two contractual staff.',
    supervisorRating: 'verySatisfactory',
    commentsRecommendations: 'Work completed as approved. Continue timely submission of OTAR.',
    employeeSignatureName: 'JUAN DELA CRUZ',
    employeeSignatureDate: '08/11/2026',
    supervisorSignatureName: 'MARIA SANTOS',
    supervisorPosition: 'Supervising Admin Officer',
    supervisorSignatureDate: '08/11/2026',
  },
  logo,
)

writeFileSync('assets/oar-generated-preview.pdf', bytes)
console.log('wrote assets/oar-generated-preview.pdf', bytes.length)
