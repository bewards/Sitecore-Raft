import { WizardProvider } from "@/lib/wizard-state";
import { Wizard } from "@/components/wizard/Wizard";

export default function Home() {
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Sitecore Raft
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Raft your content between Sitecore environments — powered by the Content Transfer &amp;
            Item Transfer APIs
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <WizardProvider>
          <Wizard />
        </WizardProvider>
      </main>
    </div>
  );
}
