export type SopTaStepType = "terminator" | "task" | "decision";
export type SopTaTerminatorRole = "start" | "end";
export type SopTaDurationUnit = "m" | "h" | "d" | "w" | "mo" | "y";

export interface SopTaActor {
  readonly id: string;
  readonly name: string;
}

export interface SopTaProcedureRow {
  readonly id: string;
  readonly urutan: number;
  readonly kegiatan: string;
  readonly pelaksana?: string;
  readonly waktu?: number;
  readonly satuanWaktu?: string;
  readonly kelengkapan?: string;
  readonly keluaran?: string;
  readonly keterangan?: string;
  readonly type?: SopTaStepType;
  readonly terminatorRole?: SopTaTerminatorRole;
  readonly id_next_step_if_yes?: string;
  readonly id_next_step_if_no?: string;
  readonly pelaksanaIds?: readonly string[];
  readonly pelaksanaMapping?: Readonly<Record<string, string>>;
}

export interface SopTaImportInput {
  readonly id: string;
  readonly title: string;
  readonly actors: readonly SopTaActor[];
  readonly rows: readonly SopTaProcedureRow[];
}

export type SopTaProcedureKind = "AWAL_AKHIR" | "KEGIATAN" | "KEPUTUSAN";

export interface SopTaProcedurePatchItem {
  readonly tempId: string;
  readonly jenis: SopTaProcedureKind;
  readonly kegiatan: string;
  readonly kelengkapan?: string;
  readonly keluaran?: string;
  readonly waktu?: number;
  readonly satuanWaktu?: SopTaDurationUnit;
  readonly keterangan?: string;
  readonly pelaksanaId?: string;
  readonly langkahSelanjutnyaYaTempId?: string | null;
  readonly langkahSelanjutnyaTidakTempId?: string | null;
}
