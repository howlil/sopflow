export interface SopSignatory {
  name: string;
  identifier?: string;
  role?: string;
}

export interface SopHeaderValue {
  number: string;
  institutionName: string;
  logoUrl?: string;

  createdDate: string;
  revisionDate: string;
  effectiveDate: string;

  signatory?: SopSignatory;

  lawBasis: string[];
  qualifications: string[];
  relatedSops: string[];
  equipment: string[];
  warnings: string[];
  records: string[];
}
