import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MANUAL_MOVEMENT_TYPES } from '../inventory.constants.js';

/**
 * حركة مخزون يدوية. الكمية موجبة دائمًا، والاتجاه يُشتق من `type`:
 * `RETURN_IN`/`ADJUSTMENT_IN` وارد، و`RETURN_OUT`/`ADJUSTMENT_OUT` صادر.
 * لا يُقبل `entryId` لأن المسار اليدوي لا يُنشئ قيدًا محاسبيًا بعد.
 */
export class CreateStockMovementDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsIn(MANUAL_MOVEMENT_TYPES)
  type!: string;

  /** موجب دائمًا؛ لا تُرسل إشارة سالبة. */
  @IsString()
  quantity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string | null;

  @IsOptional()
  @IsString()
  businessDate?: string | null;
}
