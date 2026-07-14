export interface StepMeta {
  title: string;
  short: string;
  description: string;
}

/** Ordered wizard steps. Index === WizardState.step. */
export const STEPS: StepMeta[] = [
  {
    title: "Configure environments",
    short: "Configure",
    description:
      "Set the source (PROD) and destination (UAT) hosts and target database, then verify authentication.",
  },
  {
    title: "Select content",
    short: "Content",
    description:
      "Choose the item trees to transfer — import from serialization module.json files and/or add paths manually.",
  },
  {
    title: "Create transfer",
    short: "Create",
    description: "Review the request body and create the content transfer operation on the source.",
  },
  {
    title: "Monitor",
    short: "Monitor",
    description: "Poll the operation until it completes and inspect the generated chunk sets.",
  },
  {
    title: "Stream chunks",
    short: "Stream",
    description:
      "Copy each chunk from source to destination, then complete each chunk set to produce .raif files.",
  },
  {
    title: "Consume .raif",
    short: "Consume",
    description:
      "Consume each .raif file (file-system source) into the destination database via the Item Transfer API.",
  },
  {
    title: "Summary & cleanup",
    short: "Summary",
    description: "Review results, browse history, and optionally delete the source transfer operation.",
  },
];
