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
      "Point at your source and destination environments, set the target database, and check your credentials work.",
  },
  {
    title: "Select content",
    short: "Content",
    description:
      "Pick what to move — pull item trees from serialization modules, add by tag, or type paths in yourself.",
  },
  {
    title: "Create transfer",
    short: "Create",
    description: "Give the request a look, then kick off the transfer on the source.",
  },
  {
    title: "Monitor",
    short: "Monitor",
    description: "Wait for the source to finish packaging everything into chunk sets.",
  },
  {
    title: "Stream chunks",
    short: "Stream",
    description: "Copy every chunk over to the destination and turn each chunk set into a .raif.",
  },
  {
    title: "Consume .raif",
    short: "Consume",
    description: "Pull each .raif into the destination database.",
  },
  {
    title: "Summary & cleanup",
    short: "Summary",
    description: "See how it went, browse the history, and clean up the source transfer when you're done.",
  },
];
