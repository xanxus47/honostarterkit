import { readFileSync, writeFileSync } from 'fs'
import { generateDtrPdf } from '../src/lib/dtr/generate-dtr.ts'

const logo = readFileSync('assets/LGU-otaf.png')
const bytes = await generateDtrPdf(
  {
    controlNumber: 'DTR-2026-00001',
    dateIssued: '2026-08-12',
    employeeName: 'JUAN DELA CRUZ',
    employeeId: 'EMP-00123',
    position: 'Administrative Aide III',
    officeDepartment: "Municipal Mayor's Office",
    employmentStatus: 'permanent',
    payrollGroup: 'Regular',
    periodFrom: '2026-08-01',
    periodTo: '2026-08-31',
    numberOfDays: '22',
    days: [
      {
        day: 1,
        amIn: '08:00',
        amOut: '12:00',
        pmIn: '13:00',
        pmOut: '17:00',
        totalHoursWorked: '08:00',
      },
      {
        day: 4,
        amIn: '08:05',
        amOut: '12:00',
        pmIn: '13:00',
        pmOut: '17:00',
        undertimeMinutes: '5',
        totalHoursWorked: '07:55',
        remarks: 'Late',
      },
    ],
    totalHoursWorked: '176:00',
    totalOvertime: '08:00',
    totalUndertime: '15',
    totalMinutesLate: '20',
    employeeSignatureName: 'JUAN DELA CRUZ',
    employeeSignatureDate: '2026-08-31',
    supervisorSignatureName: 'MARIA SANTOS',
    supervisorPosition: 'Supervising Admin Officer',
    supervisorDate: '2026-08-31',
    departmentHeadSignatureName: 'PEDRO REYES',
    departmentHeadPosition: 'Department Head',
    departmentHeadDate: '2026-08-31',
    hrmoSignatureName: 'ANA CRUZ',
    hrmoDate: '2026-09-01',
  },
  logo,
)

writeFileSync('assets/dtr-generated-preview.pdf', bytes)
console.log('wrote assets/dtr-generated-preview.pdf', bytes.length)
