import { IsBooleanString, IsIn, IsOptional } from 'class-validator';
import { CONTACT_KINDS } from '../contacts.constants.js';

/**
 * List filters. `kind` mirrors the create vocabulary; `includeArchived` keeps
 * archived contacts out of the response unless explicitly requested, because
 * archiving is the documented way to retire a contact.
 */
export class ListContactsDto {
  @IsOptional()
  @IsIn(CONTACT_KINDS)
  kind?: string | null;

  @IsOptional()
  @IsBooleanString()
  includeArchived?: string | boolean | null;
}