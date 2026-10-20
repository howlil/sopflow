export interface SopApSignatory {
  readonly name: string;
  readonly identifier?: string;
  readonly role?: string;
}

export interface SopApHeader {
  readonly number: string;
  readonly institutionName: string;
  readonly logoUrl?: string;

  readonly createdDate?: string;
  readonly revisionDate?: string;
  readonly effectiveDate?: string;

  readonly signatory?: SopApSignatory;

  readonly lawBasis: readonly string[];
  readonly qualifications: readonly string[];
  readonly relatedSops: readonly string[];
  readonly equipment: readonly string[];
  readonly warnings: readonly string[];
  readonly records: readonly string[];
}
