Berikut versi roadmap engineering yang bisa langsung kamu jadikan dokumen arah pengembangan `Sopflow`.

# Sopflow Engineering Roadmap

## Objective

Sopflow adalah hasil ekstraksi modul penyusunan dan visualisasi SOP dari aplikasi `sop-ta` menjadi reusable TypeScript/NPM ecosystem.

Targetnya bukan memindahkan seluruh feature `sop-ta` menjadi package, tetapi mengambil bagian yang bersifat reusable:

```text
SOP data model
      ↓
workflow graph
      ↓
validation
      ↓
mutation / operations
      ↓
editor
      ↓
diagram
      ↓
adapter / profile
```

`@sopflow/*` harus dapat digunakan oleh aplikasi lain tanpa membawa dependency terhadap database, NestJS API, autentikasi, OPD, workflow approval, atau state aplikasi `sop-ta`.

Di `sop-ta`, domain SOP saat ini sudah memiliki pemisahan relatif jelas antara model, application/editor, diagram, print, dan API. Ini menjadi baseline ekstraksi.

---

# 1. Source Domain Extraction

Tahap pertama adalah memetakan model canonical SOP dari `sop-ta` ke model yang lebih generic.

Model lama menggunakan `ProsedurRow` dengan:

```text
id
urutan
kegiatan
pelaksana
kelengkapan
waktu
satuanWaktu
keluaran
keterangan
type
terminatorRole
decision branches
```

dan model pelaksana terpisah.

Model tersebut kemudian dinormalisasi menjadi `SOPDocument`:

```ts
SOPDocument
├─ id
├─ title
├─ actors[]
└─ steps[]
```

dengan explicit step variants:

```text
StartStep
TaskStep
DecisionStep
EndStep
```

Perubahan penting dari `sop-ta` adalah bahwa `start` dan `end` menjadi domain concept eksplisit.

Pada `sop-ta`, backend hanya menyimpan `AWAL_AKHIR`, sedangkan `terminatorRole: "start" | "end"` masih merupakan informasi UI.

Sopflow menghilangkan ambiguity tersebut.

### Deliverable

```text
@sopflow/core

types.ts
schema.ts
```

### Exit criteria

Canonical SOP tidak bergantung pada DTO, React, API, Prisma, atau struktur database `sop-ta`.

---

# 2. Workflow Core Engine

Setelah canonical model stabil, workflow semantics dipindahkan ke pure TypeScript engine.

Di `sop-ta`, workflow masih memiliki dua sumber semantics.

Decision memakai explicit reference:

```text
id_next_step_if_yes
id_next_step_if_no
```

sedangkan step biasa masih dapat diteruskan berdasarkan sequence `urutan`. Renderer membangun fallback connection ke row berikutnya.

Sopflow menggantinya dengan explicit graph:

```text
start    → next

task     → next

decision → yes
         → no

end      → ∅
```

Array `steps` hanya mempertahankan stable presentation order.

Execution semantics berasal dari graph edges.

Core engine menyediakan:

```text
lookup
successor
predecessor
reachability
end reachability
cycle detection
graph traversal
```

### Deliverable

```text
graph.ts
```

### Exit criteria

Tidak ada workflow rule yang perlu direimplementasi oleh renderer atau editor.

---

# 3. Validation and Parsing

Validation dibagi menjadi dua level.

**Structural validation** menjawab:

```text
Apakah input berbentuk SOPDocument yang valid?
```

**Semantic validation** menjawab:

```text
Apakah workflow-nya masuk akal?
```

Core invariant mencakup:

```text
exactly one start
at least one end
unique step IDs
unique actor IDs
valid actor references
valid edge references
all steps reachable
every non-end step can reach an end
```

Cycle diperbolehkan apabila tetap memiliki escape path menuju end.

Hal ini berbeda dari readiness validation di `sop-ta`.

Editor `sop-ta` saat ini mengharuskan kegiatan, kelengkapan, keluaran, waktu, keterangan, dan pelaksana terisi sebelum prosedur dianggap lengkap.

Aturan tersebut tidak dimasukkan ke generic core karena bersifat domain/profile-specific.

Pipeline:

```text
unknown
   ↓
Zod schema
   ↓
structural validation
   ↓
semantic validation
   ↓
SOPDocument
```

### Deliverable

```text
schema.ts
validate.ts
parse.ts
```

### Exit criteria

Semua untrusted input dapat masuk melalui satu boundary:

```ts
parseSop(input)
```

---

# 4. Immutable Mutation Engine

Editor tidak boleh mengubah graph secara ad hoc.

Core menyediakan primitive mutation:

```text
addStep
updateStep
removeStep
connectStep
connectDecisionBranch
```

Semua mutation bersifat immutable:

```text
Document A
   ↓ operation
Document B
```

Input document tidak dimodifikasi.

Mutation layer juga memegang local safety seperti:

```text
duplicate ID
unknown source
unknown target
unknown actor
invalid operation for step type
```

`Sopflow` sengaja memisahkan local mutation validity dan final document validity.

Ini memungkinkan editor menjalankan composed changes yang sementara belum lengkap.

### Deliverable

```text
mutate.ts
```

### Exit criteria

UI tidak perlu menyentuh struktur `steps` secara manual.

---

# 5. Serializable Operation Model

Setiap perubahan editor kemudian direpresentasikan sebagai data.

Contoh:

```ts
{
  type: "connect",
  from: "review",
  to: "approve"
}
```

atau:

```ts
{
  type: "add-step",
  step: {...}
}
```

Operation model menjadi common protocol antara:

```text
UI
AI
history
audit
network
diff
replay
```

Pipeline:

```text
SopOperation
     ↓
applyOperation()
     ↓
mutation primitive
     ↓
SOPDocument
```

Beberapa operation dapat dijalankan sebagai satu logical transaction:

```text
Document
   +
Operation[]
   ↓
candidate document
   ↓
validate
   ↓
commit / reject
```

### Deliverable

```text
operations.ts
applyOperation()
applyOperations()
applyValidatedOperations()
```

### Exit criteria

Editor dan future AI layer hanya mengirim operation intent, bukan mengimplementasikan mutation logic sendiri.

---

# 6. History Engine

Karena operation dan document bersifat immutable, core dapat memberikan generic history.

```text
past
present
future
```

Behavior:

```text
apply
undo
redo
```

Ketika user melakukan edit baru setelah undo:

```text
A → B → C

undo

A → B → C
    ↑

new edit

A → B → D
```

redo branch `C` dibuang.

### Deliverable

```text
history.ts
```

### Exit criteria

Undo/redo tidak membutuhkan logic React-specific.

---

# 7. Package Boundary and Distribution

Setelah core stabil, source diubah menjadi package reusable.

Target package pertama:

```text
@sopflow/core
```

Public API berasal dari satu entry point:

```ts
import {
  parseSop,
  validateSop,
  applyOperation,
  createHistory,
  type SOPDocument,
} from "@sopflow/core"
```

Internal module path tidak menjadi public contract.

Build pipeline:

```text
src/
 ↓
tsdown
 ↓
dist/
 ↓
pnpm pack
 ↓
external consumer
```

Package harus diuji dengan consumer terpisah, bukan hanya melalui source test.

### Deliverable

```text
package.json
tsdown.config.ts
dist/index.js
dist/index.d.ts
```

### Exit criteria

Package `.tgz` dapat di-install oleh project kosong dan seluruh public API dapat digunakan tanpa mengakses source repo.

---

# 8. React Editor Extraction

Setelah core stabil, editor dari `sop-ta` mulai diekstrak.

Editor lama sudah memiliki behavior:

```text
add row
delete row
change step type
change actor
edit activity
edit input
edit duration
edit output
edit note
configure decision
```

Saat ini behavior tersebut masih hidup di React hook dan memodifikasi `ProsedurRow[]` berdasarkan index.

Di Sopflow, behavior tersebut diubah menjadi:

```text
UI event
   ↓
SopOperation
   ↓
@sopflow/core
   ↓
new SOPDocument
```

Target public API:

```tsx
<SopEditor
  value={document}
  onChange={setDocument}
/>
```

Editor harus controlled dan tidak mengetahui database atau API.

### Package

```text
@sopflow/react
```

### Scope v0

```text
actors editor
steps table
step form
decision editor
validation panel
undo / redo
```

### Tidak termasuk

```text
autosave
backend requests
OPD
permissions
approval workflow
revision conflict
```

Autosave `sop-ta`, misalnya, memiliki revision tracking dan single-writer scheduler yang merupakan concern aplikasi, bukan editor package.

---

# 9. Diagram Engine Extraction

`Sop-ta` sudah memiliki diagram subsystem yang cukup besar:

```text
diagram/
├─ core
├─ route
├─ workflow
├─ layout
├─ shapes
├─ components
└─ edit
```

Bagian reusable-nya harus dipisahkan dari React renderer.

Target architecture:

```text
SOPDocument
     ↓
layoutSop()
     ↓
DiagramModel
     ↓
renderer
```

`DiagramModel` berisi:

```text
nodes
edges
positions
routes
labels
```

Sopflow tidak membawa presentation compatibility object dari `sop-ta`.

Saat ini `sop-ta` memiliki projection khusus renderer dan persisted arrow path configuration.

Di package baru, projection tersebut dijadikan boundary yang eksplisit.

### Package

```text
@sopflow/diagram
```

atau awalnya:

```text
@sopflow/react/diagram
```

kemudian dipisah apabila API sudah stabil.

### Exit criteria

Layout engine dapat dites tanpa browser atau React.

---

# 10. SOP AP / Government Adapter

`Sop-ta` memiliki banyak metadata yang spesifik untuk SOP pemerintahan:

```text
nomor SOP
tanggal pembuatan
tanggal efektif
dasar hukum
SOP terkait
peringatan
kualifikasi pelaksanaan
peralatan/perlengkapan
pencatatan/pendataan
kepala OPD
```

Data tersebut tidak masuk ke generic `@sopflow/core`.

Sebaliknya dibuat profile atau adapter:

```text
@sopflow/profile-sop-ap
```

atau:

```text
@sopflow/sop-ap
```

Profile dapat menambahkan readiness rules:

```text
input required
output required
duration required
one executor required
government metadata required
```

Dengan ini generic core tetap usable untuk SOP perusahaan, startup, manufacturing, healthcare, atau workflow internal lain.

---

# 11. Sop-ta Compatibility Adapter

Supaya migrasi tidak perlu rewrite sekaligus, Sopflow menyediakan adapter antara model lama dan model canonical.

Pipeline import:

```text
sop-ta ProsedurRow[]
        ↓
adapter
        ↓
SOPDocument
```

Pipeline export:

```text
SOPDocument
    ↓
adapter
    ↓
sop-ta API DTO
```

Existing mapper `sop-ta` sudah menunjukkan pola adapter boundary antara API `LangkahSOP` dan canonical procedure row.

Package adapter awal dapat tetap berada di repo `sop-ta`, bukan harus menjadi public NPM package.

Tujuannya menjaga Sopflow tidak bergantung pada legacy DTO.

---

# 12. AI Operation Layer

AI masuk setelah schema, operation, dan editor stabil.

AI tidak menulis langsung seluruh SOP JSON.

Pipeline:

```text
User instruction
      ↓
LLM
      ↓
SopOperation[]
      ↓
schema validation
      ↓
applyValidatedOperations()
      ↓
preview diff
      ↓
commit
```

Contoh:

```text
"Tambahkan persetujuan manager setelah review"
```

menjadi:

```text
add-step
connect
connect
```

Ini memungkinkan:

```text
preview
reject
undo
audit
replay
```

tanpa memberi AI ownership terhadap workflow invariants.

Package future:

```text
@sopflow/ai
```

Provider harus agnostic.

---

# Target Package Architecture

Struktur jangka menengah:

```text
sopflow/
├─ packages/
│
│  ├─ core/
│  │  ├─ schema
│  │  ├─ graph
│  │  ├─ validation
│  │  ├─ mutation
│  │  ├─ operations
│  │  └─ history
│  │
│  ├─ react/
│  │  └─ SopEditor
│  │
│  ├─ diagram/
│  │  ├─ layout
│  │  └─ routing
│  │
│  ├─ sop-ap/
│  │  └─ government SOP profile
│  │
│  └─ ai/
│     └─ operation generation
│
├─ apps/
│  ├─ playground/
│  └─ docs/
│
└─ examples/
```

Package dependency direction harus tetap:

```text
                core
             ↙    ↓    ↘
          react diagram profile
             ↘    ↓    ↙
                 app

ai → core
```

`core` tidak boleh bergantung balik ke React, diagram, AI, database, atau profile.

---

# Engineering Milestones

| Milestone               | Output                                    | Status  |
| ----------------------- | ----------------------------------------- | ------- |
| M1 Domain extraction    | Canonical `SOPDocument`                   | Done    |
| M2 Core graph           | Explicit workflow graph                   | Done    |
| M3 Validation           | Structural + semantic validation          | Done    |
| M4 Mutation             | Immutable mutations                       | Done    |
| M5 Operations           | Serializable editor intent                | Done    |
| M6 History              | Undo / redo                               | Done    |
| M7 Package distribution | `@sopflow/core` build + external consumer | Current |
| M8 Playground           | Real consumer application                 | Next    |
| M9 React editor         | `@sopflow/react`                          | Planned |
| M10 Diagram extraction  | Layout + routing engine                   | Planned |
| M11 sop-ta adapter      | Legacy ↔ Sopflow mapping                  | Planned |
| M12 SOP AP profile      | Government-specific rules                 | Planned |
| M13 AI operations       | Natural language → validated operations   | Future  |

---

# Final Boundary

Target akhirnya adalah mengubah arsitektur `sop-ta` dari:

```text
SOP feature
├─ business model
├─ editor behavior
├─ workflow rules
├─ diagram logic
├─ rendering
├─ API integration
└─ government domain

all coupled inside application
```

menjadi:

```text
@sopflow/core
       ↓
@sopflow/react
       ↓
@sopflow/diagram

        +

SOP AP profile
        +

sop-ta application integration
```

Sehingga `sop-ta` berubah dari **pemilik seluruh SOP implementation** menjadi **salah satu consumer Sopflow**.

End-state yang diinginkan:

```text
                    @sopflow/core
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
   @sopflow/react   @sopflow/diagram   @sopflow/ai
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                     SOPDocument
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
           sop-ta                 other apps
```

Dengan boundary ini, pengembangan Sopflow tidak lagi terikat pada satu produk, tetapi tetap bisa memanfaatkan domain knowledge, editor behavior, dan diagram engine yang sudah terbukti di `sop-ta`.

Kalau dipakai sebagai engineering plan internal, versi berikutnya yang paling berguna adalah memecah ini menjadi **epic → task → file yang diekstrak dari `sop-ta` → target package → acceptance criteria**.
