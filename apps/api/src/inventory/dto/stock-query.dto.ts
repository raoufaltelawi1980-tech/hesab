import { IsOptional, IsString } from 'class-validator';

export class StockQueryDto {
  /** Inclusive `YYYY-MM-DD` lower bound on `businessDate`. */
  @IsOptional()
  @IsString()
  from?: string;

  /** Inclusive `YYYY-MM-DD` upper bound on `businessDate`. */
  @IsOptional()
  @IsString()
  to?: string;
}
