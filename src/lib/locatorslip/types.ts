export type LocatorFormData = {
  locatorControlNo?: string
  dateFiled?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string

  purposeOfficialBusiness?: boolean
  purposeFieldWork?: boolean
  purposeMeeting?: boolean
  purposeTraining?: boolean
  purposeDataCollection?: boolean
  purposeProject?: boolean
  purposeOthers?: boolean
  purposeOthersText?: string

  locationAddress?: string
  barangay?: string
  municipalityCity?: string
  province?: string
  nearestLandmark?: string

  dateFrom?: string
  timeFrom?: string
  timeFromAm?: boolean
  timeFromPm?: boolean
  dateTo?: string
  timeTo?: string
  timeToAm?: boolean
  timeToPm?: boolean
  totalDuration?: string
  durationHours?: boolean
  durationDays?: boolean

  mobileNumber?: string
  commCall?: boolean
  commSms?: boolean
  commViber?: boolean
  commEmail?: boolean
  commOthers?: boolean
  commOthersText?: string

  employeeSignatureName?: string
  employeeSignatureDate?: string

  supervisorSignatureName?: string
  supervisorDate?: string
  departmentHeadSignatureName?: string
  departmentHeadDate?: string

  receivedByHrmo?: string
  dateReceived?: string
  recordedInSystemBy?: string
  locatorSlipNo?: string

  certificateControlNo?: string
  dateIssued?: string
  appearanceEmployeeName?: string
  appearanceEmployeeId?: string
  appearancePosition?: string
  appearanceOffice?: string
  appearanceLocation?: string
  appearancePurpose?: string
  dateOfAppearance?: string
  timeOfAppearance?: string
  appearanceTimeAm?: boolean
  appearanceTimePm?: boolean
  timeOfDeparture?: string
  departureTimeAm?: boolean
  departureTimePm?: boolean
  activityUndertaken?: string
  remarksSummary?: string

  ackSignatureName?: string
  ackDate?: string

  certifiedByName?: string
  certifiedByPosition?: string
  certifiedByOffice?: string
  certifiedByDate?: string
  certifiedByContact?: string

  certReceivedByHrmo?: string
  certDateReceived?: string
  certRecordedBy?: string
  certReferenceNo?: string
  certLocatorSlipNo?: string
  certControlNoRecord?: string
}

export type LocatorRecord = LocatorFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
