"use client"

import { useState } from "react"
import { FileUp, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCan } from "@/components/app/viewer"
import { importContacts } from "@/lib/crm/actions/crm"
import { parseCsv } from "@/lib/crm/csv"
import { PendingButton, primaryButton, secondaryButton, useAction } from "./client"
import { textareaClass } from "./ui"

const SAMPLE = `name,email,title,company
Rhea Kapoor,rhea@lighthouse.example,CTO,Lighthouse Media
Tomás Rivera,tomas@harbor.example,Head of Support,Harbor Analytics
Grace Lin,grace@newco.example,Operations Manager,NewCo`

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  email: "email",
  "email address": "email",
  title: "title",
  "job title": "title",
  role: "title",
  company: "company",
  organization: "company",
  account: "company",
  phone: "phone",
  "phone number": "phone",
}

export function CsvImport() {
  const can = useCan()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const { pending, exec } = useAction()

  const rows = (() => {
    const table = parseCsv(text.trim())
    if (table.length < 2) return []
    const headers = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null)
    return table.slice(1).map((cells) => Object.fromEntries(headers.flatMap((h, i) => (h && cells[i]?.trim() ? [[h, cells[i].trim()]] : []))))
  })()
  const valid = rows.filter((r) => r.name && r.email)

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!can("crm:write")} className={`${secondaryButton} inline-flex items-center gap-1.5 disabled:opacity-50`}>
        <Upload className="size-4" /> Import
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 p-5 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Import contacts from CSV</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Columns: name, email, title, company, phone. Duplicates (same email) are skipped, companies are created as needed, and every contact is scored.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-violet/40 hover:text-foreground">
            <FileUp className="size-4" /> Choose a .csv file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) setText(await file.text())
              }}
            />
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={`${textareaClass} font-mono text-xs`} placeholder="…or paste CSV here" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{text ? `${valid.length} of ${rows.length} rows ready to import` : "No data yet"}</span>
            <button type="button" onClick={() => setText(SAMPLE)} className="font-medium text-violet hover:underline">
              Use sample data
            </button>
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <button onClick={() => setOpen(false)} className={secondaryButton}>
              Cancel
            </button>
            <PendingButton
              pending={pending}
              disabled={!valid.length}
              className={primaryButton}
              onClick={async () => {
                const result = await exec(() => importContacts(valid), {
                  success: (d) => `Imported ${d.created} contact${d.created === 1 ? "" : "s"}${d.duplicates ? `, skipped ${d.duplicates} duplicate${d.duplicates === 1 ? "" : "s"}` : ""}`,
                })
                if (result) {
                  setOpen(false)
                  setText("")
                }
              }}
            >
              Import {valid.length || ""} contacts
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
