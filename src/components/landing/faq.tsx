import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Accent, SectionHeading } from "@/components/shared/section-heading"
import { Reveal } from "@/components/shared/reveal"

const faqs = [
  {
    q: "How does Lumora avoid making things up?",
    a: "Lumora uses retrieval-augmented generation (RAG). Before answering, it retrieves the most relevant passages from your workspace and instructs the model to answer only from them, citing each source. If nothing relevant is found, it says so instead of guessing.",
  },
  {
    q: "Which file types can I upload?",
    a: "PDF, Markdown, plain text, CSV and JSON. Files are parsed, split into passages and indexed automatically — usually in a few seconds.",
  },
  {
    q: "What can the agent actually do?",
    a: "Out of the box it can create support tickets, draft emails and schedule meetings through tool calls. Every action is shown in the chat with its inputs and result, so a human always stays in the loop.",
  },
  {
    q: "Which AI models are supported?",
    a: "Google Gemini is the default, with Llama via Groq as an automatic fallback. The model layer is provider-agnostic, so Claude, GPT or a self-hosted model can be plugged in with a single configuration change.",
  },
  {
    q: "Is my data used to train models?",
    a: "No. Your documents are only used to answer your team's questions. Workspaces are isolated from each other, and requests are rate-limited to prevent abuse.",
  },
  {
    q: "Can I try it without signing up?",
    a: "Yes. Open the live demo and you'll land in a sample workspace pre-loaded with a company handbook, policies and reports — ask it anything.",
  },
]

export function Faq() {
  return (
    <section id="faq" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeading
          align="left"
          eyebrow="FAQ"
          title={
            <>
              Questions, <Accent>answered</Accent>
            </>
          }
          description="Everything you need to know about how Lumora works."
        />
        <Reveal>
          <Accordion className="rounded-3xl border bg-card/50 px-6 backdrop-blur-sm">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="py-5 text-base hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
