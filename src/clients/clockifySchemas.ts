import z from 'zod'

export const reportTimeEntrySchema = z.object({
  _id: z.string(),
  userId: z.string(),
  userName: z.string(),
  clientId: z.string().nullish(),
  clientName: z.string().nullish(),
  projectId: z.string().nullish(),
  projectName: z.string().nullish(),
  billable: z.boolean(),
  timeInterval: z.object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    duration: z.number().int().nonnegative(),
  }),
})

export type ClockifyReportTimeEntry = z.infer<typeof reportTimeEntrySchema>
