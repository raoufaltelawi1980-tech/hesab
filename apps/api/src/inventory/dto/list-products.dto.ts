import { IsIn, IsOptional, IsString } from 'class-validator';
import { PRODUCT_KINDS } from '../inventory.constants.js';

export class ListProductsDto {
  @IsOptional()
  @IsIn(PRODUCT_KINDS)
  kind?: string | null;

  @IsOptional()
  @IsString()
  includeArchived?: string | boolean | null;
}
