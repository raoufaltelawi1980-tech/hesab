import { IsDecimal, IsUUID } from 'class-validator';

export class CreateAllocationDto {
  /** The posted `COLLECTION`/`PAYMENT` entry created through the draft cycle. */
  @IsUUID()
  entryId!: string;

  /** Allocated amount in the debt's original currency; must be `> 0`. */
  @IsDecimal()
  amount!: string;
}
