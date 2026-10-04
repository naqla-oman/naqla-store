import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { TRACKING_MODULE } from "../modules/tracking"
import type TrackingModuleService from "../modules/tracking/service"

type Input = { update: Record<string, unknown> }

/** تحديث إعدادات التتبع مع استرجاع القيم السابقة عند الفشل */
const updateTrackingSettingsStep = createStep("update-tracking-settings", async ({ update }: Input, { container }) => {
  const tracking = container.resolve<TrackingModuleService>(TRACKING_MODULE)
  const before = await tracking.getSettings()
  const after = await tracking.updateTrackingSettings({ ...update, id: before.id } as any)
  return new StepResponse(after, before)
}, async (before, { container }) => {
  if (before) await container.resolve<TrackingModuleService>(TRACKING_MODULE).updateTrackingSettings(before as any)
})

export const updateTrackingSettingsWorkflow = createWorkflow("update-tracking-settings", (input: Input) => {
  return new WorkflowResponse(updateTrackingSettingsStep(input))
})
